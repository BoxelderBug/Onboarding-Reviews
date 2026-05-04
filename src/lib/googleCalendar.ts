// Google Calendar REST API utilities

function getUTCOffset(dateStr: string, timeStr: string, timeZone: string): string {
  // Use Intl to determine the UTC offset for a given moment in the specified timezone
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  const tzStr = dt.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
  const match = tzStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 'Z';
  const sign = match[1];
  const hours = String(match[2]).padStart(2, '0');
  const mins = String(match[3] ?? '00').padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

function toRFC3339(dateStr: string, timeStr: string, timeZone: string): string {
  const offset = getUTCOffset(dateStr, timeStr, timeZone);
  return `${dateStr}T${timeStr}:00${offset}`;
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export async function checkBusy(
  accessToken: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  timeZone: string
): Promise<boolean> {
  const endTime = addMinutes(startTime, durationMinutes);
  const body = {
    timeMin: toRFC3339(date, startTime, timeZone),
    timeMax: toRFC3339(date, endTime, timeZone),
    timeZone,
    items: [{ id: 'primary' }],
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`freeBusy request failed: ${res.status}`);
  const data = await res.json();
  const busy: unknown[] = data?.calendars?.primary?.busy ?? [];
  return busy.length > 0;
}

export async function createCalendarEvent(
  accessToken: string,
  summary: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  timeZone: string,
  attendeeEmails: string[]
): Promise<string> {
  const endTime = addMinutes(startTime, durationMinutes);
  const event = {
    summary,
    start: { dateTime: `${date}T${startTime}:00`, timeZone },
    end: { dateTime: `${date}T${endTime}:00`, timeZone },
    attendees: attendeeEmails.filter(Boolean).map((email) => ({ email })),
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) throw new Error(`createEvent request failed: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}
