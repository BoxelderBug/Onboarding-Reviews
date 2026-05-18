import type { AppData, Applicant, Requisition, ScoreOption } from './types';
import { computeFunnel, computeSourceBreakdown, computeInterviewerLoad, daysBetween, statusLabel } from './requisitions';

/**
 * Build a CSV that mirrors the layout of the original "2026 Requisitions" sheet:
 *   - Row 1: position metadata
 *   - Row 2: location + dates + days open
 *   - Row 4: column headers
 *   - Rows 5+: applicants, with right-side panels (source breakdown, funnel, interviewer load, posting options)
 *
 * The layout is approximate — columns line up close enough for HR to copy/paste.
 */
export function buildRequisitionCsv(req: Requisition, data: AppData): string {
  const managerMap = new Map(data.settings.managers.map((m) => [m.id, m.name]));
  const interviewerMap = new Map(data.settings.interviewers.map((i) => [i.id, i.name]));
  const locationMap = new Map(data.settings.locations.map((l) => [l.id, l.name]));

  const hiringManager = req.hiringManagerId ? managerMap.get(req.hiringManagerId) ?? '' : '';
  const location = req.locationName ?? (req.locationId ? locationMap.get(req.locationId) ?? '' : '');
  const days = daysBetween(req.datePosted, req.dateClosed);
  const funnel = computeFunnel(req.applicants);
  const sources = computeSourceBreakdown(req.applicants, data.settings.jobSources);
  const interviewerLoad = computeInterviewerLoad(req.applicants, data.settings.interviewers.map((i) => i.id));

  // Row 1: position metadata
  const row1 = [
    '', '', '', '', '',
    'Position Title:', req.positionTitle,
    '', 'Req#:', req.reqNumber,
    'Openings:', String(req.openings),
    'Hiring Approval Date:', '', req.hiringApprovalDate ?? '',
    'Hiring Manager:', '', hiringManager,
  ];

  // Row 2: location + dates + days open
  const row2 = [
    '', '', '', '', '',
    'Location:', location,
    '', 'Date Posted:', req.datePosted ?? '',
    'Date Closed:', req.dateClosed ?? '',
    'Days Open:', days !== null ? String(days) : '',
  ];

  // Row 3: blank
  const row3: string[] = [];

  // Row 4: column headers
  const header = [
    '# OF APPLICANTS', 'APPLICANT NAME', 'JOB BOARD', 'ADP APP COMPLETE DATE',
    'PHONE INTERVIEW DATE', 'PHONE INTERVIEW SCORE',
    '1ST INTERVIEW DATE & TIME', 'INTERVIEW SCORE',
    'STATUS', '', '', 'INTERVIEWERS', '', '', '',
    '', 'Location Data', '', '', '', '',
    '', 'Candidate Funnel', '', '',
    'Interviewers', '', '',
    'Posting Options', '',
  ];

  // Applicant rows
  const applicantRows: string[][] = req.applicants.map((a, idx) => {
    const interviewerNames = a.interviewerIds.map((id) => interviewerMap.get(id) ?? '');
    while (interviewerNames.length < 3) interviewerNames.push('');
    const intDateTime = a.firstInterviewDate
      ? a.firstInterviewTime
        ? `${a.firstInterviewDate} ${a.firstInterviewTime}`
        : a.firstInterviewDate
      : '';
    return [
      String(idx + 1),
      a.name,
      a.source,
      a.adpCompleteDate ?? '',
      a.phoneInterviewDate ?? '',
      scoreLabel(a.phoneInterviewScore, data.settings.phoneScoreOptions),
      intDateTime,
      scoreLabel(a.interviewScore, data.settings.interviewScoreOptions),
      statusLabel(a.status, data.settings.applicantStatuses),
      '', '',
      interviewerNames[0], interviewerNames[1], interviewerNames[2],
      '', '',
    ];
  });

  // Right-side panels start at column index 16 (matching original layout).
  // We'll merge into the rows: source rows at index 16-20, funnel at 22-23, interviewer at 25-26, posting at 28-29.
  const sourceRowsCsv: { source: string; applicants: number; phone: number; ints: number; hired: number }[] = [];
  // header row for sources
  sourceRowsCsv.push({ source: '', applicants: 0, phone: 0, ints: 0, hired: 0 }); // placeholder for header row
  for (const s of sources) {
    sourceRowsCsv.push({ source: s.source, applicants: s.applicants, phone: s.phoneInterviews, ints: s.interviews, hired: s.hired });
  }
  // The "header" should be at the applicant header row level — we'll inject it differently below.

  const funnelLabels: { label: string; value: number }[] = [
    { label: 'Applicants:', value: funnel.applicants },
    { label: 'Phone Ints:', value: funnel.phoneInterviews },
    { label: 'Interviews:', value: funnel.interviews },
    { label: 'Offers:', value: funnel.offers },
    { label: 'Accepted:', value: funnel.accepted },
    { label: 'Hired:', value: funnel.hired },
    { label: 'Declined Offer:', value: funnel.offerDeclined },
    { label: 'Withdrew:', value: funnel.withdrew },
    { label: 'UTC:', value: funnel.unableToConnect },
    { label: 'NCNS:', value: funnel.noCallNoShow },
    { label: 'Rejected PI:', value: funnel.rejectedAtPhone },
    { label: 'Rejected Ints:', value: funnel.rejectedAtInterview },
    { label: 'Rescinded Offer:', value: funnel.offerRescinded },
  ];

  const interviewerRowsCsv = data.settings.interviewers.map((i) => ({
    name: i.name,
    count: interviewerLoad.get(i.id) ?? 0,
  }));

  const postingRowsCsv = data.settings.jobSources.map((src) => ({
    src,
    posted: req.postingPlatforms.includes(src),
  }));

  // Assemble the right-side panel rows. We'll iterate through the maximum number of rows needed and pad.
  const sourceLabels: [string, number, number, number, number][] = [
    ['Applicants', 0, 0, 0, 0], // headers row
    ...sources.map<[string, number, number, number, number]>((s) => [s.source, s.applicants, s.phoneInterviews, s.interviews, s.hired]),
  ];

  const totalRows = Math.max(
    applicantRows.length,
    sourceLabels.length,
    funnelLabels.length,
    interviewerRowsCsv.length,
    postingRowsCsv.length
  );

  // Pad applicant rows to totalRows
  while (applicantRows.length < totalRows) {
    applicantRows.push(new Array(16).fill(''));
  }

  // For each row, append the right-side panel cells
  for (let i = 0; i < totalRows; i++) {
    const row = applicantRows[i];
    const src = sourceLabels[i];
    const fl = funnelLabels[i];
    const il = interviewerRowsCsv[i];
    const pl = postingRowsCsv[i];

    // Source block: columns 16-20
    row[16] = src ? src[0] : '';
    row[17] = src ? (i === 0 ? 'Applicants' : String(src[1])) : '';
    row[18] = src ? (i === 0 ? 'Phone Interview' : String(src[2])) : '';
    row[19] = src ? (i === 0 ? 'Interview' : String(src[3])) : '';
    row[20] = src ? (i === 0 ? 'Hired' : String(src[4])) : '';
    // Source headers row 0: override the first col to blank header
    if (i === 0) row[16] = '';

    // Funnel block: columns 22-23
    row[21] = '';
    row[22] = fl ? fl.label : '';
    row[23] = fl ? String(fl.value) : '';

    // Interviewer block: columns 25-26
    row[24] = '';
    row[25] = il ? il.name : '';
    row[26] = il ? String(il.count) : '';

    // Posting block: columns 28-29
    row[27] = '';
    row[28] = pl ? pl.src : '';
    row[29] = pl ? (pl.posted ? 'TRUE' : 'FALSE') : '';
  }

  const allRows: string[][] = [row1, row2, row3, header, ...applicantRows];
  return allRows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function scoreLabel(value: string | undefined, options: ScoreOption[]): string {
  if (!value) return '';
  const opt = options.find((o) => o.value === value);
  return (opt?.label ?? value).toUpperCase();
}

function csvCell(v: string): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Trigger a browser download of the requisition CSV. */
export function exportRequisitionCsv(req: Requisition, data: AppData): void {
  if (typeof window === 'undefined') return;
  const csv = buildRequisitionCsv(req, data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (req.positionTitle || 'requisition').replace(/[^\w-]+/g, '_');
  a.download = `${req.reqNumber || 'req'}_${safeTitle}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Re-export so consumers don't need a second import for the applicant-only helper. */
export type { Applicant };
