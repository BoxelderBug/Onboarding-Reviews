'use client';

import { useState } from 'react';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import type { AppData, Holiday } from '@/lib/types';

function generateId(): string {
  return `hol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface HolidaysTabProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

interface HolidayForm {
  name: string;
  date: string;
  recurring: boolean;
}

function emptyForm(): HolidayForm {
  return { name: '', date: '', recurring: false };
}

export default function HolidaysTab({ data, onChange }: HolidaysTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HolidayForm>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleAdd() {
    if (!form.name.trim() || !form.date) return;
    const holiday: Holiday = {
      id: generateId(),
      name: form.name.trim(),
      date: form.date,
      recurring: form.recurring,
    };
    const holidays = [...data.holidays, holiday];
    onChange({ ...data, holidays });
    setForm(emptyForm());
    setShowForm(false);
  }

  function handleDelete(id: string) {
    const holidays = data.holidays.filter((h) => h.id !== id);
    onChange({ ...data, holidays });
    setDeleteConfirm(null);
  }

  function formatHolidayDate(date: string, recurring: boolean): string {
    if (!date) return '—';
    const [, month, day] = date.split('-');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const m = parseInt(month, 10);
    if (recurring) {
      return `${months[m - 1]} ${parseInt(day, 10)} (every year)`;
    }
    return date;
  }

  const sortedHolidays = [...data.holidays].sort((a, b) => {
    // Sort by month-day
    const [, am, ad] = a.date.split('-');
    const [, bm, bd] = b.date.split('-');
    const aKey = `${am}-${ad}`;
    const bKey = `${bm}-${bd}`;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Holidays</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.holidays.length} holiday{data.holidays.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Holiday
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">New Holiday</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Holiday Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Veterans Day"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {form.recurring && (
                <p className="text-xs text-gray-400 mt-1">
                  Year is ignored for recurring holidays — only month and day are used.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="recurring"
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                Recurring (repeats every year)
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm());
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || !form.date}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Holiday
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday list */}
      {sortedHolidays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
          <CalendarDays className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No holidays configured.</p>
          <p className="text-gray-400 text-sm mt-1">Add holidays to block review scheduling on those dates.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedHolidays.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {h.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatHolidayDate(h.date, h.recurring)}
                  </td>
                  <td className="px-4 py-3">
                    {h.recurring ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Recurring
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        One-time
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === h.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-500">Delete?</span>
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(h.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
