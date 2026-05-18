import type {
  AppData, Applicant, Interviewer, Manager, Requisition, Settings,
} from './types';
import { generateApplicantId, generateReqId } from './requisitions';

// ===========================================================================
// Public API
// ===========================================================================

export interface RequisitionImportResult {
  requisition: Requisition;
  /** Settings additions discovered while importing (new interviewers, sources, managers). */
  settingsPatch: Partial<Settings>;
  /** Human-readable warnings (unmatched statuses, missing fields). */
  warnings: string[];
}

/** Parse a 2026-Requisitions-style CSV into a Requisition + settings additions. */
export function parseRequisitionCsv(csvText: string, data: AppData): RequisitionImportResult {
  const rows = parseCsv(csvText);
  const warnings: string[] = [];

  // ---- Metadata block (rows 0 & 1) ----
  const r0 = rows[0] ?? [];
  const r1 = rows[1] ?? [];
  const positionTitle = cell(r0, 6);
  const reqNumber = cell(r0, 9);
  const openings = parseInt(cell(r0, 11) || '1', 10) || 1;
  const hiringApprovalDate = toIsoDate(cell(r0, 14));
  const hiringManagerName = cell(r0, 17);

  const locationName = cell(r1, 6);
  const datePosted = toIsoDate(cell(r1, 9));
  const dateClosed = toIsoDate(cell(r1, 11));

  // ---- Mutable accumulators for new settings entries ----
  const newInterviewers: Interviewer[] = [];
  const newJobSources: string[] = [];
  const newManagers: Manager[] = [];

  // ---- Resolve hiring manager (auto-add if missing) ----
  const hiringManagerId = hiringManagerName
    ? getOrCreateManager(hiringManagerName, data.settings.managers, newManagers)
    : undefined;

  // ---- Resolve location (link to existing, else free-text) ----
  const loc = resolveLocation(locationName, data.settings.locations);

  // ---- Applicants (rows 4+ until first empty-name row) ----
  const applicants: Applicant[] = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const name = cell(row, 1);
    if (!name) {
      // The CSV uses empty applicant rows as filler for right-side panels.
      // Skip them, but keep scanning — panels can extend past applicants.
      continue;
    }

    const sourceRaw = cell(row, 2);
    const source = sourceRaw
      ? ensureJobSource(sourceRaw, data.settings.jobSources, newJobSources)
      : '';

    const adpCompleteDate = toIsoDate(cell(row, 3));
    const phoneInterviewDate = toIsoDate(cell(row, 4));
    const phoneInterviewScore = parseScore(cell(row, 5));

    const intParsed = parseInterviewDateTime(cell(row, 6));
    const firstInterviewDate = intParsed.date;
    const firstInterviewTime = intParsed.time;
    const interviewScore = parseScore(cell(row, 7));

    const statusRaw = cell(row, 8);
    const status = mapStatus(statusRaw, data.settings.applicantStatuses);
    if (statusRaw && status === 'new' && statusRaw.toLowerCase() !== 'new') {
      warnings.push(`Status "${statusRaw}" did not match — defaulted to "New"`);
    }

    // Interviewers: columns 11, 12, 13
    const interviewerIds: string[] = [];
    for (const col of [11, 12, 13]) {
      const intName = cell(row, col);
      if (!intName) continue;
      const id = getOrCreateInterviewer(intName, data.settings.interviewers, newInterviewers);
      if (id) interviewerIds.push(id);
    }

    applicants.push({
      id: generateApplicantId(),
      name,
      source,
      adpCompleteDate,
      phoneInterviewDate,
      phoneInterviewScore,
      firstInterviewDate,
      firstInterviewTime,
      interviewScore,
      interviewerIds,
      status,
    });
  }

  // ---- Posting Platforms (columns 28 = name, 29 = TRUE/FALSE), rows 4+ ----
  const postingPlatforms: string[] = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const platform = cell(row, 28);
    const flag = cell(row, 29).toUpperCase();
    if (platform && flag === 'TRUE') {
      // Ensure source list includes it (posting platforms are job sources)
      ensureJobSource(platform, data.settings.jobSources, newJobSources);
      if (!postingPlatforms.includes(platform)) postingPlatforms.push(platform);
    }
  }

  const now = new Date().toISOString();
  const requisition: Requisition = {
    id: generateReqId(),
    reqNumber,
    positionTitle,
    openings,
    status: dateClosed ? 'closed' : 'open',
    hiringApprovalDate,
    hiringManagerId,
    datePosted,
    dateClosed,
    locationId: loc.locationId,
    locationName: loc.locationName,
    postingPlatforms,
    applicants,
    createdAt: now,
    updatedAt: now,
  };

  // ---- Build settings patch ----
  const settingsPatch: Partial<Settings> = {};
  if (newInterviewers.length > 0) {
    settingsPatch.interviewers = [...data.settings.interviewers, ...newInterviewers];
    warnings.push(`Added ${newInterviewers.length} interviewer${newInterviewers.length > 1 ? 's' : ''}: ${newInterviewers.map((i) => i.name).join(', ')}`);
  }
  if (newJobSources.length > 0) {
    settingsPatch.jobSources = [...data.settings.jobSources, ...newJobSources];
    warnings.push(`Added ${newJobSources.length} job source${newJobSources.length > 1 ? 's' : ''}: ${newJobSources.join(', ')}`);
  }
  if (newManagers.length > 0) {
    settingsPatch.managers = [...data.settings.managers, ...newManagers];
    warnings.push(`Added hiring manager: ${newManagers.map((m) => m.name).join(', ')}`);
  }

  if (!reqNumber) warnings.push('No Req # found in the CSV.');
  if (!positionTitle) warnings.push('No Position Title found in the CSV.');
  if (applicants.length === 0) warnings.push('No applicants were imported.');

  return { requisition, settingsPatch, warnings };
}

