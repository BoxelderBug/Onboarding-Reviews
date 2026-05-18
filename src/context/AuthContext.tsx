'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

export const ALLOWED_EMAIL_DOMAIN = 'adamspestcontrol.com';

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@' + ALLOWED_EMAIL_DOMAIN);
}

interface AuthContextValue {
  /** Firebase env vars are present — auth is enabled. */
  isConfigured: boolean;
  /** Initial auth state has been determined. */
  loading: boolean;
  /** Signed-in user (always domain-allowed). */
  user: User | null;
  /** Last sign-in or domain-check error. */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !isAllowedEmail(u.email)) {
        // Signed in with the wrong domain — boot them.
        await fbSignOut(auth).catch(() => {});
        setUser(null);
        setError(`Only @${ALLOWED_EMAIL_DOMAIN} Google accounts can sign in.`);
      } else {
        setUser(u);
        if (u) setError(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: configured,
      loading,
      user,
      error,
      signIn: async () => {
        const auth = getFirebaseAuth();
        if (!auth) {
          setError('Firebase is not configured.');
          return;
        }
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: 'select_account',
        });
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Sign-in failed.';
          setError(msg);
          throw e;
        }
      },
      signOut: async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        await fbSignOut(auth);
      },
    }),
    [configured, loading, user, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
