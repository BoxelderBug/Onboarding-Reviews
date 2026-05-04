import type { AppData } from './types';
import { effectiveDate, effectiveTime, displayDate, formatTime, reviewStatus } from './dateUtils';

type SheetCell = {
  userEnteredValue: { stringValue: string };
  userEnteredFormat?: { textFormat?: { bold?: boolean }; backgroundColor?: { red: number; green: number; blue: number } };
};

function cell(value: string, bold = false, bg?: { red: number; green: number; blue: number }): SheetCell {
  return {
    userEnteredValue: { stringValue: value },
    ...(bold || bg
      ? {
          userEnteredFormat: {
            ...(bold ? { textFormat: { bold: true } } : {}),
            ...(bg ? { backgroundColor: bg } : {}),
          },
        }
      : {}),
  };
}

const HEADER_BG = { red: 0.267, green: 0.467, blue: 0.816 }; // blue-600 ish
const HEADER_FG_BOLD = true;

const STATUS_COLORS: Record<string, { red: number; green: number; blue: number } | undefined> = {
  Overdue: { red: 1, green: 0.9, blue: 0.9 },
  Today:   { red: 1, green: 0.97, blue: 0.87 },
  Upcoming: undefined,
};

export async function exportToGoogleSheets(
  accessToken: string,
  data: AppData
): Promise<string> {
  const positionMap = new Map(data.settings.positions.map((p) => [p.id, p.name]));
  const managerMap  = new Map(data.settings.managers.map((m) => [m.id, m.name]));

  const HEADERS = [
    'Employee', 'Position', 'Manager', 'Start Date',
    '30-Day Date', '30-Day Time', '30-Day Status', '30-Day Scheduled',
    '60-Day Date', '60-Day Time', '60-Day Status', '60-Day Scheduled',
    '180-Day Date', '180-Day Time', '180-Day Status', '180-Day Scheduled',
  ];

  const headerRow = {
    values: HEADERS.map((h) =>
      ({ ...cell(h, HEADER_FG_BOLD, HEADER_BG), userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: HEADER_BG } })
    ),
  };

  const sorted = [...data.employees].sort(
    (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  const dataRows = sorted.map((emp) => {
    const cells: SheetCell[] = [
      cell(`${emp.lastName}, ${emp.firstName}`),
      cell(positionMap.get(emp.positionId) ?? ''),
      cell(emp.managerId ? (managerMap.get(emp.managerId) ?? '') : ''),
      cell(emp.startDate ? displayDate(emp.startDate) : ''),
    ];

    for (const type of [30, 60, 180] as const) {
      const review = emp.reviews.find((r) => r.type === type);
      if (review) {
        const eDate = effectiveDate(review);
        const eTime = effectiveTime(review);
        const status = reviewStatus(eDate);
        const statusLabel = status === 'overdue' ? 'Overdue' : status === 'today' ? 'Today' : 'Upcoming';
        const bg = STATUS_COLORS[statusLabel];
        cells.push(
          cell(displayDate(eDate)),
          cell(formatTime(eTime)),
          cell(statusLabel, false, bg),
          cell(review.gcalEventId ? 'Yes' : 'No'),
        );
      } else {
        cells.push(cell(''), cell(''), cell(''), cell(''));
      }
    }

    return { values: cells };
  });

  const title = `Onboarding Reviews — ${new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })}`;

  const body = {
    properties: { title },
    sheets: [
      {
        properties: {
          title: 'Review Schedule',
          gridProperties: { frozenRowCount: 1 },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: [headerRow, ...dataRows] }],
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 403) throw new Error('SCOPE_MISSING');
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const result = await res.json();
  return result.spreadsheetUrl as string;
}
