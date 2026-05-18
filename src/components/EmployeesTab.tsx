'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import clsx from 'clsx';
import { Plus, Pencil, Trash2, X, Check, Users, Info, AlertTriangle, Loader2, ChevronDown, ChevronUp, ChevronRight, Briefcase } from 'lucide-react';
import {
  buildReviews,
  displayDate,
  effectiveDate,
  effectiveTime,
  formatTime,
  nextBusinessDay,
  parseLocalDate,
  toDateString,
} from '@/lib/dateUtils';
import { checkBusy, fetchDayEvents } from '@/lib/googleCalendar';
import type { CalendarEvent } from '@/lib/googleCalendar';
import { useGoogleCalendar } from '@/context/GoogleCalendarContext';
import { useRequisitions } from '@/context/RequisitionsContext';
import type { AppData, Employee, Holiday, Review, ReviewType, ScheduleEvent } from '@/lib/types';

function generateId(): string {
  return `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function autoEmail(firstName: string, lastName: string): string {
  const f = firstName.trim().toLowerCase();
  const l = lastName.trim().toLowerCase();
  if (!f && !l) return '';
  return `${f}${l[0] ?? ''}@adamspestcontrol.com`;
}

function isAutoEmail(email: string, firstName: string, lastName: string): boolean {
  return email === '' || email === autoEmail(firstName, lastName);
}

// ---------------------------------------------------------------------------
// Block schedule helpers
// ---------------------------------------------------------------------------

function parseFormattedTime(t: string): number {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

interface BlockScheduleProps {
  events: CalendarEvent[];
  reviewMin: number; // minutes since midnight for the review time
}

function BlockSchedule({ events, reviewMin }: BlockScheduleProps) {
  const WIN_START = 7 * 60;  // 7 AM
  const WIN_END   = 19 * 60; // 7 PM
  const WIN_LEN   = WIN_END - WIN_START;

  const toPct = (min: number) =>
    Math.max(0, Math.min(100, ((min - WIN_START) / WIN_LEN) * 100));

  const allDay = events.filter((e) => e.isAllDay);
  const timed  = events.filter((e) => !e.isAllDay);

  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  return (
    <div>
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {allDay.map((ev) => (
            <span key={ev.id} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
              All day: {ev.title}
            </span>
          ))}
        </div>
      )}
      <div className="relative h-48 select-none">
        {/* Hour grid */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute w-full pointer-events-none"
            style={{ top: `${toPct(h * 60)}%` }}
          >
            <div className="flex items-center gap-1">
              <span className="text-gray-300 text-[10px] w-6 shrink-0 text-right leading-none">
                {hourLabel(h)}
              </span>
              <div className="flex-1 border-t border-gray-100" />
            </div>
          </div>
        ))}

        {/* Event blocks */}
        <div className="absolute left-8 right-0 top-0 bottom-0">
          {timed.map((ev) => {
            const start = parseFormattedTime(ev.startTime);
            const end   = parseFormattedTime(ev.endTime);
            if (start < 0 || end < 0) return null;
            const top    = toPct(start);
            const bottom = toPct(end);
            const height = Math.max(2, bottom - top);
            return (
              <div
                key={ev.id}
                className="absolute left-0.5 right-0.5 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 overflow-hidden"
                style={{ top: `${top}%`, height: `${height}%` }}
              >
                <p className="text-[11px] font-medium text-blue-700 truncate leading-tight">{ev.title}</p>
                <p className="text-[10px] text-blue-400 leading-tight">{ev.startTime} – {ev.endTime}</p>
              </div>
            );
          })}

          {/* Review time marker */}
          {reviewMin >= WIN_START && reviewMin <= WIN_END && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: `${toPct(reviewMin)}%` }}
            >
              <div className="border-t-2 border-red-400 border-dashed relative">
                <span className="absolute -top-3.5 right-0 text-[10px] font-semibold text-red-500 bg-white px-1 rounded">
                  this review
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date / holiday helpers
// ---------------------------------------------------------------------------

function findHolidayName(dateStr: string, holidays: Holiday[]): string | null {
  if (!dateStr) return null;
  const d = parseLocalDate(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  for (const h of holidays) {
    if (h.recurring) {
      const [, hMonth, hDay] = h.date.split('-').map(Number);
      if (hMonth === month && hDay === day) return h.name;
    } else {
      if (h.date === dateStr) return h.name;
    }
  }
  return null;
}

/** Returns warnings for a date string (weekend / holiday). */
function getDateWarnings(dateStr: string, holidays: Holiday[]): string[] {
  if (!dateStr) return [];
  const warnings: string[] = [];
  const dow = parseLocalDate(dateStr).getDay();
  if (dow === 6) warnings.push('Falls on a Saturday');
  if (dow === 0) warnings.push('Falls on a Sunday');
  const holidayName = findHolidayName(dateStr, holidays);
  if (holidayName) warnings.push(`Falls on ${holidayName}`);
  return warnings;
}

/**
 * If the review date was moved from its raw offset date (startDate + N days),
 * return a human-readable reason. Returns null if the date was not moved.
 */
function getMovedMessage(
  startDate: string,
  days: number,
  calculatedDate: string,
  holidays: Holiday[]
): string | null {
  const base = parseLocalDate(startDate);
  base.setDate(base.getDate() + days);
  const rawDateStr = toDateString(base);
  if (rawDateStr === calculatedDate) return null;

  const dow = base.getDay();
  if (dow === 6) return `Moved from ${displayDate(rawDateStr)} — falls on a Saturday`;
  if (dow === 0) return `Moved from ${displayDate(rawDateStr)} — falls on a Sunday`;
  const holidayName = findHolidayName(rawDateStr, holidays);
  if (holidayName) return `Moved from ${displayDate(rawDateStr)} — ${holidayName}`;
  return `Moved from ${displayDate(rawDateStr)}`;
}

// ---------------------------------------------------------------------------
// Review labels / colors
// ---------------------------------------------------------------------------

const REVIEW_LABELS: Record<ReviewType, string> = {
  30: '30-Day Review',
  60: '60-Day Review',
  180: '180-Day Review',
};

const REVIEW_BADGE_COLORS: Record<ReviewType, string> = {
  30: 'bg-blue-100 text-blue-700',
  60: 'bg-orange-100 text-orange-700',
  180: 'bg-purple-100 text-purple-700',
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  id: string;
  lastName: string;
  firstName: string;
  positionId: string;
  managerId: string;
  outOfState: boolean;
  email: string;
  startDate: string;
  reviews: Review[];
}

function buildEmptyForm(): FormState {
  return {
    id: generateId(),
    lastName: '',
    firstName: '',
    positionId: '',
    managerId: '',
    outOfState: false,
    email: '',
    startDate: '',
    reviews: [],
  };
}

function employeeToForm(emp: Employee): FormState {
  return {
    id: emp.id,
    lastName: emp.lastName,
    firstName: emp.firstName,
    positionId: emp.positionId,
    managerId: emp.managerId ?? '',
    outOfState: emp.outOfState,
    email: emp.email,
    startDate: emp.startDate,
    reviews: emp.reviews,
  };
}

function formToEmployee(form: FormState): Employee {
  return {
    id: form.id,
    lastName: form.lastName,
    firstName: form.firstName,
    positionId: form.positionId,
    managerId: form.managerId || undefined,
    outOfState: form.outOfState,
    email: form.email,
    startDate: form.startDate,
    reviews: form.reviews,
  };
}

// ---------------------------------------------------------------------------
// Employee schedule preview (expanded row)
// ---------------------------------------------------------------------------

interface SchedulePreviewProps {
  emp: Employee;
  firstDaySchedule: ScheduleEvent[];
  secondDaySchedule: ScheduleEvent[];
  holidays: Holiday[];
}

function EmployeeSchedulePreview({ emp, firstDaySchedule, secondDaySchedule, holidays }: SchedulePreviewProps) {
  const day2Date = emp.startDate ? nextBusinessDay(emp.startDate, holidays) : '';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {/* Review dates */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reviews</p>
        {emp.reviews.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No reviews calculated</p>
        ) : (
          <div className="space-y-1.5">
            {(emp.reviews as Review[]).map((r) => (
              <div key={r.type} className="flex items-center gap-2">
                <span className={clsx('inline-flex px-1.5 py-0.5 rounded text-xs font-semibold', REVIEW_BADGE_COLORS[r.type])}>
                  {r.type}-Day
                </span>
                <span className="text-xs text-gray-700">{displayDate(effectiveDate(r))}</span>
                <span className="text-xs text-gray-400">{formatTime(effectiveTime(r))}</span>
                {r.overrideEnabled && <span className="text-xs text-amber-500 font-medium">Override</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day 1 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Day 1{emp.startDate ? ` — ${displayDate(emp.startDate)}` : ''}
        </p>
        {!emp.startDate ? (
          <p className="text-xs text-gray-400 italic">No start date set</p>
        ) : firstDaySchedule.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No events configured</p>
        ) : (
          <div className="space-y-1">
            {firstDaySchedule.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12 shrink-0">{formatTime(ev.startTime)}</span>
                <span className="text-xs text-gray-700">{ev.title}</span>
                <span className="text-xs text-gray-400">{ev.duration}m</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day 2 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Day 2{day2Date ? ` — ${displayDate(day2Date)}` : ''}
        </p>
        {!emp.startDate ? (
          <p className="text-xs text-gray-400 italic">No start date set</p>
        ) : secondDaySchedule.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No events configured</p>
        ) : (
          <div className="space-y-1">
            {secondDaySchedule.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12 shrink-0">{formatTime(ev.startTime)}</span>
                <span className="text-xs text-gray-700">{ev.title}</span>
                <span className="text-xs text-gray-400">{ev.duration}m</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type BusyStatus = 'idle' | 'checking' | 'busy' | 'free';
const IDLE_BUSY: Record<ReviewType, BusyStatus> = { 30: 'idle', 60: 'idle', 180: 'idle' };

interface EmployeesTabProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

export default function EmployeesTab({ data, onChange }: EmployeesTabProps) {
  const { isConnected, accessToken } = useGoogleCalendar();
  const { requisitions, save: saveReq } = useRequisitions();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(buildEmptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<Record<ReviewType, BusyStatus>>(IDLE_BUSY);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [expandedReviewPreviews, setExpandedReviewPreviews] = useState<Partial<Record<ReviewType, boolean>>>({});
  const [reviewPreviewEvents, setReviewPreviewEvents] = useState<Partial<Record<ReviewType, CalendarEvent[]>>>({});
  const [reviewPreviewLoading, setReviewPreviewLoading] = useState<Partial<Record<ReviewType, boolean>>>({});
  const [reviewPreviewError, setReviewPreviewError] = useState<Partial<Record<ReviewType, boolean>>>({});

  // Hire-from-req linkage (only used when adding a new employee)
  const [hireLink, setHireLink] = useState<{ reqId: string; applicantId: string } | null>(null);

  // Hired applicants across all reqs that haven't been linked to an employee yet
  const availableHires = useMemo(() => {
    const items: {
      reqId: string;
      applicantId: string;
      name: string;
      reqNumber: string;
      positionTitle: string;
      managerId?: string;
    }[] = [];
    for (const r of requisitions) {
      for (const a of r.applicants) {
        if (a.status !== 'hired') continue;
        if (a.hiredEmployeeId) continue;
        items.push({
          reqId: r.id,
          applicantId: a.id,
          name: a.name,
          reqNumber: r.reqNumber,
          positionTitle: r.positionTitle,
          managerId: r.hiringManagerId,
        });
      }
    }
    return items;
  }, [requisitions]);

  function applyHireFromReq(applicantId: string) {
    const item = availableHires.find((h) => h.applicantId === applicantId);
    if (!item) {
      setHireLink(null);
      return;
    }
    setHireLink({ reqId: item.reqId, applicantId: item.applicantId });
    // Parse name into first/last (best effort: "First Last" or "First Middle Last")
    const trimmed = item.name.trim();
    const parts = trimmed.split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    setForm((prev) => ({
      ...prev,
      firstName,
      lastName,
      managerId: item.managerId ?? prev.managerId,
      email: autoEmail(firstName, lastName),
    }));
  }

  function clearHireFromReq() {
    setHireLink(null);
  }

  // Key that changes whenever an effective date/time changes — drives freeBusy checks
  const reviewCheckKey = form.reviews
    .map((r) => {
      const d = r.overrideEnabled ? r.overrideDate : r.calculatedDate;
      const t = r.overrideEnabled ? r.overrideTime : r.calculatedTime;
      return `${r.type}:${d}:${t}`;
    })
    .join('|');

  // Recalculate reviews when startDate or positionId changes
  const recalcReviews = useCallback(
    (startDate: string, positionId: string, existingReviews: Review[]): Review[] => {
      if (!startDate) return existingReviews;
      return buildReviews(
        startDate,
        positionId,
        data.settings.positions,
        data.settings,
        data.holidays,
        existingReviews
      );
    },
    [data.settings, data.holidays]
  );

  useEffect(() => {
    if (!showForm) return;
    if (!form.startDate) return;
    setForm((prev) => ({
      ...prev,
      reviews: recalcReviews(prev.startDate, prev.positionId, prev.reviews),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.positionId, showForm]);

  // Reset busy status and preview cache when start date changes
  useEffect(() => {
    setBusyStatus(IDLE_BUSY);
    setExpandedReviewPreviews({});
    setReviewPreviewEvents({});
  }, [form.startDate]);

  // Run freeBusy checks (debounced 600ms) whenever effective dates/times change
  useEffect(() => {
    if (!showForm || !isConnected || !accessToken || !form.startDate || form.reviews.length === 0) return;

    const position = data.settings.positions.find((p) => p.id === form.positionId);
    const duration = position?.duration ?? data.settings.defaultDuration;
    const timeZone = data.settings.calendarTimeZone;
    let cancelled = false;

    const timer = setTimeout(async () => {
      for (const review of form.reviews) {
        if (cancelled) break;
        const effDate = review.overrideEnabled ? review.overrideDate : review.calculatedDate;
        const effTime = review.overrideEnabled ? review.overrideTime : review.calculatedTime;
        if (!effDate || !effTime) continue;

        setBusyStatus((prev) => ({ ...prev, [review.type]: 'checking' }));
        try {
          const busy = await checkBusy(accessToken, effDate, effTime, duration, timeZone);
          if (!cancelled) {
            setBusyStatus((prev) => ({ ...prev, [review.type]: busy ? 'busy' : 'free' }));
          }
        } catch {
          if (!cancelled) {
            setBusyStatus((prev) => ({ ...prev, [review.type]: 'idle' }));
          }
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewCheckKey, isConnected, accessToken, showForm]);

  async function handleToggleReviewPreview(type: ReviewType, effDate: string) {
    const next = !expandedReviewPreviews[type];
    setExpandedReviewPreviews((prev) => ({ ...prev, [type]: next }));
    if (next && reviewPreviewEvents[type] === undefined && effDate && isConnected && accessToken) {
      setReviewPreviewLoading((prev) => ({ ...prev, [type]: true }));
      setReviewPreviewError((prev) => ({ ...prev, [type]: false }));
      try {
        const events = await fetchDayEvents(accessToken, effDate, data.settings.calendarTimeZone);
        setReviewPreviewEvents((prev) => ({ ...prev, [type]: events }));
      } catch {
        setReviewPreviewError((prev) => ({ ...prev, [type]: true }));
      } finally {
        setReviewPreviewLoading((prev) => ({ ...prev, [type]: false }));
      }
    }
  }

  function handleOpenAdd() {
    setForm(buildEmptyForm());
    setEditingId(null);
    setBusyStatus(IDLE_BUSY);
    setHireLink(null);
    setShowForm(true);
  }

  function handleOpenEdit(emp: Employee) {
    setForm(employeeToForm(emp));
    setEditingId(emp.id);
    setBusyStatus(IDLE_BUSY);
    setHireLink(null);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(buildEmptyForm());
    setBusyStatus(IDLE_BUSY);
    setHireLink(null);
    setExpandedReviewPreviews({});
    setReviewPreviewEvents({});
    setReviewPreviewLoading({});
    setReviewPreviewError({});
  }

  function handleFieldChange(field: keyof FormState, value: string | boolean) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'firstName' || field === 'lastName') {
        const fn = field === 'firstName' ? (value as string) : prev.firstName;
        const ln = field === 'lastName' ? (value as string) : prev.lastName;
        if (isAutoEmail(prev.email, prev.firstName, prev.lastName)) {
          updated.email = autoEmail(fn, ln);
        }
      }
      return updated;
    });
  }

  function handleOverrideToggle(type: ReviewType, enabled: boolean) {
    setForm((prev) => ({
      ...prev,
      reviews: prev.reviews.map((r) =>
        r.type === type ? { ...r, overrideEnabled: enabled } : r
      ),
    }));
  }

  function handleOverrideDateChange(type: ReviewType, value: string) {
    setForm((prev) => ({
      ...prev,
      reviews: prev.reviews.map((r) =>
        r.type === type ? { ...r, overrideDate: value } : r
      ),
    }));
    setReviewPreviewEvents((prev) => { const next = { ...prev }; delete next[type]; return next; });
  }

  function handleOverrideTimeChange(type: ReviewType, value: string) {
    setForm((prev) => ({
      ...prev,
      reviews: prev.reviews.map((r) =>
        r.type === type ? { ...r, overrideTime: value } : r
      ),
    }));
  }

  function handleSave() {
    if (!form.lastName.trim() || !form.firstName.trim() || !form.startDate) return;
    const employee = formToEmployee(form);
    const employees = editingId
      ? data.employees.map((e) => (e.id === editingId ? employee : e))
      : [...data.employees, employee];
    onChange({ ...data, employees });

    // If this employee came from a hired applicant on a req, mark the linkage
    if (!editingId && hireLink) {
      const req = requisitions.find((r) => r.id === hireLink.reqId);
      if (req) {
        const updated = {
          ...req,
          applicants: req.applicants.map((a) =>
            a.id === hireLink.applicantId ? { ...a, hiredEmployeeId: employee.id } : a
          ),
        };
        // Fire-and-forget — surface failure quietly; primary employee save already succeeded.
        void saveReq(updated).catch(() => {});
      }
    }

    handleCancel();
  }

  function handleDelete(id: string) {
    const employees = data.employees.filter((e) => e.id !== id);
    onChange({ ...data, employees });
    setDeleteConfirm(null);
  }

  const positionMap = new Map(data.settings.positions.map((p) => [p.id, p.name]));
  const managerMap = new Map(data.settings.managers.map((m) => [m.id, m.name]));

  const sortedEmployees = [...data.employees].sort((a, b) => {
    const la = a.lastName.toLowerCase();
    const lb = b.lastName.toLowerCase();
    if (la !== lb) return la < lb ? -1 : 1;
    return a.firstName.toLowerCase() < b.firstName.toLowerCase() ? -1 : 1;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.employees.length} employee{data.employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              {editingId ? 'Edit Employee' : 'Add Employee'}
            </h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Hire from requisition (only when adding) */}
            {!editingId && availableHires.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="flex items-center gap-1.5 text-sm font-medium text-blue-900 mb-1.5">
                  <Briefcase className="w-4 h-4" />
                  Hiring from a requisition?
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={hireLink?.applicantId ?? ''}
                    onChange={(e) => {
                      if (!e.target.value) clearHireFromReq();
                      else applyHireFromReq(e.target.value);
                    }}
                    className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Pick a hired applicant to pre-fill name & manager —</option>
                    {availableHires.map((h) => (
                      <option key={h.applicantId} value={h.applicantId}>
                        {h.name} · Req #{h.reqNumber || '—'}
                        {h.positionTitle ? ` (${h.positionTitle})` : ''}
                      </option>
                    ))}
                  </select>
                  {hireLink && (
                    <button
                      type="button"
                      onClick={clearHireFromReq}
                      className="px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 rounded transition-colors"
                      title="Unlink from requisition"
                    >
                      Unlink
                    </button>
                  )}
                </div>
                {hireLink && (
                  <p className="text-xs text-blue-700 mt-1.5">
                    On save, this applicant will be marked linked to the new employee.
                  </p>
                )}
              </div>
            )}

            {/* Last / First name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John"
                />
              </div>
            </div>

            {/* Position + Manager */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  value={form.positionId}
                  onChange={(e) => handleFieldChange('positionId', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">— Select position —</option>
                  {data.settings.positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                <select
                  value={form.managerId}
                  onChange={(e) => handleFieldChange('managerId', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">— Select manager —</option>
                  {data.settings.managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Out-of-state */}
            <div className="flex items-center gap-2">
              <input
                id="oos"
                type="checkbox"
                checked={form.outOfState}
                onChange={(e) => handleFieldChange('outOfState', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="oos" className="text-sm font-medium text-gray-700">
                Out-of-State employee
              </label>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="johnsmith@adamspestcontrol.com"
              />
              <p className="text-xs text-gray-400 mt-1">Auto-populated from name. Edit to override.</p>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => handleFieldChange('startDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Review dates */}
            {form.startDate && form.reviews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Review Dates</h3>
                  {isConnected && (
                    <span className="text-xs text-gray-400">Checking against your Google Calendar</span>
                  )}
                </div>
                <div className="space-y-4">
                  {(form.reviews as Review[]).map((review) => {
                    const effDate = review.overrideEnabled ? review.overrideDate : review.calculatedDate;
                    const effTime = review.overrideEnabled ? review.overrideTime : review.calculatedTime;
                    const movedMsg = !review.overrideEnabled
                      ? getMovedMessage(form.startDate, review.type, review.calculatedDate, data.holidays)
                      : null;
                    const overrideWarnings = review.overrideEnabled
                      ? getDateWarnings(review.overrideDate, data.holidays)
                      : [];
                    const busy = busyStatus[review.type];

                    const reviewMin = effTime
                      ? parseInt(effTime.split(':')[0]) * 60 + parseInt(effTime.split(':')[1])
                      : -1;

                    return (
                      <div key={review.type} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={clsx(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                              REVIEW_BADGE_COLORS[review.type]
                            )}
                          >
                            {REVIEW_LABELS[review.type]}
                          </span>
                          {!review.overrideEnabled && (
                            <span className="text-xs text-gray-500">
                              {displayDate(effDate)} at {formatTime(effTime)}
                            </span>
                          )}
                        </div>

                        {/* Day calendar block preview */}
                        {expandedReviewPreviews[review.type] && (
                          <div className="mb-3 rounded-md bg-white border border-gray-200 px-3 pt-2 pb-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              {displayDate(effDate)}
                            </p>
                            {!isConnected && (
                              <p className="text-xs text-gray-400 pb-2">Connect Google Calendar in Settings to preview.</p>
                            )}
                            {isConnected && reviewPreviewLoading[review.type] && (
                              <div className="flex items-center gap-2 text-xs text-gray-500 pb-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Loading…
                              </div>
                            )}
                            {isConnected && reviewPreviewError[review.type] && (
                              <p className="text-xs text-red-600 pb-2">Failed to load calendar events.</p>
                            )}
                            {isConnected && !reviewPreviewLoading[review.type] && !reviewPreviewError[review.type] && reviewPreviewEvents[review.type] !== undefined && (
                              reviewPreviewEvents[review.type]!.length === 0 && reviewMin < 0 ? (
                                <p className="text-xs text-green-700 font-medium pb-2">No events — calendar is clear.</p>
                              ) : (
                                <BlockSchedule
                                  events={reviewPreviewEvents[review.type]!}
                                  reviewMin={reviewMin}
                                />
                              )
                            )}
                          </div>
                        )}

                        {/* Moved notice */}
                        {movedMsg && (
                          <div className="flex items-center gap-1.5 mt-1.5 mb-1 text-xs text-blue-700 bg-blue-50 rounded px-2.5 py-1">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            {movedMsg}
                          </div>
                        )}

                        {/* Calendar busy check */}
                        {busy === 'checking' && (
                          <div className="flex items-center gap-1.5 mt-1.5 mb-1 text-xs text-gray-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            Checking calendar...
                          </div>
                        )}
                        {busy === 'busy' && (
                          <div className="flex items-center gap-1.5 mt-1.5 mb-1 text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Scheduling conflict — something is already on your calendar at this time
                          </div>
                        )}

                        {/* Override toggle */}
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            id={`override-${review.type}`}
                            type="checkbox"
                            checked={review.overrideEnabled}
                            onChange={(e) => handleOverrideToggle(review.type, e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`override-${review.type}`} className="text-xs font-medium text-gray-600">
                            Manual Override
                          </label>
                        </div>

                        {/* Override inputs */}
                        {review.overrideEnabled && (
                          <>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                                <input
                                  type="date"
                                  value={review.overrideDate}
                                  onChange={(e) => handleOverrideDateChange(review.type, e.target.value)}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                                <input
                                  type="time"
                                  value={review.overrideTime}
                                  onChange={(e) => handleOverrideTimeChange(review.type, e.target.value)}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Override warnings (weekend / holiday) */}
                            {overrideWarnings.map((w) => (
                              <div
                                key={w}
                                className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-1"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {w}
                              </div>
                            ))}

                            {/* Override calendar conflict */}
                            {busy === 'busy' && (
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Scheduling conflict — something is already on your calendar at this time
                              </div>
                            )}
                          </>
                        )}

                        {/* Chevron — bottom right */}
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            onClick={() => handleToggleReviewPreview(review.type, effDate)}
                            title={expandedReviewPreviews[review.type] ? 'Hide calendar preview' : "See what's on your calendar this day"}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            {expandedReviewPreviews[review.type]
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.lastName.trim() || !form.firstName.trim() || !form.startDate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingId ? 'Save Changes' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee list */}
      {sortedEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
          <Users className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No employees yet.</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Employee" to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Employee', 'Position', 'Manager', 'Start Date', '30-Day', '60-Day', '180-Day', 'Flags', ''].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedEmployees.map((emp) => (
                  <Fragment key={emp.id}>
                  <tr className={clsx('hover:bg-gray-50', expandedEmployeeId === emp.id && 'bg-gray-50')}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedEmployeeId(expandedEmployeeId === emp.id ? null : emp.id)}
                          className="p-0.5 text-gray-400 hover:text-blue-600 rounded transition-colors shrink-0"
                          title="Show schedule preview"
                        >
                          {expandedEmployeeId === emp.id
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {emp.lastName}, {emp.firstName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {positionMap.get(emp.positionId) ?? (
                        <span className="text-gray-400 italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {emp.managerId ? (
                        managerMap.get(emp.managerId) ?? <span className="text-gray-400 italic text-xs">—</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {emp.startDate ? displayDate(emp.startDate) : '—'}
                    </td>
                    {([30, 60, 180] as ReviewType[]).map((type) => {
                      const review = emp.reviews.find((r) => r.type === type);
                      if (!review) {
                        return (
                          <td key={type} className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">—</td>
                        );
                      }
                      const eDate = effectiveDate(review);
                      const eTime = effectiveTime(review);
                      return (
                        <td key={type} className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs text-gray-700">{displayDate(eDate)}</div>
                          <div className="text-xs text-gray-400">{formatTime(eTime)}</div>
                          {review.overrideEnabled && (
                            <div className="text-xs text-amber-500 font-medium mt-0.5">Override</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {emp.outOfState && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                          OOS
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirm === emp.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(emp.id)}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(emp.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedEmployeeId === emp.id && (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 bg-blue-50 border-b border-gray-100">
                        <EmployeeSchedulePreview
                          emp={emp}
                          firstDaySchedule={data.settings.firstDaySchedule}
                          secondDaySchedule={data.settings.secondDaySchedule}
                          holidays={data.holidays}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
