import {
  collection, doc, deleteDoc, onSnapshot, setDoc, type Firestore,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './firebase';
import type { Applicant, ApplicantStatusConfig, Requisition } from './types';

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

export function generateReqId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateApplicantId(): string {
  return `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Blank constructors
// ---------------------------------------------------------------------------

export function newRequisition(defaultLocationId?: string): Requisition {
  const now = new Date().toISOString();
  return {
    id: generateReqId(),
    reqNumber: '',
    positionTitle: '',
    openings: 1,
    status: 'open',
    locationId: defaultLocationId,
    postingPlatforms: [],
    applicants: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function newApplicant(): Applicant {
  return {
    id: generateApplicantId(),
    name: '',
    source: '',
    interviewerIds: [],
    status: 'new',
  };
}

// ---------------------------------------------------------------------------
// Firestore CRUD
// ---------------------------------------------------------------------------

const COLLECTION = 'requisitions';

/** Strip undefined values — Firestore rejects them. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      result[k] = v.map((item) =>
        item && typeof item === 'object' ? clean(item as Record<string, unknown>) : item
      );
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      result[k] = clean(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result as T;
}

export function subscribeToRequisitions(
  onData: (reqs: Requisition[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getDb();
  if (!db) {
    onData([]);
    return () => {};
  }
  const col = collection(db as Firestore, COLLECTION);
  return onSnapshot(
    col,
    (snap) => {
      const reqs: Requisition[] = [];
      snap.forEach((d) => reqs.push(d.data() as Requisition));
      onData(reqs);
    },
    (err) => {
      console.error('[requisitions] subscribe error', err);
      if (onError) onError(err as Error);
    }
  );
}

export async function saveRequisition(req: Requisition): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured');
  const next: Requisition = { ...req, updatedAt: new Date().toISOString() };
  await setDoc(doc(db as Firestore, COLLECTION, next.id), clean(next as unknown as Record<string, unknown>));
}

export async function deleteRequisition(id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured');
  await deleteDoc(doc(db as Firestore, COLLECTION, id));
}

// ---------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------

export interface FunnelCounts {
  applicants: number;
  phoneInterviews: number;
  interviews: number;
  offers: number;
  accepted: number;
  hired: number;
  // drop / reject reasons
  unableToConnect: number;
  noCallNoShow: number;
  rejectedAtPhone: number;
  rejectedAtInterview: number;
  offerDeclined: number;
  offerRescinded: number;
  withdrew: number;
}

const OFFER_STATUSES = new Set([
  'offer-extended', 'offer-accepted', 'offer-declined', 'offer-rescinded', 'hired',
]);

export function computeFunnel(applicants: Applicant[]): FunnelCounts {
  const counts: FunnelCounts = {
    applicants: applicants.length,
    phoneInterviews: 0,
    interviews: 0,
    offers: 0,
    accepted: 0,
    hired: 0,
    unableToConnect: 0,
    noCallNoShow: 0,
    rejectedAtPhone: 0,
    rejectedAtInterview: 0,
    offerDeclined: 0,
    offerRescinded: 0,
    withdrew: 0,
  };
  for (const a of applicants) {
    if (a.phoneInterviewDate) counts.phoneInterviews++;
    if (a.firstInterviewDate) counts.interviews++;
    if (OFFER_STATUSES.has(a.status)) counts.offers++;
    if (a.status === 'offer-accepted') counts.accepted++;
    if (a.status === 'hired') counts.hired++;
    if (a.status === 'unable-to-connect') counts.unableToConnect++;
    if (a.status === 'no-call-no-show') counts.noCallNoShow++;
    if (a.status === 'rejected-phone') counts.rejectedAtPhone++;
    if (a.status === 'rejected-interview') counts.rejectedAtInterview++;
    if (a.status === 'offer-declined') counts.offerDeclined++;
    if (a.status === 'offer-rescinded') counts.offerRescinded++;
    if (a.status === 'withdrew') counts.withdrew++;
  }
  return counts;
}

/** Per-source counts for applicants / phone interviews / interviews / hired. */
export interface SourceBreakdown {
  source: string;
  applicants: number;
  phoneInterviews: number;
  interviews: number;
  hired: number;
}

export function computeSourceBreakdown(
  applicants: Applicant[],
  knownSources: string[]
): SourceBreakdown[] {
  const seen = new Map<string, SourceBreakdown>();
  // Seed with known sources so the table is stable even when a row is 0
  for (const s of knownSources) {
    seen.set(s, { source: s, applicants: 0, phoneInterviews: 0, interviews: 0, hired: 0 });
  }
  for (const a of applicants) {
    const key = a.source || '—';
    const row = seen.get(key) ?? { source: key, applicants: 0, phoneInterviews: 0, interviews: 0, hired: 0 };
    row.applicants++;
    if (a.phoneInterviewDate) row.phoneInterviews++;
    if (a.firstInterviewDate) row.interviews++;
    if (a.status === 'hired') row.hired++;
    seen.set(key, row);
  }
  return Array.from(seen.values()).filter(
    (r) => r.applicants > 0 || knownSources.includes(r.source)
  );
}

/** How many applicants each interviewer has been assigned to. */
export function computeInterviewerLoad(
  applicants: Applicant[],
  interviewerIds: string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of interviewerIds) counts.set(id, 0);
  for (const a of applicants) {
    for (const id of a.interviewerIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Calendar days between two YYYY-MM-DD strings (inclusive end). */
export function daysBetween(start?: string, end?: string): number | null {
  if (!start) return null;
  const a = new Date(start + 'T00:00:00');
  const b = end ? new Date(end + 'T00:00:00') : new Date();
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function statusLabel(
  value: string,
  statuses: ApplicantStatusConfig[]
): string {
  return statuses.find((s) => s.value === value)?.label ?? value;
}

export function statusCategory(
  value: string,
  statuses: ApplicantStatusConfig[]
): ApplicantStatusConfig['category'] | undefined {
  return statuses.find((s) => s.value === value)?.category;
}

export { isFirebaseConfigured };
