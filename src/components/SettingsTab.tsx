'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Settings2 } from 'lucide-react';
import type { AppData, Position, Settings } from '@/lib/types';

function generateId(): string {
  return `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface SettingsTabProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

interface PositionForm {
  id: string;
  name: string;
  startTime: string;
  duration: string; // string for input binding
}

function emptyPositionForm(): PositionForm {
  return { id: generateId(), name: '', startTime: '09:00', duration: '30' };
}

function positionToForm(p: Position): PositionForm {
  return { id: p.id, name: p.name, startTime: p.startTime, duration: String(p.duration) };
}

export default function SettingsTab({ data, onChange }: SettingsTabProps) {
  const settings = data.settings;

  // Position form state
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm());
  const [deletePositionConfirm, setDeletePositionConfirm] = useState<string | null>(null);

  // Default settings state
  const [defaultTime, setDefaultTime] = useState(settings.defaultStartTime);
  const [defaultDuration, setDefaultDuration] = useState(String(settings.defaultDuration));
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  function updateSettings(partial: Partial<Settings>) {
    const updated: Settings = { ...settings, ...partial };
    onChange({ ...data, settings: updated });
  }

  // --- Position CRUD ---

  function handleOpenAddPosition() {
    setPositionForm(emptyPositionForm());
    setEditingPositionId(null);
    setShowAddPosition(true);
  }

  function handleOpenEditPosition(pos: Position) {
    setPositionForm(positionToForm(pos));
    setEditingPositionId(pos.id);
    setShowAddPosition(true);
  }

  function handleCancelPosition() {
    setShowAddPosition(false);
    setEditingPositionId(null);
    setPositionForm(emptyPositionForm());
  }

  function handleSavePosition() {
    const name = positionForm.name.trim();
    if (!name || !positionForm.startTime) return;
    const duration = parseInt(positionForm.duration, 10) || 30;
    const position: Position = {
      id: editingPositionId ?? positionForm.id,
      name,
      startTime: positionForm.startTime,
      duration,
    };
    const positions = editingPositionId
      ? settings.positions.map((p) => (p.id === editingPositionId ? position : p))
      : [...settings.positions, position];
    updateSettings({ positions });
    handleCancelPosition();
  }

  function handleDeletePosition(id: string) {
    const positions = settings.positions.filter((p) => p.id !== id);
    updateSettings({ positions });
    setDeletePositionConfirm(null);
  }

  // --- Default settings save ---

  function handleSaveDefaults() {
    const dur = parseInt(defaultDuration, 10);
    if (!defaultTime || isNaN(dur) || dur < 1) return;
    updateSettings({ defaultStartTime: defaultTime, defaultDuration: dur });
    setDefaultsSaved(true);
    setTimeout(() => setDefaultsSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure positions and default review times.</p>
      </div>

      {/* Positions section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Positions</h2>
          {!showAddPosition && (
            <button
              onClick={handleOpenAddPosition}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Position
            </button>
          )}
        </div>

        {/* Add/Edit position form */}
        {showAddPosition && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingPositionId ? 'Edit Position' : 'New Position'}
              </h3>
              <button
                onClick={handleCancelPosition}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={positionForm.name}
                  onChange={(e) =>
                    setPositionForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Technician"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={positionForm.startTime}
                  onChange={(e) =>
                    setPositionForm((f) => ({ ...f, startTime: e.target.value }))
                  }
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
                  value={positionForm.duration}
                  onChange={(e) =>
                    setPositionForm((f) => ({ ...f, duration: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={handleCancelPosition}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePosition}
                disabled={!positionForm.name.trim() || !positionForm.startTime}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingPositionId ? 'Save Changes' : 'Add Position'}
              </button>
            </div>
          </div>
        )}

        {/* Positions table */}
        {settings.positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <Settings2 className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No positions configured.</p>
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
                    Start Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration (min)
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {settings.positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {pos.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pos.startTime}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pos.duration}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deletePositionConfirm === pos.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button
                            onClick={() => handleDeletePosition(pos.id)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletePositionConfirm(null)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditPosition(pos)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit position"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletePositionConfirm(pos.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Default settings */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Default Settings</h2>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-4">
            Used as fallback when a position has no specific time configured, or when an
            employee has no position assigned.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Start Time
              </label>
              <input
                type="time"
                value={defaultTime}
                onChange={(e) => setDefaultTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Duration (min)
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveDefaults}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Save Defaults
            </button>
            {defaultsSaved && (
              <span className="text-sm text-green-600 font-medium">Saved!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
