'use client';

import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  CalendarOff,
  Loader2,
  Users2,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import type { AppData, ScheduleEvent, SchedulePushRecord } from '@/lib/types';
import { nextBusinessDay, displayDate, formatTime } from '@/lib/dateUtils';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/googleCalendar';
import { useGoogleCalendar } from '@/context/GoogleCalendarContext';

interface Props {
  data: AppData;
  onChange: (data: AppData) => void;
}

type PushKey = string; // `${templateEventId}-${day}`

function makePushKey(templateEventId: string, day: 1 | 2): PushKey {
  return `${templateEventId}-${day}`;
}

export default function SchedulingTab({ data, onChange }: Props) {
  const { accessToken } = useGoogleCalendar();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState<Record<PushKey, boolean>>({});
  const [unscheduling, setUnscheduling] = useState<Record<PushKey, boolean>>({});
  const [errors, setErrors] = useState<Record<PushKey, string>>({});

  const { settings, employees } = data;
  const day2Date = selectedDate ? nextBusinessDay(selectedDate, data.holidays) : '';

  function handleDateChange(date: string) {
    setSelectedDate(date);
    if (date) {
      const matching = new Set(
        employees.filter((e) => e.startDate === date).map((e) => e.id)
      );
      setSelectedEmployeeIds(matching);
    } else {
      setSelectedEmployeeIds(new Set());
    }
  }

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedEmployees = employees.filter((e) => selectedEmployeeIds.has(e.id));

  function findPushRecord(
    templateEventId: string,
    day: 1 | 2,
    scheduleDate: string
  ): SchedulePushRecord | undefined {
    for (const emp of employees) {
      const record = emp.schedulingPushes?.find(
        (p) =>
          p.templateEventId === templateEventId &&
          p.day === day &&
          p.scheduleDate === scheduleDate
      );
      if (record) return record;
    }
    return undefined;
  }

  async function handlePush(event: ScheduleEvent, day: 1 | 2, scheduleDate: string) {
    if (!accessToken) return;
    const key = makePushKey(event.id, day);
    setPushing((p) => ({ ...p, [key]: true }));
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });

    try {
      const attendeeEmails: string[] = [];
      if (event.inviteEmployee) {
        selectedEmployees.forEach((emp) => {
          if (emp.email) attendeeEmails.push(emp.email);
        });
      }
      if (event.inviteManager) {
        const managerIds = Array.from(
          new Set(selectedEmployees.map((e) => e.managerId).filter(Boolean) as string[])
        );
        managerIds.forEach((mid) => {
          const mgr = settings.managers.find((m) => m.id === mid);
          if (mgr?.email) attendeeEmails.push(mgr.email);
        });
      }
      if (event.additionalEmails) {
        event.additionalEmails
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((e) => attendeeEmails.push(e));
      }

      let description = event.description || '';
      if (event.prependEmployees && selectedEmployees.length > 0) {
        const names = selectedEmployees
          .map((e) => `${e.firstName} ${e.lastName}`)
          .join(', ');
        description = description
          ? `New Employees: ${names}\n\n${description}`
          : `New Employees: ${names}`;
      }

      const gcalEventId = await createCalendarEvent(
        accessToken,
        event.title,
        scheduleDate,
        event.startTime,
        event.duration,
        settings.calendarTimeZone,
        attendeeEmails,
        description || undefined
      );

      const record: SchedulePushRecord = {
        templateEventId: event.id,
        day,
        scheduleDate,
        gcalEventId,
      };

      const updatedEmployees = employees.map((emp) => {
        if (!selectedEmployeeIds.has(emp.id)) return emp;
        const pushes = (emp.schedulingPushes ?? []).filter(
          (p) =>
            !(
              p.templateEventId === event.id &&
              p.day === day &&
              p.scheduleDate === scheduleDate
            )
        );
        return { ...emp, schedulingPushes: [...pushes, record] };
      });

      onChange({ ...data, employees: updatedEmployees });
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [key]: err instanceof Error ? err.message : 'Push failed',
      }));
    } finally {
      setPushing((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleUnschedule(
    event: ScheduleEvent,
    day: 1 | 2,
    scheduleDate: string,
    gcalEventId: string
  ) {
    if (!accessToken) return;
    const key = makePushKey(event.id, day);
    setUnscheduling((u) => ({ ...u, [key]: true }));
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });

    try {
      await deleteCalendarEvent(accessToken, gcalEventId);

      const updatedEmployees = employees.map((emp) => ({
        ...emp,
        schedulingPushes: (emp.schedulingPushes ?? []).filter(
          (p) =>
            !(
              p.templateEventId === event.id &&
              p.day === day &&
              p.scheduleDate === scheduleDate
            )
        ),
      }));

      onChange({ ...data, employees: updatedEmployees });
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [key]: err instanceof Error ? err.message : 'Unschedule failed',
      }));
    } finally {
      setUnscheduling((u) => ({ ...u, [key]: false }));
    }
  }

  function renderEventRow(event: ScheduleEvent, day: 1 | 2, scheduleDate: string) {
    const key = makePushKey(event.id, day);
    const pushRecord = findPushRecord(event.id, day, scheduleDate);
    const isPushed = !!pushRecord;
    const isPushing = pushing[key];
    const isUnscheduling = unscheduling[key];
    const error = errors[key];

    const previewEmails: string[] = [];
    if (event.inviteEmployee) {
      selectedEmployees.forEach((emp) => {
        if (emp.email) previewEmails.push(emp.email);
      });
    }
    if (event.inviteManager) {
      const managerIds = Array.from(
        new Set(selectedEmployees.map((e) => e.managerId).filter(Boolean) as string[])
      );
      managerIds.forEach((mid) => {
        const mgr = settings.managers.find((m) => m.id === mid);
        if (mgr?.email) previewEmails.push(mgr.email);
      });
    }
    if (event.additionalEmails) {
      event.additionalEmails
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((e) => previewEmails.push(e));
    }

    return (
      <tr key={event.id} className="border-b border-gray-100 last:border-0">
        <td className="py-3 px-4">
          <div className="font-medium text-gray-900 text-sm">{event.title}</div>
          {event.description && (
            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {event.description}
            </div>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
          {formatTime(event.startTime)}
        </td>
        <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
          {event.duration} min
        </td>
        <td className="py-3 px-4">
          <div className="text-xs text-gray-500 max-w-sm">
            {previewEmails.length > 0 ? (
              previewEmails.join(', ')
            ) : (
              <span className="italic">No attendees</span>
            )}
          </div>
        </td>
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {error && (
              <span title={error}>
                <AlertCircle className="w-4 h-4 text-red-500 cursor-help" />
              </span>
            )}
            {isPushed ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Synced
                </span>
                <button
                  onClick={() =>
                    handleUnschedule(event, day, scheduleDate, pushRecord!.gcalEventId)
                  }
                  disabled={isUnscheduling || !accessToken}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                >
                  {isUnscheduling ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CalendarOff className="w-3 h-3" />
                  )}
                  {isUnscheduling ? 'Removing…' : 'Unschedule'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePush(event, day, scheduleDate)}
                disabled={isPushing || !accessToken || selectedEmployees.length === 0}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isPushing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                {isPushing ? 'Pushing…' : 'Push'}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function renderDaySection(
    title: string,
    events: ScheduleEvent[],
    day: 1 | 2,
    scheduleDate: string
  ) {
    if (events.length === 0) return null;
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800 text-sm">
            {title} — {displayDate(scheduleDate)}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Event</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Time</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Duration</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Attendees</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => renderEventRow(event, day, scheduleDate))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hasDay1Events = settings.firstDaySchedule.length > 0;
  const hasDay2Events = settings.secondDaySchedule.length > 0;
  const noEvents = !hasDay1Events && !hasDay2Events;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schedule Date (Day 1)
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Users2 className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Employees</span>
              {selectedEmployees.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {selectedEmployees.length} selected
                </span>
              )}
            </div>
            {employees.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No employees added yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => {
                  const isChecked = selectedEmployeeIds.has(emp.id);
                  const isAutoMatch = selectedDate && emp.startDate === selectedDate;
                  return (
                    <label
                      key={emp.id}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer select-none transition-colors',
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployee(emp.id)}
                        className="sr-only"
                      />
                      {emp.firstName} {emp.lastName}
                      {isAutoMatch && (
                        <span
                          className={clsx(
                            'text-[10px] font-bold',
                            isChecked ? 'text-blue-200' : 'text-blue-500'
                          )}
                          title="Start date matches selected day"
                        >
                          ★
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {!accessToken && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Google Calendar is not connected. Connect in Settings to push events.
        </div>
      )}

      {!selectedDate && (
        <p className="text-center text-gray-400 text-sm py-8">
          Select a date to see schedule events.
        </p>
      )}

      {selectedDate && noEvents && (
        <p className="text-center text-gray-400 text-sm py-8">
          No schedule events configured. Add events in Settings under First Day / Second Day
          Schedule.
        </p>
      )}

      {selectedDate &&
        hasDay1Events &&
        renderDaySection('Day 1', settings.firstDaySchedule, 1, selectedDate)}

      {selectedDate &&
        hasDay2Events &&
        day2Date &&
        renderDaySection('Day 2', settings.secondDaySchedule, 2, day2Date)}
    </div>
  );
}
