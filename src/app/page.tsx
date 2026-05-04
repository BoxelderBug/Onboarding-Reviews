'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Users, CalendarDays, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { loadData, saveData, DEFAULT_DATA } from '@/lib/storage';
import { buildReviews } from '@/lib/dateUtils';
import type { AppData, Employee } from '@/lib/types';
import ReviewsDashboard from '@/components/ReviewsDashboard';
import EmployeesTab from '@/components/EmployeesTab';
import HolidaysTab from '@/components/HolidaysTab';
import SettingsTab from '@/components/SettingsTab';

type Tab = 'reviews' | 'employees' | 'holidays' | 'settings';

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'reviews', label: 'Reviews', Icon: ClipboardList },
  { id: 'employees', label: 'Employees', Icon: Users },
  { id: 'holidays', label: 'Holidays', Icon: CalendarDays },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
];

/**
 * Recalculate all non-overridden reviews for every employee.
 */
function recalculateAll(data: AppData): AppData {
  const updatedEmployees: Employee[] = data.employees.map((emp) => {
    if (!emp.startDate) return emp;
    const rebuilt = buildReviews(
      emp.startDate,
      emp.positionId,
      data.settings.positions,
      data.settings,
      data.holidays,
      emp.reviews
    );
    return { ...emp, reviews: rebuilt };
  });
  return { ...data, employees: updatedEmployees };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('reviews');
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadData();
    setData(stored);
    setLoaded(true);
  }, []);

  function handleDataChange(newData: AppData) {
    setData(newData);
    saveData(newData);
  }

  function handleHolidaysOrSettingsChange(newData: AppData) {
    const recalculated = recalculateAll(newData);
    handleDataChange(recalculated);
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white rounded-lg p-2">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Onboarding Reviews
                </h1>
                <p className="text-xs text-gray-500">Adams Pest Control</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-0" aria-label="Tabs">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'reviews' && <ReviewsDashboard data={data} />}
        {activeTab === 'employees' && (
          <EmployeesTab
            data={data}
            onChange={handleDataChange}
          />
        )}
        {activeTab === 'holidays' && (
          <HolidaysTab
            data={data}
            onChange={handleHolidaysOrSettingsChange}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            data={data}
            onChange={handleHolidaysOrSettingsChange}
          />
        )}
      </main>
    </div>
  );
}
