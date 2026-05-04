'use client';

import { useState, useCallback, Fragment } from 'react';
import clsx from 'clsx';
import {
  AlertCircle,
  Clock,
  Calendar,
  ClipboardList,
  CalendarPlus,
  CalendarCheck,
  CalendarOff,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  effectiveDate,
  effectiveTime,
  reviewStatus,
  daysUntil,
  displayDate,
  formatTime,
} from '@/lib/dateUtils';
import { checkBusy, createCalendarEvent, deleteCalendarEvent, fetchDayEvents } from '@/lib/googleCalendar';
import type { CalendarEvent } from '@/lib/googleCalendar';
import { useGoogleCalendar } from '@/context/GoogleCalendarContext';
import type { AppData, Employee, Position, Review, ReviewTemplate, ReviewType } from '@/lib/types';

interface ReviewRow {
  employee: Employee;
  review: Review;
  effDate: string;
  effTime: string;
  status: 'overdue' | 'today' | 'upcoming';
  days: number;
}

function buildRows(data: AppData): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const emp of data.employees) {
    if (!emp.startDate) continue;
    for (const review of emp.reviews) {
      const effDate = effectiveDate(review);
      const effTime = effectiveTime(review);
      const status = reviewStatus(effDate);
      const days = daysUntil(effDate);
      rows.push({ employee: emp, review, effDate, effTime, status, days });
    }
  }
  rows.sort((a, b) => {
    if (a.effDate !== b.effDate) return a.effDate < b.effDate ? -1 : 1;
    if (a.effTime !== b.effTime) return a.effTime < b.effTime ? -1 : 1;
    return 0;
  });
  return rows;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function pairKey(a: ReviewType, b: ReviewType): string {
  return [a, b].sort((x, y) => x - y).join('-');
}

function gcalDayUrl(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `https://calendar.google.com/calendar/r/day/${year}/${month}/${day}`;
}

function ReviewTypeBadge({ type }: { type: ReviewType }) {
  const styles: Record<ReviewType, string> = {
    30: 'bg-blue-100 text-blue-700',
    60: 'bg-orange-100 text-orange-700',
    180: 'bg-purple-100 text-purple-700',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        styles[type]
      )}
    >
      {type}-Day
    </span>
  );
}

function StatusBadge({ status, days }: { status: ReviewRow['status']; days: number }) {
  if (status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <AlertCircle className="w-3.5 h-3.5" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (status === 'today') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <Clock className="w-3.5 h-3.5" />
        Today
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
      <Calendar className="w-3.5 h-3.5" />
      In {days}d
    </span>
  );
}

type PushState = 'idle' | 'pushing' | 'synced' | 'error';

interface CalendarCellProps {
  row: ReviewRow;
  allRows: ReviewRow[];
  positionDurationMinutes: number;
  timeZone: string;
  managerEmail?: string;
  reviewTemplate?: ReviewTemplate;
  extraEmails: string[];
  concurrentPairs: string[];
  onUpdateReview: (employeeId: string, review: Review) => void;
}