// ===========================================================================
// CSV parser (handles quoted fields and embedded newlines)
// ===========================================================================

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { buf += '"'; i++; }
        else inQuotes = false;
      } else {
        buf += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(buf); buf = '';
    } else if (c === '\r') {
      // ignore — handled with \n below
    } else if (c === '\n') {
      row.push(buf); rows.push(row); row = []; buf = '';
    } else {
      buf += c;
    }
  }
  if (buf.length > 0 || row.length > 0) {
    row.push(buf);
    rows.push(row);
  }
  return rows;
}

// ===========================================================================
// Helpers
// ===========================================================================

function cell(row: string[] | undefined, idx: number): string {
  if (!row) return '';
  return (row[idx] ?? '').trim();
}

function toIsoDate(input: string): string | undefined {
  if (!input) return undefined;
  // M/D/YYYY or MM/DD/YYYY
  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yy] = m;
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return undefined;
}

function parseInterviewDateTime(input: string): { date?: string; time?: string } {
  if (!input) return {};
  // "02/17/2026 10:30 AM" or "02/17/2026 14:30"
  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
  if (m) {
    const [, mm, dd, yy, hh, mn, ampm] = m;
    const date = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    if (!hh) return { date };
    let h = parseInt(hh, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return {
      date,
      time: `${String(h).padStart(2, '0')}:${mn}`,
    };
  }
  return { date: toIsoDate(input) };
}

function parseScore(input: string): string | undefined {
  if (!input) return undefined;
  const v = input.trim().toLowerCase();
  if (v === 'red' || v === 'r') return 'red';
  if (v === 'yellow' || v === 'y') return 'yellow';
  if (v === 'green' || v === 'g') return 'green';
  if (v === 'n/a' || v === 'na') return 'na';
  return undefined;
}

const STATUS_ALIASES: Record<string, string> = {
  'unable to connect': 'unable-to-connect',
  'utc': 'unable-to-connect',
  'hired': 'hired',
  'no call no show': 'no-call-no-show',
  'ncns': 'no-call-no-show',
  'no per phone interview': 'rejected-phone',
  'rejected at phone interview': 'rejected-phone',
  'rejected pi': 'rejected-phone',
  'rejected at interview': 'rejected-interview',
  'rejected int': 'rejected-interview',
  'rejected ints': 'rejected-interview',
  'withdrew': 'withdrew',
  'withdrawls': 'withdrew',
  'declined offer': 'offer-declined',
  'offer declined': 'offer-declined',
  'offer extended': 'offer-extended',
  'offer accepted': 'offer-accepted',
  'accepted': 'offer-accepted',
  'rescinded offer': 'offer-rescinded',
  'offer rescinded': 'offer-rescinded',
  'phone interview scheduled': 'phone-scheduled',
  'phone scheduled': 'phone-scheduled',
  'interview scheduled': 'interview-scheduled',
  'no phone interview needed': 'no-phone-needed',
  'new': 'new',
};

function mapStatus(input: string, statuses: AppData['settings']['applicantStatuses']): string {
  const v = input.trim().toLowerCase();
  if (!v) return 'new';
  if (STATUS_ALIASES[v]) return STATUS_ALIASES[v];
  // Try matching against configured labels / values
  const match = statuses.find(
    (s) => s.label.toLowerCase() === v || s.value === v
  );
  return match?.value ?? 'new';
}

function getOrCreateInterviewer(
  name: string,
  existing: Interviewer[],
  toAdd: Interviewer[]
): string | null {
  const n = name.trim();
  if (!n) return null;
  const lower = n.toLowerCase();
  const existingHit = existing.find((i) => i.name.trim().toLowerCase() === lower);
  if (existingHit) return existingHit.id;
  const addedHit = toAdd.find((i) => i.name.trim().toLowerCase() === lower);
  if (addedHit) return addedHit.id;
  const newOne: Interviewer = {
    id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${toAdd.length}`,
    name: n,
  };
  toAdd.push(newOne);
  return newOne.id;
}

function getOrCreateManager(
  name: string,
  existing: Manager[],
  toAdd: Manager[]
): string {
  const n = name.trim();
  const lower = n.toLowerCase();
  const existingHit = existing.find((m) => m.name.trim().toLowerCase() === lower);
  if (existingHit) return existingHit.id;
  const addedHit = toAdd.find((m) => m.name.trim().toLowerCase() === lower);
  if (addedHit) return addedHit.id;
  const newOne: Manager = {
    id: `mgr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${toAdd.length}`,
    name: n,
    email: '',
  };
  toAdd.push(newOne);
  return newOne.id;
}

function ensureJobSource(src: string, existing: string[], toAdd: string[]): string {
  const n = src.trim();
  if (!n) return '';
  const lower = n.toLowerCase();
  if (existing.some((s) => s.toLowerCase() === lower)) {
    // Use the canonical casing from existing
    return existing.find((s) => s.toLowerCase() === lower) ?? n;
  }
  if (toAdd.some((s) => s.toLowerCase() === lower)) {
    return toAdd.find((s) => s.toLowerCase() === lower) ?? n;
  }
  toAdd.push(n);
  return n;
}

function resolveLocation(
  name: string,
  locations: AppData['settings']['locations']
): { locationId?: string; locationName?: string } {
  const n = name.trim();
  if (!n) return {};
  const match = locations.find((l) => l.name.toLowerCase() === n.toLowerCase());
  if (match) return { locationId: match.id };
  return { locationName: n };
}
