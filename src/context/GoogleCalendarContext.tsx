'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

const TOKEN_KEY = 'gcal_access_token';
const EXPIRY_KEY = 'gcal_token_expiry';
const BUFFER_MS = 5 * 60 * 1000; // treat token as expired 5 min early

function loadStoredToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = Number(localStorage.getItem(EXPIRY_KEY) ?? 0);
    if (token && expiry > Date.now() + BUFFER_MS) return token;
  } catch { /* ignore */ }
  return null;
}

function saveStoredToken(token: string, expiresInSeconds: number) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
  } catch { /* ignore */ }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch { /* ignore */ }
}

interface GoogleCalendarContextValue {
  isReady: boolean;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  accessToken: string | null;
}

const GoogleCalendarContext = createContext<GoogleCalendarContextValue>({
  isReady: false,
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  accessToken: null,
});

export function GoogleCalendarProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenClientRef = useRef<any>(null);

  // Restore persisted token on mount
  useEffect(() => {
    const stored = loadStoredToken();
    if (stored) setAccessToken(stored);
  }, []);

  // Poll until the GIS script is loaded
  useEffect(() => {
    let cancelled = false;
    function check() {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.accounts?.oauth2) {
        setIsReady(true);
      } else {
        setTimeout(check, 300);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(() => {
    if (!isReady) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('Google Client ID is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your .env.local file.');
      return;
    }
    if (!tokenClientRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly https://www.googleapis.com/auth/spreadsheets',
        callback: (response: { access_token?: string; expires_in?: number }) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            saveStoredToken(response.access_token, response.expires_in ?? 3600);
          }
        },
      });
    }
    tokenClientRef.current.requestAccessToken();
  }, [isReady]);

  const disconnect = useCallback(() => {
    if (accessToken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google?.accounts?.oauth2?.revoke(accessToken, () => {});
    }
    setAccessToken(null);
    tokenClientRef.current = null;
    clearStoredToken();
  }, [accessToken]);

  return (
    <GoogleCalendarContext.Provider
      value={{ isReady, isConnected: !!accessToken, connect, disconnect, accessToken }}
    >
      {children}
    </GoogleCalendarContext.Provider>
  );
}

export function useGoogleCalendar() {
  return useContext(GoogleCalendarContext);
}
