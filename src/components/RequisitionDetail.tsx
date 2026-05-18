'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft, Plus, Trash2, X, Check, Download, Loader2, MessageSquare, Users,
  ChevronDown, AlertCircle, ChevronRight,
} from 'lucide-react';
import type {
  AppData, Applicant, ApplicantStatusConfig, Interviewer, Requisition, ScoreColor, ScoreOption,
} from '@/lib/types';
import {
  computeFunnel, computeSourceBreakdown, computeInterviewerLoad, daysBetween,
  newApplicant,
} from '@/lib/requisitions';
import { exportRequisitionCsv } from '@/lib/reqCsv';

interface RequisitionDetailProps {
  req: Requisition;
  data: AppData;
  onDataChange: (data: AppData) => void;
  onBack: () => void;
  onSave: (req: Requisition) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function RequisitionDetail({
  req: initialReq, data, onBack, onSave, onDelete,
}: RequisitionDetailProps) {
  const [req, setReq] = useState<Requisition>(initialReq);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef(JSON.stringify(initialReq));

  // Sync if the upstream changes (e.g. another device updates it)
  useEffect(() => {
    // Only sync if local matches last saved snapshot — otherwise the user has unsaved edits
    if (JSON.stringify(req) === lastSavedJson.current) {
      const upstreamJson = JSON.stringify(initialReq);
      if (upstreamJson !== lastSavedJson.current) {
        setReq(initialReq);
        lastSavedJson.current = upstreamJson;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReq]);

  // Debounced save
  useEffect(() => {
    const snapshot = JSON.stringify(req);
    if (snapshot === lastSavedJson.current) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await onSave(req);
        lastSavedJson.current = snapshot;
        setSaveState('saved');
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch {
        setSaveState('error');
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [req, onSave]);

  function update<K extends keyof Requisition>(field: K, value: Requisition[K]) {
    setReq((prev) => ({ ...prev, [field]: value }));
  }

  function updateApplicant(id: string, patch: Partial<Applicant>) {
    setReq((prev) => ({
      ...prev,
      applicants: prev.applicants.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }

  function addApplicant() {
    setReq((prev) => ({ ...prev, applicants: [...prev.applicants, newApplicant()] }));
  }

  function removeApplicant(id: string) {
    setReq((prev) => ({ ...prev, applicants: prev.applicants.filter((a) => a.id !== id) }));
  }

  function togglePostingPlatform(value: string) {
    setReq((prev) => {
      const has = prev.postingPlatforms.includes(value);
      return {
        ...prev,
        postingPlatforms: has
          ? prev.postingPlatforms.filter((v) => v !== value)
          : [...prev.postingPlatforms, value],
      };
    });
  }

  async function handleDelete() {
    await onDelete(req.id);
  }

  function handleExport() {
    exportRequisitionCsv(req, data);
  }

  const daysOpen = daysBetween(req.datePosted, req.dateClosed);
  const funnel = useMemo(() => computeFunnel(req.applicants), [req.applicants]);
  const sourceRows = useMemo(
    () => computeSourceBreakdown(req.applicants, data.settings.jobSources),
    [req.applicants, data.settings.jobSources]
  );
  const interviewerLoad = useMemo(
    () => computeInterviewerLoad(req.applicants, data.settings.interviewers.map((i) => i.id)),
    [req.applicants, data.settings.interviewers]
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All Reqs
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {req.positionTitle || <span className="text-gray-400 italic">Untitled Position</span>}
              <span className="text-blue-600 font-normal ml-2">#{req.reqNumber || '—'}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {req.applicants.length} applicant{req.applicants.length !== 1 ? 's' : ''}
              {daysOpen !== null && ` · ${daysOpen} days open`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SaveIndicator state={saveState} />
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Export this requisition as CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-500 mr-1">Delete?</span>
              <button
                onClick={handleDelete}
                className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete this requisition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {/* Metadata */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Requisition Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FieldText label="Req #" required value={req.reqNumber} onChange={(v) => update('reqNumber', v)} placeholder="e.g. 1439" />
              <FieldText label="Position Title" required value={req.positionTitle} onChange={(v) => update('positionTitle', v)} placeholder="e.g. Seasonal Mosquito Technician" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Openings</label>
                <input
                  type="number"
                  min={1}
                  value={req.openings}
                  onChange={(e) => update('openings', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <FieldSelect
                label="Status"
                value={req.status}
                onChange={(v) => update('status', v as Requisition['status'])}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'on-hold', label: 'On Hold' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
              <FieldSelect
                label="Location"
                value={req.locationId ?? ''}
                onChange={(v) => update('locationId', v || undefined)}
                options={[
                  { value: '', label: '— None —' },
                  ...data.settings.locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
              {!req.locationId && (
                <FieldText
                  label="Location (free text)"
                  value={req.locationName ?? ''}
                  onChange={(v) => update('locationName', v || undefined)}
                  placeholder="e.g. Nisswa"
                />
              )}
              <FieldSelect
                label="Hiring Manager"
                value={req.hiringManagerId ?? ''}
                onChange={(v) => update('hiringManagerId', v || undefined)}
                options={[
                  { value: '', label: '— None —' },
                  ...data.settings.managers.map((m) => ({ value: m.id, label: m.name })),
                ]}
                emptyHint={data.settings.managers.length === 0 ? 'Add managers in Settings' : undefined}
              />
              <FieldDate label="Hiring Approval Date" value={req.hiringApprovalDate ?? ''} onChange={(v) => update('hiringApprovalDate', v || undefined)} />
              <FieldDate label="Date Posted" value={req.datePosted ?? ''} onChange={(v) => update('datePosted', v || undefined)} />
              <FieldDate label="Date Closed" value={req.dateClosed ?? ''} onChange={(v) => update('dateClosed', v || undefined)} />
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={req.notes ?? ''}
                onChange={(e) => update('notes', e.target.value || undefined)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder="Optional context, requirements, or links."
              />
            </div>
          </section>

          {/* Posting Platforms */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Posting Platforms</h2>
            {data.settings.jobSources.length === 0 ? (
              <p className="text-xs text-gray-400">Add job sources in Settings to track where this req is posted.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                {data.settings.jobSources.map((src) => (
                  <label key={src} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={req.postingPlatforms.includes(src)}
                      onChange={() => togglePostingPlatform(src)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{src}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Applicants */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Applicants</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click any cell to edit. Changes save automatically.
                </p>
              </div>
              <button
                onClick={addApplicant}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Applicant
              </button>
            </div>

            {req.applicants.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-500">No applicants yet.</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Applicant" to start tracking.</p>
              </div>
            ) : (
              <ApplicantTable
                applicants={req.applicants}
                data={data}
                onUpdate={updateApplicant}
                onRemove={removeApplicant}
              />
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4 min-w-0">
          <FunnelCard funnel={funnel} openings={req.openings} />
          <SourceBreakdownCard rows={sourceRows} />
          <InterviewerLoadCard interviewers={data.settings.interviewers} load={interviewerLoad} />
        </aside>
      </div>
    </div>
  );
}

// ===========================================================================
// Save indicator
// ===========================================================================

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="w-3.5 h-3.5" />
        Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
      <AlertCircle className="w-3.5 h-3.5" />
      Save failed
    </span>
  );
}

// ===========================================================================
// Form atoms
// ===========================================================================

function FieldText({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function FieldDate({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function FieldSelect({
  label, value, onChange, options, emptyHint,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; emptyHint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {emptyHint && <p className="text-xs text-amber-600 mt-1">{emptyHint}</p>}
    </div>
  );
}

// ===========================================================================
// Applicant Table
// ===========================================================================

interface ApplicantTableProps {
  applicants: Applicant[];
  data: AppData;
  onUpdate: (id: string, patch: Partial<Applicant>) => void;
  onRemove: (id: string) => void;
}

function ApplicantTable({ applicants, data, onUpdate, onRemove }: ApplicantTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left w-8"></th>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">ADP</th>
            <th className="px-3 py-2 text-left">Phone Int</th>
            <th className="px-3 py-2 text-center">Phone Score</th>
            <th className="px-3 py-2 text-left">Interview</th>
            <th className="px-3 py-2 text-center">Int Score</th>
            <th className="px-3 py-2 text-left">Interviewers</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {applicants.map((a, idx) => (
            <ApplicantRow
              key={a.id}
              applicant={a}
              index={idx + 1}
              data={data}
              expanded={expanded === a.id}
              deleteConfirm={deleteConfirm === a.id}
              onToggleExpand={() => setExpanded((e) => (e === a.id ? null : a.id))}
              onChange={(patch) => onUpdate(a.id, patch)}
              onAskDelete={() => setDeleteConfirm(a.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
              onConfirmDelete={() => { onRemove(a.id); setDeleteConfirm(null); }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ApplicantRowProps {
  applicant: Applicant;
  index: number;
  data: AppData;
  expanded: boolean;
  deleteConfirm: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<Applicant>) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function ApplicantRow({
  applicant: a, index, data, expanded, deleteConfirm,
  onToggleExpand, onChange, onAskDelete, onCancelDelete, onConfirmDelete,
}: ApplicantRowProps) {
  const statuses = data.settings.applicantStatuses;
  const statusCfg = statuses.find((s) => s.value === a.status);
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-2 py-1 text-center">
          <button
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title={expanded ? 'Collapse' : 'Show notes & interview time'}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="px-3 py-1 text-xs text-gray-400">{index}</td>
        <td className="px-2 py-1">
          <InlineText value={a.name} onChange={(v) => onChange({ name: v })} placeholder="Applicant name" />
        </td>
        <td className="px-2 py-1">
          <InlineSelect
            value={a.source}
            onChange={(v) => onChange({ source: v })}
            options={[
              { value: '', label: '—' },
              ...data.settings.jobSources.map((s) => ({ value: s, label: s })),
            ]}
            placeholder="Source"
          />
        </td>
        <td className="px-2 py-1">
          <InlineDate value={a.adpCompleteDate ?? ''} onChange={(v) => onChange({ adpCompleteDate: v || undefined })} />
        </td>
        <td className="px-2 py-1">
          <InlineDate value={a.phoneInterviewDate ?? ''} onChange={(v) => onChange({ phoneInterviewDate: v || undefined })} />
        </td>
        <td className="px-2 py-1 text-center">
          <ScoreButtons
            value={a.phoneInterviewScore}
            options={data.settings.phoneScoreOptions}
            onChange={(v) => onChange({ phoneInterviewScore: v })}
          />
        </td>
        <td className="px-2 py-1">
          <InlineDate value={a.firstInterviewDate ?? ''} onChange={(v) => onChange({ firstInterviewDate: v || undefined })} />
        </td>
        <td className="px-2 py-1 text-center">
          <ScoreButtons
            value={a.interviewScore}
            options={data.settings.interviewScoreOptions}
            onChange={(v) => onChange({ interviewScore: v })}
          />
        </td>
        <td className="px-2 py-1">
          <InterviewerPicker
            interviewers={data.settings.interviewers}
            selectedIds={a.interviewerIds}
            onChange={(ids) => onChange({ interviewerIds: ids })}
          />
        </td>
        <td className="px-2 py-1">
          <StatusSelect
            value={a.status}
            options={statuses}
            onChange={(v) => onChange({ status: v })}
            categoryHint={statusCfg?.category}
          />
        </td>
        <td className="px-2 py-1 text-right">
          {deleteConfirm ? (
            <div className="flex items-center gap-1">
              <button onClick={onConfirmDelete} className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600">Yes</button>
              <button onClick={onCancelDelete} className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">No</button>
            </div>
          ) : (
            <button onClick={onAskDelete} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete applicant">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-blue-50/40">
          <td colSpan={12} className="px-6 py-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Interview Time</label>
                <input
                  type="time"
                  value={a.firstInterviewTime ?? ''}
                  onChange={(e) => onChange({ firstInterviewTime: e.target.value || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Notes
                </label>
                <textarea
                  value={a.notes ?? ''}
                  onChange={(e) => onChange({ notes: e.target.value || undefined })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="Comments, follow-ups, why they were rejected, etc."
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
// Inline cell components
// ===========================================================================

function InlineText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-[120px] border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 py-1 text-sm bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

function InlineSelect({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'w-full min-w-[100px] border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 py-1 text-sm bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500',
        !value && 'text-gray-400'
      )}
      title={placeholder}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function InlineDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-[130px] border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 py-1 text-sm bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

/** Tailwind classes for each score color in the palette. Static literals so Tailwind's JIT picks them up. */
const SCORE_COLOR_CLASSES: Record<ScoreColor, { bg: string; text: string; ring: string }> = {
  red:    { bg: 'bg-red-500',    text: 'text-white', ring: 'ring-red-500'    },
  yellow: { bg: 'bg-yellow-400', text: 'text-white', ring: 'ring-yellow-400' },
  green:  { bg: 'bg-green-500',  text: 'text-white', ring: 'ring-green-500'  },
  blue:   { bg: 'bg-blue-500',   text: 'text-white', ring: 'ring-blue-500'   },
  purple: { bg: 'bg-purple-500', text: 'text-white', ring: 'ring-purple-500' },
  gray:   { bg: 'bg-gray-500',   text: 'text-white', ring: 'ring-gray-500'   },
};

function ScoreButtons({
  value, options, onChange,
}: {
  value: string | undefined;
  options: ScoreOption[];
  onChange: (v: string | undefined) => void;
}) {
  if (options.length === 0) {
    return <span className="text-xs text-gray-300 italic">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1">
      {options.map((o) => {
        const cls = SCORE_COLOR_CLASSES[o.color] ?? SCORE_COLOR_CLASSES.gray;
        const selected = value === o.value;
        // Single-char labels render as circle; multi-char as text pill
        const isCompact = o.label.length <= 2;
        return (
          <button
            key={o.value}
            onClick={() => onChange(selected ? undefined : o.value)}
            className={clsx(
              'transition-all',
              isCompact
                ? 'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center'
                : 'h-5 px-1.5 rounded text-[10px] font-semibold',
              cls.bg,
              cls.text,
              selected
                ? 'ring-2 ring-offset-1 ' + cls.ring
                : 'opacity-25 hover:opacity-100'
            )}
            title={o.label}
          >
            {isCompact ? o.label : o.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusSelect({
  value, options, onChange, categoryHint,
}: {
  value: string;
  options: ApplicantStatusConfig[];
  onChange: (v: string) => void;
  categoryHint?: ApplicantStatusConfig['category'];
}) {
  const colorCls: Record<ApplicantStatusConfig['category'], string> = {
    pipeline: 'bg-sky-50 text-sky-700 border-sky-200',
    hired: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    dropped: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const cls = categoryHint ? colorCls[categoryHint] : 'bg-white text-gray-700 border-gray-200';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'w-full min-w-[160px] border rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500',
        cls
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-white text-gray-700">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ===========================================================================
// Interviewer multi-select popover
// ===========================================================================

function InterviewerPicker({
  interviewers, selectedIds, onChange,
}: { interviewers: Interviewer[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((i) => i !== id));
    else onChange([...selectedIds, id]);
  }

  const selectedNames = selectedIds
    .map((id) => interviewers.find((m) => m.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full min-w-[140px] text-left border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 py-1 text-sm bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center gap-1.5"
      >
        {selectedNames.length === 0 ? (
          <span className="text-gray-400 inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Add…
          </span>
        ) : (
          <span className="text-xs text-gray-700 truncate">
            {selectedNames.length === 1
              ? selectedNames[0]
              : `${selectedNames[0]} +${selectedNames.length - 1}`}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 left-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {interviewers.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">Add interviewers in Settings first.</p>
          ) : (
            interviewers.map((m) => {
              const checked = selectedIds.includes(m.id);
              return (
                <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(m.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 truncate">{m.name}</span>
                </label>
              );
            })
          )}
          {selectedIds.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5">
              <button
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Sidebar cards
// ===========================================================================

function FunnelCard({
  funnel, openings,
}: { funnel: ReturnType<typeof computeFunnel>; openings: number }) {
  const rows: { label: string; value: number; cls?: string }[] = [
    { label: 'Applicants',    value: funnel.applicants },
    { label: 'Phone Ints',    value: funnel.phoneInterviews },
    { label: 'Interviews',    value: funnel.interviews },
    { label: 'Offers',        value: funnel.offers },
    { label: 'Accepted',      value: funnel.accepted },
    { label: 'Hired',         value: funnel.hired, cls: 'text-emerald-700 font-semibold' },
  ];
  const drops: { label: string; value: number }[] = [
    { label: 'Unable to Connect',  value: funnel.unableToConnect },
    { label: 'No Call No Show',    value: funnel.noCallNoShow },
    { label: 'Rejected (Phone)',   value: funnel.rejectedAtPhone },
    { label: 'Rejected (Int)',     value: funnel.rejectedAtInterview },
    { label: 'Declined Offer',     value: funnel.offerDeclined },
    { label: 'Rescinded Offer',    value: funnel.offerRescinded },
    { label: 'Withdrew',           value: funnel.withdrew },
  ];
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Candidate Funnel</h3>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between">
            <dt className="text-sm text-gray-600">{r.label}</dt>
            <dd className={clsx('text-sm tabular-nums', r.cls ?? 'text-gray-900')}>{r.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between pt-1 border-t border-gray-100 mt-2">
          <dt className="text-xs text-gray-500">Hired / Openings</dt>
          <dd className="text-xs tabular-nums text-gray-700">{funnel.hired} / {openings}</dd>
        </div>
      </dl>
      {drops.some((d) => d.value > 0) && (
        <>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">Drop / Reject</h3>
          <dl className="space-y-1">
            {drops.filter((d) => d.value > 0).map((d) => (
              <div key={d.label} className="flex items-baseline justify-between">
                <dt className="text-xs text-gray-500">{d.label}</dt>
                <dd className="text-xs tabular-nums text-gray-600">{d.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

function SourceBreakdownCard({
  rows,
}: { rows: { source: string; applicants: number; phoneInterviews: number; interviews: number; hired: number }[] }) {
  const active = rows.filter((r) => r.applicants > 0);
  if (active.length === 0) {
    return null;
  }
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Source</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-400">
            <th className="text-left font-medium pb-1">Source</th>
            <th className="text-center font-medium pb-1" title="Applicants">A</th>
            <th className="text-center font-medium pb-1" title="Phone Interviews">P</th>
            <th className="text-center font-medium pb-1" title="Interviews">I</th>
            <th className="text-center font-medium pb-1" title="Hired">H</th>
          </tr>
        </thead>
        <tbody>
          {active.map((r) => (
            <tr key={r.source} className="border-t border-gray-50">
              <td className="py-1 text-gray-700 truncate max-w-[100px]" title={r.source}>{r.source}</td>
              <td className="py-1 text-center tabular-nums text-gray-700">{r.applicants}</td>
              <td className="py-1 text-center tabular-nums text-gray-600">{r.phoneInterviews}</td>
              <td className="py-1 text-center tabular-nums text-gray-600">{r.interviews}</td>
              <td className="py-1 text-center tabular-nums text-emerald-700 font-medium">{r.hired}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function InterviewerLoadCard({
  interviewers, load,
}: { interviewers: Interviewer[]; load: Map<string, number> }) {
  const rows = interviewers
    .map((m) => ({ name: m.name, count: load.get(m.id) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  if (rows.length === 0) return null;
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Interviewer Load</h3>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-baseline justify-between">
            <dt className="text-xs text-gray-600 truncate max-w-[180px]" title={r.name}>{r.name}</dt>
            <dd className="text-xs tabular-nums text-gray-700">{r.count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

