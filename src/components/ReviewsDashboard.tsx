'use client';

import clsx from 'clsx';
import { AlertCircle, Clock, Calendar, ClipboardList } from 'lucide-react';
import {
  effectiveDate,
  effectiveTime,
  reviewStatus,
  daysUntil,
  displayDate,
  formatTime,
} from '@/lib/dateUtils';
import type { AppData, Employee, Review, ReviewType } from '@/lib/types';

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

interface SectionTableProps {
  rows: ReviewRow[];
  title: string;
  headerClass: string;
  positionMap: Map<string, string>;
}

function SectionTable({ rows, title, headerClass, positionMap }: SectionTableProps) {
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
              {['Employee', 'Position', 'Review', 'Date', 'Time', 'Flags', 'Status'].map(
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
            {rows.map((row) => (
              <tr
                key={`${row.employee.id}-${row.review.type}`}
                className="hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {row.employee.lastName}, {row.employee.firstName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {positionMap.get(row.employee.positionId) ?? (
                    <span className="text-gray-400 italic text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ReviewTypeBadge type={row.review.type} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                  {displayDate(row.effDate)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReviewsDashboard({ data }: { data: AppData }) {
  const rows = buildRows(data);
  const positionMap = new Map(data.settings.positions.map((p) => [p.id, p.name]));

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
        <div className="flex gap-4 text-sm flex-wrap">
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
        </div>
      </div>

      <SectionTable
        rows={overdue}
        title="Overdue"
        headerClass="bg-red-50 text-red-800"
        positionMap={positionMap}
      />
      <SectionTable
        rows={today}
        title="Today"
        headerClass="bg-amber-50 text-amber-800"
        positionMap={positionMap}
      />
      <SectionTable
        rows={upcoming}
        title="Upcoming"
        headerClass="bg-gray-50 text-gray-700"
        positionMap={positionMap}
      />
    </div>
  );
}
