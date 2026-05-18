'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  Plus, Pencil, Trash2, Check, X, Settings2, Users, Calendar, Wifi, WifiOff,
  MapPin, RefreshCw, Loader2, ChevronDown, ChevronRight, Briefcase, Tag, Gauge,
} from 'lucide-react';
import type {
  AppData, ApplicantStatusConfig, Interviewer, Location, Position, Manager,
  ReviewType, ScheduleEvent, ScoreColor, ScoreOption, Settings,
} from '@/lib/types';
import {
  DEFAULT_APPLICANT_STATUSES, DEFAULT_INTERVIEW_SCORE_OPTIONS, DEFAULT_JOB_SOURCES,
  DEFAULT_PHONE_SCORE_OPTIONS,
} from '@/lib/storage';
import { fetchCalendarRooms } from '@/lib/googleCalendar';
import { useGoogleCalendar } from '@/context/GoogleCalendarContext';

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const CONCURRENT_PAIRS: { key: string; a: ReviewType; b: ReviewType }[] = [
  { key: '30-30',   a: 30,  b: 30  },
  { key: '30-60',   a: 30,  b: 60  },
  { key: '30-180',  a: 30,  b: 180 },
  { key: '60-60',   a: 60,  b: 60  },
  { key: '60-180',  a: 60,  b: 180 },
  { key: '180-180', a: 180, b: 180 },
];

const REVIEW_BADGE: Record<ReviewType, string> = {
  30: 'bg-blue-100 text-blue-700',
  60: 'bg-orange-100 text-orange-700',
  180: 'bg-purple-100 text-purple-700',
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
];

// ---------------------------------------------------------------------------
// Schedule Day Section (reused for Day 1 and Day 2)
// ---------------------------------------------------------------------------

interface ScheduleEventForm {
  id: string;
  title: string;
  description: string;
  prependEmployees: boolean;
  locationText: string;
  locationId: string;
  startTime: string;
  duration: string;
  inviteEmployee: boolean;
  inviteManager: boolean;
  additionalEmails: string;
}

function emptyEventForm(): ScheduleEventForm {
  return {
    id: generateId(), title: '', description: '', prependEmployees: false,
    locationText: '', locationId: '', startTime: '09:00', duration: '60',
    inviteEmployee: true, inviteManager: true, additionalEmails: '',
  };
}

function eventToForm(e: ScheduleEvent): ScheduleEventForm {
  return {
    id: e.id, title: e.title, description: e.description,
    prependEmployees: e.prependEmployees ?? false,
    locationText: e.locationText ?? '',
    locationId: e.locationId ?? '',
    startTime: e.startTime, duration: String(e.duration),
    inviteEmployee: e.inviteEmployee, inviteManager: e.inviteManager,
    additionalEmails: e.additionalEmails,
  };
}

interface ScheduleDaySectionProps {
  title: string;
  events: ScheduleEvent[];
  locations: Location[];
  onChange: (events: ScheduleEvent[]) => void;
}