function CalendarCell({
  row,
  allRows,
  positionDurationMinutes,
  timeZone,
  managerEmail,
  reviewTemplate,
  extraEmails,
  concurrentPairs,
  onUpdateReview,
}: CalendarCellProps) {
  const { isConnected, accessToken } = useGoogleCalendar();
  const [pushState, setPushState] = useState<PushState>(
    row.review.gcalEventId ? 'synced' : 'idle'
  );
  const [conflict, setConflict] = useState(false);

  const handlePush = useCallback(async () => {
    if (!accessToken) return;
    setPushState('pushing');
    setConflict(false);

    try {
      const busy = await checkBusy(
        accessToken,
        row.effDate,
        row.effTime,
        positionDurationMinutes,
        timeZone
      );
      if (busy) {
        const curMin = timeToMinutes(row.effTime);
        const overlapping = allRows.filter(
          (r) =>
            r.employee.id !== row.employee.id &&
            r.effDate === row.effDate &&
            r.review.gcalEventId &&
            Math.abs(timeToMinutes(r.effTime) - curMin) < positionDurationMinutes
        );
        const conflictIsAllowed =
          overlapping.length > 0 &&
          overlapping.every((r) =>
            concurrentPairs.includes(pairKey(row.review.type, r.review.type))
          );
        if (!conflictIsAllowed) setConflict(true);
      }

      const fullName = `${row.employee.lastName}, ${row.employee.firstName}`;
      const rawTitle = reviewTemplate?.title ||
        `${row.review.type}-Day Review: ${row.employee.lastName}, ${row.employee.firstName}`;
      const summary = rawTitle
        .replace(/\[employee\]/gi, fullName)
        .replace(/\[employeefirst\]/gi, row.employee.firstName);
      const description = reviewTemplate?.description
        ? reviewTemplate.description
            .replace(/\[employee\]/gi, fullName)
            .replace(/\[employeefirst\]/gi, row.employee.firstName)
        : undefined;

      const attendees = [row.employee.email, managerEmail ?? '', ...extraEmails].filter(Boolean);

      const eventId = await createCalendarEvent(
        accessToken,
        summary,
        row.effDate,
        row.effTime,
        positionDurationMinutes,
        timeZone,
        attendees,
        description
      );

      onUpdateReview(row.employee.id, { ...row.review, gcalEventId: eventId });
      setPushState('synced');
    } catch {
      setPushState('error');
    }
  }, [accessToken, row, allRows, positionDurationMinutes, timeZone, managerEmail, concurrentPairs, onUpdateReview]);

  const handleUnschedule = useCallback(async () => {
    if (!accessToken || !row.review.gcalEventId) return;
    setPushState('pushing');
    try {
      await deleteCalendarEvent(accessToken, row.review.gcalEventId);
      onUpdateReview(row.employee.id, { ...row.review, gcalEventId: undefined });
      setPushState('idle');
    } catch {
      setPushState('synced'); // revert — event still exists
      alert('Failed to remove the calendar event. Please try again.');
    }
  }, [accessToken, row, onUpdateReview]);

  if (!isConnected) {
    return <span className="text-gray-300 text-xs">—</span>;
  }

  if (pushState === 'pushing') {
    return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
  }

  if (pushState === 'synced') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
          <CalendarCheck className="w-4 h-4" />
          {conflict && (
            <span
              title="Conflict detected — another event was already scheduled at this time when this was pushed"
              className="cursor-help"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </span>
          )}
          Synced
        </span>
        <button
          onClick={handleUnschedule}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remove this event from Google Calendar"
        >
          <CalendarOff className="w-3.5 h-3.5" />
          Unschedule
        </button>
      </div>
    );
  }

  if (pushState === 'error') {
    return (
      <button
        onClick={handlePush}
        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
        title="Push failed — click to retry"
      >
        <AlertCircle className="w-3.5 h-3.5" />
        Retry
      </button>
    );
  }

  return (
    <button
      onClick={handlePush}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
      title="Push to Google Calendar"
    >
      <CalendarPlus className="w-3.5 h-3.5" />
      Push
    </button>
  );
}

const COLS = ['Employee', 'Position', 'Manager', 'Review', 'Date', 'Time', 'Flags', 'Status', 'Calendar'];
const COL_COUNT = COLS.length;

// ---------------------------------------------------------------------------
// ReviewTableRow — one data row + optional expanded day-calendar preview
// ---------------------------------------------------------------------------

interface ReviewTableRowProps {
  row: ReviewRow;
  allRows: ReviewRow[];
  concurrentPairs: string[];
  positionName: string;
  mgrName: string;
  mgrEmail?: string;
  duration: number;
  reviewTemplate?: ReviewTemplate;
  extraEmails: string[];
  timeZone: string;
  onUpdateReview: (employeeId: string, review: Review) => void;
}

