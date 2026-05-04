'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

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
    return () => {
      cancelled = true;
    };
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
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
        callback: (response: { access_token?: string }) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
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