function ScheduleDaySection({ title, events, locations, onChange }: ScheduleDaySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleEventForm>(emptyEventForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleOpenAdd() {
    setForm(emptyEventForm());
    setEditingId(null);
    setShowForm(true);
  }

  function handleOpenEdit(e: ScheduleEvent) {
    setForm(eventToForm(e));
    setEditingId(e.id);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyEventForm());
  }

  function handleSave() {
    if (!form.title.trim() || !form.startTime) return;
    const event: ScheduleEvent = {
      id: editingId ?? form.id,
      title: form.title.trim(),
      description: form.description.trim(),
      prependEmployees: form.prependEmployees,
      locationText: form.locationText.trim() || undefined,
      locationId: form.locationId || undefined,
      startTime: form.startTime,
      duration: parseInt(form.duration, 10) || 60,
      inviteEmployee: form.inviteEmployee,
      inviteManager: form.inviteManager,
      additionalEmails: form.additionalEmails.trim(),
    };
    const updated = editingId
      ? events.map((e) => (e.id === editingId ? event : e))
      : [...events, event];
    onChange(updated);
    handleCancel();
  }

  function handleDelete(id: string) {
    onChange(events.filter((e) => e.id !== id));
    setDeleteConfirm(null);
  }

  function inviteSummary(e: ScheduleEvent): string {
    const parts: string[] = [];
    if (e.inviteEmployee) parts.push('Employee');
    if (e.inviteManager) parts.push('Manager');
    const extras = e.additionalEmails.split(',').map((s) => s.trim()).filter(Boolean);
    if (extras.length > 0) parts.push(`+${extras.length} email${extras.length > 1 ? 's' : ''}`);
    return parts.join(', ') || '—';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {!showForm && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingId ? 'Edit Event' : 'New Event'}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Orientation Meeting"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Optional agenda or notes"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.prependEmployees}
                  onChange={(e) => setForm((f) => ({ ...f, prependEmployees: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  List employees at the top of the description
                </span>
              </label>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={form.locationText}
                onChange={(e) => setForm((f) => ({ ...f, locationText: e.target.value, locationId: '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Conference Room A, 730 Tower Drive"
              />
              {locations.length > 0 && (
                <select
                  value={form.locationId}
                  onChange={(e) => {
                    const loc = locations.find((l) => l.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      locationId: e.target.value,
                      locationText: loc ? loc.name : f.locationText,
                    }));
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white mt-2"
                >
                  <option value="">— Or pick a saved room (fills text above) —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Time + Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (min) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Invites */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invite to Event</label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.inviteEmployee}
                    onChange={(e) => setForm((f) => ({ ...f, inviteEmployee: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Employee
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.inviteManager}
                    onChange={(e) => setForm((f) => ({ ...f, inviteManager: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Manager <span className="text-xs text-gray-400">(uses employee&apos;s assigned manager)</span>
                </label>
              </div>
            </div>

            {/* Additional emails */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Recipients</label>
              <input
                type="text"
                value={form.additionalEmails}
                onChange={(e) => setForm((f) => ({ ...f, additionalEmails: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email1@company.com, email2@company.com"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated email addresses.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.title.trim() || !form.startTime}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-4 h-4" />
              {editingId ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
          <Calendar className="w-7 h-7 text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No events for this day.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Event', 'Time', 'Duration', 'Invite', ''].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{ev.title}</div>
                    {ev.description && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{ev.description}</div>
                    )}
                    {(ev.locationText || ev.locationId) && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {ev.locationText || locations.find((l) => l.id === ev.locationId)?.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{ev.startTime}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{ev.duration} min</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{inviteSummary(ev)}</td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === ev.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-500">Delete?</span>
                        <button onClick={() => handleDelete(ev.id)} className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenEdit(ev)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(ev.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
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

// ---------------------------------------------------------------------------
// Position form
// ---------------------------------------------------------------------------

interface PositionForm {
  id: string;
  name: string;
  startTime: string;
  duration: string;
  t30title: string; t30desc: string; t30emails: string;
  t60title: string; t60desc: string; t60emails: string;
  t180title: string; t180desc: string; t180emails: string;
}

function emptyPositionForm(): PositionForm {
  return {
    id: generateId(), name: '', startTime: '09:00', duration: '30',
    t30title: '', t30desc: '', t30emails: '',
    t60title: '', t60desc: '', t60emails: '',
    t180title: '', t180desc: '', t180emails: '',
  };
}

function positionToForm(p: Position): PositionForm {
  return {
    id: p.id, name: p.name, startTime: p.startTime, duration: String(p.duration),
    t30title: p.reviewTemplates?.[30]?.title ?? '',
    t30desc:  p.reviewTemplates?.[30]?.description ?? '',
    t30emails: p.reviewTemplates?.[30]?.additionalEmails ?? '',
    t60title: p.reviewTemplates?.[60]?.title ?? '',
    t60desc:  p.reviewTemplates?.[60]?.description ?? '',
    t60emails: p.reviewTemplates?.[60]?.additionalEmails ?? '',
    t180title: p.reviewTemplates?.[180]?.title ?? '',
    t180desc:  p.reviewTemplates?.[180]?.description ?? '',
    t180emails: p.reviewTemplates?.[180]?.additionalEmails ?? '',
  };
}

// ---------------------------------------------------------------------------
// Location form
// ---------------------------------------------------------------------------

interface LocationForm {
  id: string;
  name: string;
  resourceEmail: string;
}

function emptyLocationForm(): LocationForm {
  return { id: generateId(), name: '', resourceEmail: '' };
}

function locationToForm(l: Location): LocationForm {
  return { id: l.id, name: l.name, resourceEmail: l.resourceEmail ?? '' };
}

// ---------------------------------------------------------------------------
// Manager form
// ---------------------------------------------------------------------------

interface ManagerForm {
  id: string;
  name: string;
  email: string;
}

function emptyManagerForm(): ManagerForm {
  return { id: generateId(), name: '', email: '' };
}

function managerToForm(m: Manager): ManagerForm {
  return { id: m.id, name: m.name, email: m.email };
}

// ---------------------------------------------------------------------------
// Main SettingsTab
// ---------------------------------------------------------------------------

interface SettingsTabProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

export default function SettingsTab({ data, onChange }: SettingsTabProps) {
  const settings = data.settings;
  const { isReady, isConnected, accessToken, connect, disconnect } = useGoogleCalendar();

  const [showAddPosition, setShowAddPosition] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm());
  const [deletePositionConfirm, setDeletePositionConfirm] = useState<string | null>(null);
  const [showPositionTemplates, setShowPositionTemplates] = useState(false);

  const [showAddManager, setShowAddManager] = useState(false);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [managerForm, setManagerForm] = useState<ManagerForm>(emptyManagerForm());
  const [deleteManagerConfirm, setDeleteManagerConfirm] = useState<string | null>(null);

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState<LocationForm>(emptyLocationForm());
  const [deleteLocationConfirm, setDeleteLocationConfirm] = useState<string | null>(null);
  const [fetchingRooms, setFetchingRooms] = useState(false);
  const [fetchRoomsMsg, setFetchRoomsMsg] = useState<string | null>(null);

  const [defaultTime, setDefaultTime] = useState(settings.defaultStartTime);
  const [defaultTimeSaved, setDefaultTimeSaved] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(String(settings.defaultDuration));
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [showLocations, setShowLocations] = useState(false);

  const [timezone, setTimezone] = useState(settings.calendarTimeZone);
  const [timezoneSaved, setTimezoneSaved] = useState(false);

  function updateSettings(partial: Partial<Settings>) {
    onChange({ ...data, settings: { ...settings, ...partial } });
  }

  // --- Positions ---

  function handleOpenAddPosition() { setPositionForm(emptyPositionForm()); setEditingPositionId(null); setShowPositionTemplates(false); setShowAddPosition(true); }
  function handleOpenEditPosition(pos: Position) { setPositionForm(positionToForm(pos)); setEditingPositionId(pos.id); setShowPositionTemplates(!!pos.reviewTemplates); setShowAddPosition(true); }
  function handleCancelPosition() { setShowAddPosition(false); setEditingPositionId(null); setPositionForm(emptyPositionForm()); setShowPositionTemplates(false); }

  function handleSavePosition() {
    const name = positionForm.name.trim();
    if (!name || !positionForm.startTime) return;
    const rt: Position['reviewTemplates'] = {};
    if (positionForm.t30title || positionForm.t30desc || positionForm.t30emails)
      rt[30] = { title: positionForm.t30title.trim(), description: positionForm.t30desc.trim(), additionalEmails: positionForm.t30emails.trim() || undefined };
    if (positionForm.t60title || positionForm.t60desc || positionForm.t60emails)
      rt[60] = { title: positionForm.t60title.trim(), description: positionForm.t60desc.trim(), additionalEmails: positionForm.t60emails.trim() || undefined };
    if (positionForm.t180title || positionForm.t180desc || positionForm.t180emails)
      rt[180] = { title: positionForm.t180title.trim(), description: positionForm.t180desc.trim(), additionalEmails: positionForm.t180emails.trim() || undefined };
    const position: Position = {
      id: editingPositionId ?? positionForm.id, name,
      startTime: positionForm.startTime, duration: parseInt(positionForm.duration, 10) || 30,
      reviewTemplates: Object.keys(rt).length > 0 ? rt : undefined,
    };
    const positions = editingPositionId
      ? settings.positions.map((p) => (p.id === editingPositionId ? position : p))
      : [...settings.positions, position];
    updateSettings({ positions });
    handleCancelPosition();
  }

  function handleDeletePosition(id: string) { updateSettings({ positions: settings.positions.filter((p) => p.id !== id) }); setDeletePositionConfirm(null); }

  // --- Managers ---

  function handleOpenAddManager() { setManagerForm(emptyManagerForm()); setEditingManagerId(null); setShowAddManager(true); }
  function handleOpenEditManager(mgr: Manager) { setManagerForm(managerToForm(mgr)); setEditingManagerId(mgr.id); setShowAddManager(true); }
  function handleCancelManager() { setShowAddManager(false); setEditingManagerId(null); setManagerForm(emptyManagerForm()); }

  function handleSaveManager() {
    const name = managerForm.name.trim();
    if (!name) return;
    const manager: Manager = { id: editingManagerId ?? managerForm.id, name, email: managerForm.email.trim() };
    const managers = editingManagerId
      ? settings.managers.map((m) => (m.id === editingManagerId ? manager : m))
      : [...settings.managers, manager];
    updateSettings({ managers });
    handleCancelManager();
  }

  function handleDeleteManager(id: string) { updateSettings({ managers: settings.managers.filter((m) => m.id !== id) }); setDeleteManagerConfirm(null); }

  // --- Locations ---

  function handleOpenAddLocation() { setLocationForm(emptyLocationForm()); setEditingLocationId(null); setShowAddLocation(true); }
  function handleOpenEditLocation(loc: Location) { setLocationForm(locationToForm(loc)); setEditingLocationId(loc.id); setShowAddLocation(true); }
  function handleCancelLocation() { setShowAddLocation(false); setEditingLocationId(null); setLocationForm(emptyLocationForm()); }

  function handleSaveLocation() {
    const name = locationForm.name.trim();
    if (!name) return;
    const location: Location = {
      id: editingLocationId ?? locationForm.id,
      name,
      resourceEmail: locationForm.resourceEmail.trim() || undefined,
    };
    const locations = editingLocationId
      ? settings.locations.map((l) => (l.id === editingLocationId ? location : l))
      : [...settings.locations, location];
    updateSettings({ locations });
    handleCancelLocation();
  }

  function handleDeleteLocation(id: string) {
    updateSettings({ locations: settings.locations.filter((l) => l.id !== id) });
    setDeleteLocationConfirm(null);
  }

  async function handleFetchRooms() {
    if (!accessToken) return;
    setFetchingRooms(true);
    setFetchRoomsMsg(null);
    try {
      const rooms = await fetchCalendarRooms(accessToken);
      if (rooms.length === 0) {
        setFetchRoomsMsg('No room resources found in your Google Calendar.');
        return;
      }
      const existingEmails = new Set(settings.locations.map((l) => l.resourceEmail).filter(Boolean));
      const newRooms = rooms.filter((r) => !existingEmails.has(r.resourceEmail));
      if (newRooms.length === 0) {
        setFetchRoomsMsg('All rooms are already in the list.');
        return;
      }
      const added: Location[] = newRooms.map((r) => ({
        id: generateId(),
        name: r.name,
        resourceEmail: r.resourceEmail,
      }));
      updateSettings({ locations: [...settings.locations, ...added] });
      setFetchRoomsMsg(`Added ${added.length} room${added.length > 1 ? 's' : ''}.`);
    } catch {
      setFetchRoomsMsg('Failed to fetch rooms. Make sure Google Calendar is connected.');
    } finally {
      setFetchingRooms(false);
      setTimeout(() => setFetchRoomsMsg(null), 4000);
    }
  }

  // --- Defaults ---

  function handleSaveDefaultTime() {
    if (!defaultTime) return;
    updateSettings({ defaultStartTime: defaultTime });
    setDefaultTimeSaved(true);
    setTimeout(() => setDefaultTimeSaved(false), 2000);
  }

  function handleSaveDefaults() {
    const dur = parseInt(defaultDuration, 10);
    if (isNaN(dur) || dur < 1) return;
    updateSettings({ defaultDuration: dur });
    setDefaultsSaved(true);
    setTimeout(() => setDefaultsSaved(false), 2000);
  }

  function handleSaveTimezone() {
    if (!timezone) return;
    updateSettings({ calendarTimeZone: timezone });
    setTimezoneSaved(true);
    setTimeout(() => setTimezoneSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure positions, managers, schedule templates, and defaults.</p>
      </div>

      {/* Positions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Positions</h2>
          {!showAddPosition && (
            <button onClick={handleOpenAddPosition} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />Add Position
            </button>
          )}
        </div>

        {showAddPosition && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{editingPositionId ? 'Edit Position' : 'New Position'}</h3>
              <button onClick={handleCancelPosition} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={positionForm.name} onChange={(e) => setPositionForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Technician" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                <input type="time" value={positionForm.startTime} onChange={(e) => setPositionForm((f) => ({ ...f, startTime: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min) <span className="text-red-500">*</span></label>
                <input type="number" min="1" max="480" value={positionForm.duration} onChange={(e) => setPositionForm((f) => ({ ...f, duration: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Review Event Templates (collapsible) */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPositionTemplates((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
              >
                <span>Review Event Templates <span className="text-xs text-gray-400 font-normal ml-1">(optional — custom title/description per review type)</span></span>
                {showPositionTemplates ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showPositionTemplates && (
                <div className="p-4 space-y-4 bg-white">
                  <p className="text-xs text-gray-400">Use <code className="bg-gray-100 px-1 rounded">[employee]</code> for full name or <code className="bg-gray-100 px-1 rounded">[employeefirst]</code> for first name. Leave blank to use the default title.</p>
                  {([30, 60, 180] as ReviewType[]).map((type) => {
                    const titleKey = `t${type}title` as keyof PositionForm;
                    const descKey = `t${type}desc` as keyof PositionForm;
                    const emailsKey = `t${type}emails` as keyof PositionForm;
                    const colors: Record<ReviewType, string> = { 30: 'text-blue-700', 60: 'text-orange-700', 180: 'text-purple-700' };
                    return (
                      <div key={type} className="space-y-2">
                        <p className={`text-xs font-semibold ${colors[type]}`}>{type}-Day Review</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                            <input
                              type="text"
                              value={positionForm[titleKey] as string}
                              onChange={(e) => setPositionForm((f) => ({ ...f, [titleKey]: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`e.g. ${type}-Day Review: [employee]`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <input
                              type="text"
                              value={positionForm[descKey] as string}
                              onChange={(e) => setPositionForm((f) => ({ ...f, [descKey]: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Optional agenda or notes"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Additional Invites</label>
                          <input
                            type="text"
                            value={positionForm[emailsKey] as string}
                            onChange={(e) => setPositionForm((f) => ({ ...f, [emailsKey]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="email1@company.com, email2@company.com"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button onClick={handleCancelPosition} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSavePosition} disabled={!positionForm.name.trim()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <Check className="w-4 h-4" />{editingPositionId ? 'Save Changes' : 'Add Position'}
              </button>
            </div>
          </div>
        )}

        {settings.positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <Settings2 className="w-8 h-8 text-gray-300 mb-2" /><p className="text-gray-500 text-sm">No positions configured.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>{['Name', 'Start Time', 'Duration (min)', ''].map((col) => <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>)}</tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {settings.positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{pos.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pos.startTime}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pos.duration}</td>
                    <td className="px-4 py-3 text-right">
                      {deletePositionConfirm === pos.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button onClick={() => handleDeletePosition(pos.id)} className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
                          <button onClick={() => setDeletePositionConfirm(null)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEditPosition(pos)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeletePositionConfirm(pos.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback default start time */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-gray-600 shrink-0">Fallback start time <span className="text-xs text-gray-400">(used when employee has no position)</span></span>
          <input
            type="time"
            value={defaultTime}
            onChange={(e) => setDefaultTime(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveDefaultTime}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />Save
          </button>
          {defaultTimeSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </div>

      {/* Managers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Managers</h2>
          {!showAddManager && (
            <button onClick={handleOpenAddManager} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />Add Manager
            </button>
          )}
        </div>

        {showAddManager && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{editingManagerId ? 'Edit Manager' : 'New Manager'}</h3>
              <button onClick={handleCancelManager} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={managerForm.name} onChange={(e) => setManagerForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={managerForm.email} onChange={(e) => setManagerForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jsmith@adamspestcontrol.com" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
              <button onClick={handleCancelManager} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSaveManager} disabled={!managerForm.name.trim()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <Check className="w-4 h-4" />{editingManagerId ? 'Save Changes' : 'Add Manager'}
              </button>
            </div>
          </div>
        )}

        {settings.managers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <Users className="w-8 h-8 text-gray-300 mb-2" /><p className="text-gray-500 text-sm">No managers configured.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>{['Name', 'Email', ''].map((col) => <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>)}</tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {settings.managers.map((mgr) => (
                  <tr key={mgr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{mgr.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{mgr.email || <span className="text-gray-400 italic text-xs">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {deleteManagerConfirm === mgr.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button onClick={() => handleDeleteManager(mgr.id)} className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
                          <button onClick={() => setDeleteManagerConfirm(null)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEditManager(mgr)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteManagerConfirm(mgr.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Requisition Tracker — grouped */}
      <div className="border-2 border-blue-100 rounded-xl p-5 bg-blue-50/30 space-y-6">
        <div className="flex items-center gap-2 -mt-1">
          <Briefcase className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Requisition Tracker</h2>
        </div>
        <p className="text-sm text-gray-500 -mt-4">
          These lists populate the dropdowns and pickers when entering applicants on a requisition.
        </p>

        {/* Job Sources */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Job Sources</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Where applicants come from and where you post reqs (Indeed, Website, EE Referral, NPMA, etc.).
          </p>
          <JobSourcesEditor
            values={settings.jobSources}
            onChange={(jobSources) => updateSettings({ jobSources })}
          />
        </div>

        {/* Interviewers */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Interviewers</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            People who can be assigned to interview an applicant.
          </p>
          <InterviewersEditor
            values={settings.interviewers}
            onChange={(interviewers) => updateSettings({ interviewers })}
          />
        </div>

        {/* Phone Interview Scores */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Phone Interview Scores</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Score buttons shown for phone interview ratings.
          </p>
          <ScoreOptionsEditor
            values={settings.phoneScoreOptions}
            defaults={DEFAULT_PHONE_SCORE_OPTIONS}
            onChange={(phoneScoreOptions) => updateSettings({ phoneScoreOptions })}
          />
        </div>

        {/* Interview Scores */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Interview Scores</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Score buttons shown for in-person interview ratings.
          </p>
          <ScoreOptionsEditor
            values={settings.interviewScoreOptions}
            defaults={DEFAULT_INTERVIEW_SCORE_OPTIONS}
            onChange={(interviewScoreOptions) => updateSettings({ interviewScoreOptions })}
          />
        </div>

        {/* Applicant Statuses */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Applicant Statuses</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Pipeline statuses for each applicant. The <em>category</em> determines which bucket the applicant falls into in the funnel sidebar.
          </p>
          <ApplicantStatusesEditor
            statuses={settings.applicantStatuses}
            onChange={(applicantStatuses) => updateSettings({ applicantStatuses })}
          />
        </div>
      </div>

      {/* Concurrent Review Scheduling */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Concurrent Review Scheduling</h2>
        <p className="text-sm text-gray-500 mb-4">
          Check the pairs that can intentionally overlap. When both reviews are already on the calendar at the same time, the conflict warning is suppressed for those combinations.
        </p>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {CONCURRENT_PAIRS.map(({ key, a, b }) => {
            const pairs = settings.concurrentReviewPairs ?? [];
            const checked = pairs.includes(key);
            return (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const updated = checked
                      ? pairs.filter((k) => k !== key)
                      : [...pairs, key];
                    updateSettings({ concurrentReviewPairs: updated });
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${REVIEW_BADGE[a]}`}>{a}-Day</span>
                  <span className="text-gray-400">+</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${REVIEW_BADGE[b]}`}>{b}-Day</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Locations */}
      <div>
        <button
          type="button"
          onClick={() => setShowLocations((v) => !v)}
          className="w-full flex items-center justify-between mb-1 group"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Meeting Room Locations</h2>
            {settings.locations.length > 0 && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {settings.locations.length}
              </span>
            )}
          </div>
          {showLocations
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {showLocations && (
        <>
        <div className="flex items-center justify-end gap-2 mb-4">
          {isConnected && (
            <button
              onClick={handleFetchRooms}
              disabled={fetchingRooms}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {fetchingRooms
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              Import from Google Calendar
            </button>
          )}
          {!showAddLocation && (
            <button
              onClick={handleOpenAddLocation}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />Add Location
            </button>
          )}
        </div>

        {fetchRoomsMsg && (
          <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
            {fetchRoomsMsg}
          </p>
        )}

        {showAddLocation && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingLocationId ? 'Edit Location' : 'New Location'}
              </h3>
              <button onClick={handleCancelLocation} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Conference Room A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resource Email
                  <span className="text-xs text-gray-400 font-normal ml-1">(optional — for room booking)</span>
                </label>
                <input
                  type="email"
                  value={locationForm.resourceEmail}
                  onChange={(e) => setLocationForm((f) => ({ ...f, resourceEmail: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="c_room@resource.calendar.google.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
              <button onClick={handleCancelLocation} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={!locationForm.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingLocationId ? 'Save Changes' : 'Add Location'}
              </button>
            </div>
          </div>
        )}

        {settings.locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <MapPin className="w-7 h-7 text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No locations configured.</p>
            <p className="text-gray-400 text-xs mt-1">
              Add manually or import from Google Calendar if connected.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Resource Email', ''].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {settings.locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{loc.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {loc.resourceEmail
                        ? <span className="font-mono text-xs">{loc.resourceEmail}</span>
                        : <span className="text-gray-400 italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deleteLocationConfirm === loc.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button onClick={() => handleDeleteLocation(loc.id)} className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
                          <button onClick={() => setDeleteLocationConfirm(null)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEditLocation(loc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteLocationConfirm(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
      </div>

      {/* First Day Schedule */}
      <ScheduleDaySection
        title="First Day Schedule"
        events={settings.firstDaySchedule}
        locations={settings.locations}
        onChange={(firstDaySchedule) => updateSettings({ firstDaySchedule })}
      />

      {/* Second Day Schedule */}
      <ScheduleDaySection
        title="Second Day Schedule"
        events={settings.secondDaySchedule}
        locations={settings.locations}
        onChange={(secondDaySchedule) => updateSettings({ secondDaySchedule })}
      />

      {/* Default Duration */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Default Duration</h2>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-4">Fallback review duration when an employee has no position assigned.</p>
          <div className="flex items-center gap-3 max-w-xs">
            <input type="number" min="1" max="480" value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-gray-500 shrink-0">min</span>
            <button onClick={handleSaveDefaults} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0">
              <Check className="w-4 h-4" />Save
            </button>
            {defaultsSaved && <span className="text-sm text-green-600 font-medium shrink-0">Saved!</span>}
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Google Calendar</h2>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-5">
          <div>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                    <Wifi className="w-4 h-4" />Connected to Google Calendar
                  </span>
                  <button onClick={disconnect} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <WifiOff className="w-4 h-4" />Disconnect
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><WifiOff className="w-4 h-4" />Not connected</span>
                  <button onClick={connect} disabled={!isReady} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <Calendar className="w-4 h-4" />{isReady ? 'Connect Google Calendar' : 'Loading...'}
                  </button>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calendar Time Zone</label>
            <p className="text-xs text-gray-500 mb-2">Used when creating Google Calendar events.</p>
            <div className="flex items-center gap-3 max-w-sm">
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
              <button onClick={handleSaveTimezone} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                <Check className="w-4 h-4" />Save
              </button>
              {timezoneSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Sources Editor (chip-style tag input)
// ---------------------------------------------------------------------------

function JobSourcesEditor({
  values, onChange,
}: { values: string[]; onChange: (vals: string[]) => void }) {
  const [input, setInput] = useState('');

  function addOne(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (values.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  }

  function handleAdd() {
    addOne(input);
    setInput('');
  }

  function remove(v: string) {
    onChange(values.filter((s) => s !== v));
  }

  function resetDefaults() {
    onChange(DEFAULT_JOB_SOURCES);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[1.5rem]">
        {values.length === 0 && (
          <span className="text-xs text-gray-400 italic">No sources configured.</span>
        )}
        {values.map((src) => (
          <span
            key={src}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
          >
            {src}
            <button
              onClick={() => remove(src)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
            if (e.key === ',') { e.preventDefault(); handleAdd(); }
          }}
          placeholder="Add a source (press Enter)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
        <button
          onClick={resetDefaults}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Replace list with defaults"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applicant Statuses Editor (table with inline edit)
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: ApplicantStatusConfig['category']; label: string; cls: string }[] = [
  { value: 'pipeline', label: 'Pipeline', cls: 'bg-sky-100 text-sky-700' },
  { value: 'hired',    label: 'Hired',    cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
  { value: 'dropped',  label: 'Dropped',  cls: 'bg-gray-100 text-gray-600' },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function ApplicantStatusesEditor({
  statuses, onChange,
}: { statuses: ApplicantStatusConfig[]; onChange: (s: ApplicantStatusConfig[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<ApplicantStatusConfig['category']>('pipeline');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function update(value: string, patch: Partial<ApplicantStatusConfig>) {
    onChange(statuses.map((s) => (s.value === value ? { ...s, ...patch } : s)));
  }

  function remove(value: string) {
    onChange(statuses.filter((s) => s.value !== value));
    setDeleteConfirm(null);
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    let value = slugify(label);
    if (!value) value = `s-${Date.now()}`;
    // Ensure unique
    let candidate = value;
    let n = 1;
    while (statuses.some((s) => s.value === candidate)) {
      candidate = `${value}-${n++}`;
    }
    onChange([...statuses, { value: candidate, label, category: newCategory }]);
    setNewLabel('');
    setNewCategory('pipeline');
    setShowAdd(false);
  }

  function resetDefaults() {
    onChange(DEFAULT_APPLICANT_STATUSES);
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3 gap-2">
        <button
          onClick={resetDefaults}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Replace list with defaults"
        >
          Reset
        </button>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Status
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Background Check Pending"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ApplicantStatusConfig['category'])}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => { setShowAdd(false); setNewLabel(''); }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      )}

      {statuses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
          <Tag className="w-7 h-7 text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No statuses configured.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Label', 'Category', 'ID', ''].map((c) => (
                  <th key={c} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {statuses.map((s) => (
                <tr key={s.value} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) => update(s.value, { label: e.target.value })}
                      className="w-full border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={s.category}
                      onChange={(e) => update(s.value, { category: e.target.value as ApplicantStatusConfig['category'] })}
                      className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400 font-mono">{s.value}</td>
                  <td className="px-4 py-2 text-right">
                    {deleteConfirm === s.value ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => remove(s.value)} className="px-2 py-0.5 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(s.value)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete status"
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

// ---------------------------------------------------------------------------
// Interviewers Editor (table similar to Managers but separate list)
// ---------------------------------------------------------------------------

function newInterviewer(): Interviewer {
  return { id: generateId(), name: '', email: '' };
}

function InterviewersEditor({
  values, onChange,
}: { values: Interviewer[]; onChange: (v: Interviewer[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Interviewer>(newInterviewer());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openAdd() {
    setForm(newInterviewer());
    setEditingId(null);
    setShowAdd(true);
  }
  function openEdit(i: Interviewer) {
    setForm({ ...i, email: i.email ?? '' });
    setEditingId(i.id);
    setShowAdd(true);
  }
  function cancel() {
    setShowAdd(false);
    setEditingId(null);
    setForm(newInterviewer());
  }
  function save() {
    const name = form.name.trim();
    if (!name) return;
    const item: Interviewer = {
      id: editingId ?? form.id,
      name,
      email: form.email?.trim() || undefined,
    };
    const next = editingId
      ? values.map((v) => (v.id === editingId ? item : v))
      : [...values, item];
    onChange(next);
    cancel();
  }
  function remove(id: string) {
    onChange(values.filter((v) => v.id !== id));
    setDeleteConfirm(null);
  }

  return (
    <div>
      {!showAdd && (
        <div className="flex justify-end mb-3">
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Interviewer
          </button>
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Comstock, M"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-gray-400">(optional)</span></label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="mcomstock@adamspestcontrol.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancel} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button
              onClick={save}
              disabled={!form.name.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> {editingId ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {values.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
          <Users className="w-7 h-7 text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No interviewers configured.</p>
          <p className="text-gray-400 text-xs mt-0.5">Add anyone who could interview an applicant.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Email', ''].map((c) => (
                  <th key={c} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {values.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{i.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {i.email || <span className="text-gray-400 italic text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {deleteConfirm === i.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => remove(i.id)} className="px-2 py-0.5 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(i.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
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

// ---------------------------------------------------------------------------
// Score Options Editor (label + color picker)
// ---------------------------------------------------------------------------

const SCORE_PALETTE: { color: ScoreColor; cls: string; label: string }[] = [
  { color: 'red',    cls: 'bg-red-500',    label: 'Red'    },
  { color: 'yellow', cls: 'bg-yellow-400', label: 'Yellow' },
  { color: 'green',  cls: 'bg-green-500',  label: 'Green'  },
  { color: 'blue',   cls: 'bg-blue-500',   label: 'Blue'   },
  { color: 'purple', cls: 'bg-purple-500', label: 'Purple' },
  { color: 'gray',   cls: 'bg-gray-500',   label: 'Gray'   },
];

function ColorSwatch({
  color, selected, onSelect, size = 'md',
}: { color: ScoreColor; selected: boolean; onSelect: () => void; size?: 'sm' | 'md' }) {
  const swatch = SCORE_PALETTE.find((s) => s.color === color);
  if (!swatch) return null;
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  return (
    <button
      type="button"
      onClick={onSelect}
      title={swatch.label}
      className={clsx(
        dim,
        swatch.cls,
        'rounded-full transition-all',
        selected ? 'ring-2 ring-offset-1 ring-gray-700' : 'opacity-60 hover:opacity-100'
      )}
    />
  );
}

function slugifyScore(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || `s-${Date.now()}`;
}

function ScoreOptionsEditor({
  values, defaults, onChange,
}: { values: ScoreOption[]; defaults: ScoreOption[]; onChange: (v: ScoreOption[]) => void }) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<ScoreColor>('green');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function update(value: string, patch: Partial<ScoreOption>) {
    onChange(values.map((s) => (s.value === value ? { ...s, ...patch } : s)));
  }

  function remove(value: string) {
    onChange(values.filter((s) => s.value !== value));
    setDeleteConfirm(null);
  }

  function addNew() {
    const label = newLabel.trim();
    if (!label) return;
    let candidate = slugifyScore(label);
    let n = 1;
    while (values.some((s) => s.value === candidate)) {
      candidate = `${slugifyScore(label)}-${n++}`;
    }
    onChange([...values, { value: candidate, label, color: newColor }]);
    setNewLabel('');
    setNewColor('green');
  }

  function reset() {
    onChange(defaults);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      {values.length === 0 ? (
        <p className="text-xs text-gray-400 italic mb-3">No options configured.</p>
      ) : (
        <table className="w-full mb-3">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
              <th className="font-medium pb-1.5 w-44">Color</th>
              <th className="font-medium pb-1.5">Label</th>
              <th className="font-medium pb-1.5 text-gray-300">ID</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {values.map((s) => (
              <tr key={s.value}>
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    {SCORE_PALETTE.map((p) => (
                      <ColorSwatch
                        key={p.color}
                        color={p.color}
                        size="sm"
                        selected={s.color === p.color}
                        onSelect={() => update(s.value, { color: p.color })}
                      />
                    ))}
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => update(s.value, { label: e.target.value })}
                    className="w-full border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="py-1.5 text-xs text-gray-400 font-mono">{s.value}</td>
                <td className="py-1.5 text-right">
                  {deleteConfirm === s.value ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => remove(s.value)} className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(s.value)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add new */}
      <div className="border-t border-gray-100 pt-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-500">New:</span>
        <div className="flex items-center gap-1.5">
          {SCORE_PALETTE.map((p) => (
            <ColorSwatch
              key={p.color}
              color={p.color}
              size="sm"
              selected={newColor === p.color}
              onSelect={() => setNewColor(p.color)}
            />
          ))}
        </div>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
          placeholder="Label (e.g. Strong Yes)"
          className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addNew}
          disabled={!newLabel.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Replace list with defaults"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
