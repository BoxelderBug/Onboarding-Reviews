'use client';

import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Plus, Pencil, Trash2, X, Check, Users } from 'lucide-react';
import { buildReviews, displayDate, effectiveDate, effectiveTime, formatTime } from '@/lib/dateUtils';
import type { AppData, Employee, Review, ReviewType } from '@/lib/types';

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

interface ReviewTypeLabels {
  30: string;
  60: string;
  180: string;
}
const REVIEW_LABELS: ReviewTypeLabels = {
  30: '30-Day Review',
  60: '60-Day Review',
  180: '180-Day Review',
};

const REVIEW_BADGE_COLORS: Record<ReviewType, string> = {
  30: 'bg-blue-100 text-blue-700',
  60: 'bg-orange-100 text-orange-700',
  180: 'bg-purple-100 text-purple-700',
};

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

interface EmployeesTabProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

export default function EmployeesTab({ data, onChange }: EmployeesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(buildEmptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  function handleOpenAdd() {
    setForm(buildEmptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function handleOpenEdit(emp: Employee) {
    setForm(employeeToForm(emp));
    setEditingId(emp.id);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(buildEmptyForm());
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
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
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
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
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
                <h3 className="text-sm font-medium text-gray-700 mb-3">Review Dates</h3>
                <div className="space-y-4">
                  {(form.reviews as Review[]).map((review) => {
                    const calcDate = review.calculatedDate;
                    const calcTime = review.calculatedTime;
                    const effDate = review.overrideEnabled ? review.overrideDate : calcDate;
                    const effTime = review.overrideEnabled ? review.overrideTime : calcTime;

                    return (
                      <div key={review.type} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
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

                        {review.overrideEnabled && (
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
                        )}
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
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {emp.lastName}, {emp.firstName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {positionMap.get(emp.positionId) ?? (
                        <span className="text-gray-400 italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {emp.managerId ? (
                        managerMap.get(emp.managerId) ?? (
                          <span className="text-gray-400 italic text-xs">—</span>
                        )
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
                          <td key={type} className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            —
                          </td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
