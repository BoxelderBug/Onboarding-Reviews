'use client';

import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Plus, Search, ClipboardList, AlertCircle, ArrowUpDown, Upload, X,
} from 'lucide-react';
import type { AppData, Requisition } from '@/lib/types';
import {
  computeFunnel, daysBetween, newRequisition,
} from '@/lib/requisitions';
import { parseRequisitionCsv } from '@/lib/reqCsvImport';
import { useRequisitions } from '@/context/RequisitionsContext';
import RequisitionDetail from './RequisitionDetail';

interface RequisitionsTabProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

type StatusFilter = 'all' | 'open' | 'closed' | 'on-hold';
type SortField = 'reqNumber' | 'datePosted' | 'daysOpen' | 'position';

export default function RequisitionsTab({ data, onChange }: RequisitionsTabProps) {
  const { isConfigured, loaded, error, requisitions, save, remove } = useRequisitions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [sortBy, setSortBy] = useState<SortField>('datePosted');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const managerMap = useMemo(
    () => new Map(data.settings.managers.map((m) => [m.id, m.name])),
    [data.settings.managers]
  );
  const locationMap = useMemo(
    () => new Map(data.settings.locations.map((l) => [l.id, l.name])),
    [data.settings.locations]
  );

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requisitions.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.reqNumber,
        r.positionTitle,
        r.locationName ?? (r.locationId ? locationMap.get(r.locationId) : ''),
        r.hiringManagerId ? managerMap.get(r.hiringManagerId) : '',
        ...r.applicants.map((a) => a.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requisitions, statusFilter, search, locationMap, managerMap]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'reqNumber':
          return (a.reqNumber.localeCompare(b.reqNumber, undefined, { numeric: true })) * dir;
        case 'position':
          return a.positionTitle.localeCompare(b.positionTitle) * dir;
        case 'daysOpen': {
          const da = daysBetween(a.datePosted, a.dateClosed) ?? -1;
          const db = daysBetween(b.datePosted, b.dateClosed) ?? -1;
          return (da - db) * dir;
        }
        case 'datePosted':
        default: {
          const da = a.datePosted ?? '';
          const db = b.datePosted ?? '';
          return da.localeCompare(db) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'datePosted' || field === 'daysOpen' ? 'desc' : 'asc');
    }
  }

  function handleNewReq() {
    const medina = data.settings.locations.find(
      (l) => l.name.toLowerCase() === 'medina'
    );
    const req = newRequisition(medina?.id);
    void save(req).then(() => setSelectedId(req.id));
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importInfo, setImportInfo] = useState<{
    fileName: string;
    reqNumber: string;
    warnings: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const { requisition, settingsPatch, warnings } = parseRequisitionCsv(text, data);
      // Apply settings additions first (so the new req's interviewer/source refs resolve)
      if (Object.keys(settingsPatch).length > 0) {
        onChange({ ...data, settings: { ...data.settings, ...settingsPatch } });
      }
      await save(requisition);
      setImportInfo({
        fileName: file.name,
        reqNumber: requisition.reqNumber || requisition.id,
        warnings,
      });
      setSelectedId(requisition.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import CSV.';
      setImportError(msg);
    }
  }

  const selected = selectedId ? requisitions.find((r) => r.id === selectedId) ?? null : null;

  const importBanner = (importInfo || importError) ? (
    <div className="mb-4">
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">Import failed: {importError}</span>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {importInfo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <Upload className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
            <div className="flex-1 min-w-0">
              <p className="text-emerald-900 font-medium">
                Imported {importInfo.fileName} as Req #{importInfo.reqNumber}
              </p>
              {importInfo.warnings.length > 0 && (
                <ul className="text-xs text-emerald-700 mt-1.5 space-y-0.5 list-disc pl-4">
                  {importInfo.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setImportInfo(null)} className="text-emerald-500 hover:text-emerald-700 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ----- Detail view -----
  if (selected) {
    return (
      <>
        {importBanner}
        <RequisitionDetail
          req={selected}
          data={data}
          onDataChange={onChange}
          onBack={() => setSelectedId(null)}
          onSave={save}
          onDelete={async (id) => {
            await remove(id);
            setSelectedId(null);
          }}
        />
      </>
    );
  }

  // ----- List view -----
  return (
    <div>
      {importBanner}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileSelected}
        className="hidden"
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Requisitions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {requisitions.length} req{requisitions.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' && ` · filtering ${statusFilter}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportClick}
            disabled={!isConfigured}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isConfigured ? 'Import a requisition CSV (2026 Requisitions sheet format)' : 'Configure Firebase first'}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={handleNewReq}
            disabled={!isConfigured}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title={isConfigured ? 'Create a new requisition' : 'Configure Firebase first'}
          >
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        </div>
      </div>

      {/* Not configured banner */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Firebase is not configured</p>
              <p className="text-sm text-amber-700 mt-1">
                The Requisitions tab needs Firestore to store data. Add these environment variables to
                <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded text-xs">.env.local</code>
                (and in Vercel for production):
              </p>
              <ul className="text-xs font-mono text-amber-700 mt-2 space-y-0.5 pl-4 list-disc">
                <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
                <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
                <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
                <li>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</li>
                <li>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</li>
                <li>NEXT_PUBLIC_FIREBASE_APP_ID</li>
              </ul>
              <p className="text-xs text-amber-700 mt-2">
                Create a project at <a className="underline" href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">console.firebase.google.com</a>,
                enable Firestore, then copy the web-app config from Project Settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search req#, position, location, manager, applicant name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['open', 'closed', 'on-hold', 'all'] as StatusFilter[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded transition-colors capitalize',
                statusFilter === opt ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {opt === 'on-hold' ? 'On Hold' : opt}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {!loaded ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          Loading…
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState hasAny={requisitions.length > 0} onNew={handleNewReq} configured={isConfigured} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader label="Req #"     field="reqNumber"  current={sortBy} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Position"  field="position"   current={sortBy} dir={sortDir} onClick={toggleSort} />
                  <Th>Location</Th>
                  <Th>Hiring Manager</Th>
                  <SortHeader label="Posted"    field="datePosted" current={sortBy} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Days Open" field="daysOpen"   current={sortBy} dir={sortDir} onClick={toggleSort} />
                  <Th>Pipeline</Th>
                  <Th className="text-center">Hired / Openings</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sorted.map((r) => (
                  <RequisitionRow
                    key={r.id}
                    req={r}
                    managerName={r.hiringManagerId ? managerMap.get(r.hiringManagerId) ?? '—' : '—'}
                    locationName={r.locationName ?? (r.locationId ? locationMap.get(r.locationId) ?? '—' : '—')}
                    onClick={() => setSelectedId(r.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap',
        className
      )}
    >
      {children}
    </th>
  );
}

interface SortHeaderProps {
  label: string;
  field: SortField;
  current: SortField;
  dir: 'asc' | 'desc';
  onClick: (f: SortField) => void;
}

function SortHeader({ label, field, current, dir, onClick }: SortHeaderProps) {
  const active = current === field;
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
      <button
        onClick={() => onClick(field)}
        className={clsx(
          'inline-flex items-center gap-1 hover:text-gray-700 transition-colors',
          active && 'text-gray-900'
        )}
      >
        {label}
        <ArrowUpDown className={clsx('w-3 h-3', active ? 'opacity-100' : 'opacity-30')} />
        {active && <span className="text-gray-400 text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: Requisition['status'] }) {
  const styles: Record<Requisition['status'], string> = {
    open: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
    'on-hold': 'bg-amber-100 text-amber-700',
  };
  const label = status === 'on-hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', styles[status])}>
      {label}
    </span>
  );
}

function FunnelMini({ req }: { req: Requisition }) {
  const f = computeFunnel(req.applicants);
  const stages: { label: string; n: number; cls: string }[] = [
    { label: 'Apps',    n: f.applicants,      cls: 'bg-gray-100 text-gray-700' },
    { label: 'Phone',   n: f.phoneInterviews, cls: 'bg-sky-100 text-sky-700' },
    { label: 'Int',     n: f.interviews,      cls: 'bg-indigo-100 text-indigo-700' },
    { label: 'Offer',   n: f.offers,          cls: 'bg-violet-100 text-violet-700' },
    { label: 'Hired',   n: f.hired,           cls: 'bg-emerald-100 text-emerald-700' },
  ];
  return (
    <div className="flex items-center gap-1">
      {stages.map((s) => (
        <span
          key={s.label}
          className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium', s.cls)}
          title={`${s.label}: ${s.n}`}
        >
          {s.n}
        </span>
      ))}
    </div>
  );
}

function RequisitionRow({
  req, managerName, locationName, onClick,
}: { req: Requisition; managerName: string; locationName: string; onClick: () => void }) {
  const days = daysBetween(req.datePosted, req.dateClosed);
  const hiredCount = req.applicants.filter((a) => a.status === 'hired').length;
  const ratioFull = hiredCount >= req.openings && req.openings > 0;
  return (
    <tr
      onClick={onClick}
      className="hover:bg-blue-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm font-semibold text-blue-700 whitespace-nowrap">
        #{req.reqNumber || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
        {req.positionTitle || <span className="text-gray-400 italic">Untitled</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{locationName}</td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{managerName}</td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {req.datePosted || <span className="text-gray-400 italic">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {days !== null ? days : <span className="text-gray-400 italic">—</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <FunnelMini req={req} />
      </td>
      <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
        <span
          className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
            ratioFull ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
          )}
        >
          {hiredCount} / {req.openings}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={req.status} />
      </td>
    </tr>
  );
}

function EmptyState({
  hasAny, onNew, configured,
}: { hasAny: boolean; onNew: () => void; configured: boolean }) {
  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
        <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Connect Firebase to get started</p>
        <p className="text-gray-400 text-sm mt-1">See the banner above for setup instructions.</p>
      </div>
    );
  }
  if (hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
        <Search className="w-9 h-9 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">No requisitions match your filters.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
      <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">No requisitions yet.</p>
      <p className="text-gray-400 text-sm mt-1 mb-4">Click "New Requisition" to start tracking your first hire.</p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" /> New Requisition
      </button>
    </div>
  );
}

