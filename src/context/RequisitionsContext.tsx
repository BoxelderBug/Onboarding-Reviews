'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  deleteRequisition as fbDelete,
  isFirebaseConfigured,
  saveRequisition as fbSave,
  subscribeToRequisitions,
} from '@/lib/requisitions';
import type { Requisition } from '@/lib/types';

interface RequisitionsContextValue {
  /** Whether Firebase env vars are present and reads/writes can succeed. */
  isConfigured: boolean;
  /** Initial load completed (snapshot received at least once). */
  loaded: boolean;
  /** Most recent connection / write error, if any. */
  error: string | null;
  requisitions: Requisition[];
  save: (req: Requisition) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const RequisitionsContext = createContext<RequisitionsContextValue | null>(null);

export function RequisitionsProvider({ children }: { children: ReactNode }) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoaded(true);
      return;
    }
    const unsub = subscribeToRequisitions(
      (reqs) => {
        setRequisitions(reqs);
        setLoaded(true);
        setError(null);
      },
      (err) => {
        setError(err.message || 'Failed to load requisitions.');
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [configured]);

  const value = useMemo<RequisitionsContextValue>(
    () => ({
      isConfigured: configured,
      loaded,
      error,
      requisitions,
      save: async (req) => {
        try {
          await fbSave(req);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to save requisition.';
          setError(msg);
          throw e;
        }
      },
      remove: async (id) => {
        try {
          await fbDelete(id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to delete requisition.';
          setError(msg);
          throw e;
        }
      },
    }),
    [configured, loaded, error, requisitions]
  );

  return (
    <RequisitionsContext.Provider value={value}>{children}</RequisitionsContext.Provider>
  );
}

export function useRequisitions(): RequisitionsContextValue {
  const ctx = useContext(RequisitionsContext);
  if (!ctx) throw new Error('useRequisitions must be used inside RequisitionsProvider');
  return ctx;
}
