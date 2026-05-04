'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Check, X, Settings2, Users, Calendar, Wifi, WifiOff,
  MapPin, RefreshCw, Loader2,
} from 'lucide-react';
import type { AppData, Location, Position, Manager, ScheduleEvent, Settings } from '@/lib/types';
import { fetchCalendarRooms } from '@/lib/googleCalendar';
import { useGoogleCalendar } from '@/context/GoogleCalendarContext';

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
    locationId: '', startTime: '09:00', duration: '60',
    inviteEmployee: true, inviteManager: true, additionalEmails: '',
  };
}

function eventToForm(e: ScheduleEvent): ScheduleEventForm {
  return {
    id: e.id, title: e.title, description: e.description,
    prependEmployees: e.prependEmployees ?? false,
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
            {locations.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select
                  value={form.locationId}
                  onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">— No location —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}

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
                    {ev.locationId && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {locations.find((l) => l.id === ev.locationId)?.name ?? ev.locationId}
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
}

function emptyPositionForm(): PositionForm {
  return { id: generateId(), name: '', startTime: '09:00', duration: '30' };
}

function positionToForm(p: Position): PositionForm {
  return { id: p.id, name: p.name, startTime: p.startTime, duration: String(p.duration) };
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
  const [defaultDuration, setDefaultDuration] = useState(String(settings.defaultDuration));
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  const [timezone, setTimezone] = useState(settings.calendarTimeZone);
  const [timezoneSaved, setTimezoneSaved] = useState(false);

  function updateSettings(partial: Partial<Settings>) {
    onChange({ ...data, settings: { ...settings, ...partial } });
  }

  // --- Positions ---

  function handleOpenAddPosition() { setPositionForm(emptyPositionForm()); setEditingPositionId(null); setShowAddPosition(true); }
  function handleOpenEditPosition(pos: Position) { setPositionForm(positionToForm(pos)); setEditingPositionId(pos.id); setShowAddPosition(true); }
  function handleCancelPosition() { setShowAddPosition(false); setEditingPositionId(null); setPositionForm(emptyPositionForm()); }

  function handleSavePosition() {
    const name = positionForm.name.trim();
    if (!name || !positionForm.startTime) return;
    const position: Position = { id: editingPositionId ?? positionForm.id, name, startTime: positionForm.startTime, duration: parseInt(positionForm.duration, 10) || 30 };
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

  function handleSaveDefaults() {
    const dur = parseInt(defaultDuration, 10);
    if (!defaultTime || isNaN(dur) || dur < 1) return;
    updateSettings({ defaultStartTime: defaultTime, defaultDuration: dur });
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
            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
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

      {/* Locations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Meeting Room Locations</h2>
          <div className="flex items-center gap-2">
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

      {/* Default Settings */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Default Settings</h2>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-4">Used when a position has no specific time configured or an employee has no position assigned.</p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Start Time</label>
              <input type="time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Duration (min)</label>
              <input type="number" min="1" max="480" value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleSaveDefaults} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              <Check className="w-4 h-4" />Save Defaults
            </button>
            {defaultsSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
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