function ReviewTableRow({
  row,
  allRows,
  concurrentPairs,
  positionName,
  mgrName,
  mgrEmail,
  duration,
  reviewTemplate,
  extraEmails,
  timeZone,
  onUpdateReview,
}: ReviewTableRowProps) {
  const { isConnected, accessToken } = useGoogleCalendar();
  const [expanded, setExpanded] = useState(false);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState(false);

  async function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && dayEvents === null && accessToken) {
      setLoadingEvents(true);
      setEventsError(false);
      try {
        const events = await fetchDayEvents(accessToken, row.effDate, timeZone);
        setDayEvents(events);
      } catch {
        setEventsError(true);
      } finally {
        setLoadingEvents(false);
      }
    }
  }

  return (
    <Fragment>
      <tr className={clsx('hover:bg-gray-50', expanded && 'bg-gray-50')}>
        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
          {row.employee.lastName}, {row.employee.firstName}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {positionName || <span className="text-gray-400 italic text-xs">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {mgrName || <span className="text-gray-400 italic text-xs">—</span>}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <ReviewTypeBadge type={row.review.type} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
          <div className="flex items-center gap-1">
            {displayDate(row.effDate)}
            <a
              href={gcalDayUrl(row.effDate)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Calendar"
              className="text-gray-400 hover:text-blue-600 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            {isConnected && (
              <button
                onClick={handleToggle}
                title={expanded ? 'Hide calendar preview' : 'Preview calendar for this day'}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                {expanded
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
          {formatTime(row.effTime)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {row.employee.outOfState && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
              Out-of-State
            </span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <StatusBadge status={row.status} days={row.days} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <CalendarCell
            row={row}
            allRows={allRows}
            positionDurationMinutes={duration}
            timeZone={timeZone}
            managerEmail={mgrEmail}
            reviewTemplate={reviewTemplate}
            extraEmails={extraEmails}
            concurrentPairs={concurrentPairs}
            onUpdateReview={onUpdateReview}
          />
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={COL_COUNT} className="px-6 py-3 bg-blue-50 border-b border-gray-100">
            {loadingEvents && (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading calendar for {displayDate(row.effDate)}…
              </div>
            )}
            {eventsError && (
              <p className="text-xs text-red-600 py-1">Failed to load calendar events.</p>
            )}
            {!loadingEvents && !eventsError && dayEvents !== null && (
              <div className="py-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {displayDate(row.effDate)} — What&apos;s on your calendar
                </p>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-green-700 font-medium">No events — calendar is clear.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayEvents.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 text-xs">
                        <span className="text-gray-400 shrink-0 w-32">
                          {ev.isAllDay ? 'All day' : `${ev.startTime} – ${ev.endTime}`}
                        </span>
                        <span className="text-gray-800">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

interface SectionTableProps {
  rows: ReviewRow[];
  allRows: ReviewRow[];
  title: string;
  headerClass: string;
  positionMap: Map<string, string>;
  positionObjectMap: Map<string, Position>;
  managerMap: Map<string, string>;
  managerEmailMap: Map<string, string>;
  durationMap: Map<string, number>;
  reviewEmailsRecord: Record<ReviewType, string>;
  concurrentPairs: string[];
  timeZone: string;
  onUpdateReview: (employeeId: string, review: Review) => void;
}

function SectionTable({
  rows,
  allRows,
  title,
  headerClass,
  positionMap,
  positionObjectMap,
  managerMap,
  managerEmailMap,
  durationMap,
  reviewEmailsRecord,
  concurrentPairs,
  timeZone,
  onUpdateReview,
}: SectionTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
      <div className={clsx('px-4 py-3 border-b border-gray-200', headerClass)}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          {title}
          <span className="bg-white bg-opacity-60 rounded-full px-2 py-0.5 text-xs font-medium">
            {rows.length}
          </span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {COLS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row) => {
              const mgrEmail = row.employee.managerId
                ? managerEmailMap.get(row.employee.managerId)
                : undefined;
              const duration = durationMap.get(row.employee.positionId) ?? 30;
              const position = positionObjectMap.get(row.employee.positionId);
              const reviewTemplate = position?.reviewTemplates?.[row.review.type];
              const extraEmails = (reviewEmailsRecord[row.review.type] ?? '')
                .split(',').map((s) => s.trim()).filter(Boolean);
              return (
                <ReviewTableRow
                  key={`${row.employee.id}-${row.review.type}`}
                  row={row}
                  allRows={allRows}
                  concurrentPairs={concurrentPairs}
                  positionName={positionMap.get(row.employee.positionId) ?? ''}
                  mgrName={row.employee.managerId ? (managerMap.get(row.employee.managerId) ?? '') : ''}
                  mgrEmail={mgrEmail}
                  duration={duration}
                  reviewTemplate={reviewTemplate}
                  extraEmails={extraEmails}
                  timeZone={timeZone}
                  onUpdateReview={onUpdateReview}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ReviewsDashboardProps {
  data: AppData;
  onUpdateReview: (employeeId: string, review: Review) => void;
}

export default function ReviewsDashboard({ data, onUpdateReview }: ReviewsDashboardProps) {
  const { isConnected } = useGoogleCalendar();
  const rows = buildRows(data);
  const positionMap = new Map(data.settings.positions.map((p) => [p.id, p.name]));
  const positionObjectMap = new Map(data.settings.positions.map((p) => [p.id, p]));
  const durationMap = new Map(data.settings.positions.map((p) => [p.id, p.duration]));
  const managerMap = new Map(data.settings.managers.map((m) => [m.id, m.name]));
  const managerEmailMap = new Map(data.settings.managers.map((m) => [m.id, m.email]));
  const reviewEmailsRecord = data.settings.reviewEmails ?? ({ 30: '', 60: '', 180: '' } as Record<ReviewType, string>);
  const concurrentPairs = data.settings.concurrentReviewPairs ?? [];
  const timeZone = data.settings.calendarTimeZone;

  const overdue = rows.filter((r) => r.status === 'overdue');
  const today = rows.filter((r) => r.status === 'today');
  const upcoming = rows.filter((r) => r.status === 'upcoming');

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ClipboardList className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">No reviews scheduled yet.</p>
        <p className="text-gray-400 text-sm mt-1">
          Add employees in the Employees tab to see their reviews here.
        </p>
      </div>
    );
  }

  const tableProps = { allRows: rows, positionMap, positionObjectMap, managerMap, managerEmailMap, durationMap, reviewEmailsRecord, concurrentPairs, timeZone, onUpdateReview };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Review Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} review{rows.length !== 1 ? 's' : ''} across{' '}
            {data.employees.length} employee{data.employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-4 text-sm flex-wrap items-center">
          {overdue.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 font-medium">
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />
              {overdue.length} overdue
            </span>
          )}
          {today.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
              {today.length} today
            </span>
          )}
          {upcoming.length > 0 && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="w-2 h-2 bg-gray-300 rounded-full inline-block" />
              {upcoming.length} upcoming
            </span>
          )}
          {!isConnected && (
            <span className="text-xs text-gray-400 italic">
              Connect Google Calendar in Settings to push events
            </span>
          )}
        </div>
      </div>

      <SectionTable
        rows={overdue}
        title="Overdue"
        headerClass="bg-red-50 text-red-800"
        {...tableProps}
      />
      <SectionTable
        rows={today}
        title="Today"
        headerClass="bg-amber-50 text-amber-800"
        {...tableProps}
      />
      <SectionTable
        rows={upcoming}
        title="Upcoming"
        headerClass="bg-gray-50 text-gray-700"
        {...tableProps}
      />
    </div>
  );
}
