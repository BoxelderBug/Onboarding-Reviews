'use client';

import { useState } from 'react';
import { ClipboardList, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { ALLOWED_EMAIL_DOMAIN, useAuth } from '@/context/AuthContext';

export default function SignInScreen() {
  const { signIn, error } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSignIn() {
    setSigningIn(true);
    setLocalError(null);
    try {
      await signIn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed.';
      setLocalError(msg);
    } finally {
      setSigningIn(false);
    }
  }

  const display = localError ?? error;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-2xl mb-4">
          <ClipboardList className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">HR Comm/Sched Center</h1>
        <p className="text-sm text-gray-500 mb-6">Adams Pest Control</p>
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Use your <span className="font-medium text-gray-500">@{ALLOWED_EMAIL_DOMAIN}</span> Google account.
        </p>
        {display && (
          <div className="mt-4 flex items-start gap-2 text-left text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{display}</span>
          </div>
        )}
      </div>
    </div>
  );
}
