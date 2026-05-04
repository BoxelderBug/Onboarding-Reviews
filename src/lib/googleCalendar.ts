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

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  // 404 means already deleted — treat as success
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteEvent failed: ${res.status}`);
  }
}

export async function createCalendarEvent(
  accessToken: string,
  summary: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  timeZone: string,
  attendeeEmails: string[],
  description?: string,
  location?: string
): Promise<string> {
  const endTime = addMinutes(startTime, durationMinutes);
  const event: Record<string, unknown> = {
    summary,
    start: { dateTime: `${date}T${startTime}:00`, timeZone },
    end: { dateTime: `${date}T${endTime}:00`, timeZone },
    attendees: attendeeEmails.filter(Boolean).map((email) => ({ email })),
  };
  if (description) event.description = description;
  if (location) event.location = location;

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

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // formatted, empty for all-day events
  endTime: string;
  isAllDay: boolean;
}

export async function fetchDayEvents(
  accessToken: string,
  date: string,      // YYYY-MM-DD
  timeZone: string
): Promise<CalendarEvent[]> {
  const timeMin = toRFC3339(date, '00:00', timeZone);
  const timeMax = toRFC3339(date, '23:59', timeZone);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`events.list failed: ${res.status}`);
  const data = await res.json();
  const items: Array<{
    id: string;
    summary?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
  }> = data.items ?? [];

  return items.map((item) => {
    const isAllDay = !item.start.dateTime;
    let startTime = '';
    let endTime = '';
    if (!isAllDay && item.start.dateTime && item.end.dateTime) {
      const fmt = (s: string) =>
        new Date(s).toLocaleTimeString('en-US', {
          timeZone,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      startTime = fmt(item.start.dateTime);
      endTime = fmt(item.end.dateTime);
    }
    return {
      id: item.id,
      title: item.summary ?? '(No title)',
      startTime,
      endTime,
      isAllDay,
    };
  });
}

export interface CalendarRoom {
  id: string;
  name: string;
  resourceEmail: string;
}

export async function fetchCalendarRooms(accessToken: string): Promise<CalendarRoom[]> {
  // Try Admin SDK first — returns all org room resources across every building
  try {
    const adminRes = await fetch(
      'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/calendars?maxResults=500',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (adminRes.ok) {
      const data = await adminRes.json();
      const items: Array<{ resourceName: string; resourceEmail: string }> = data.items ?? [];
      if (items.length > 0) {
        return items.map((item) => ({
          id: item.resourceEmail,
          name: item.resourceName,
          resourceEmail: item.resourceEmail,
        }));
      }
    }
  } catch {
    // fall through to calendarList
  }

  // Fallback: calendarList only returns rooms the user is personally subscribed to
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`calendarList failed: ${res.status}`);
  const data = await res.json();
  const items: Array<{ id: string; summary: string }> = data.items ?? [];
  return items
    .filter((item) => item.id.endsWith('@resource.calendar.google.com'))
    .map((item) => ({ id: item.id, name: item.summary, resourceEmail: item.id }));
}
