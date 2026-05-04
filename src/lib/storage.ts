import type { AppData, Employee, Holiday, Location, Settings } from './types';

const STORAGE_KEY = 'onboarding-reviews';

export const DEFAULT_DATA: AppData = {
  employees: [],
  holidays: [
    { id: 'h1', name: "New Year's Day", date: '2000-01-01', recurring: true },
    { id: 'h2', name: 'Independence Day', date: '2000-07-04', recurring: true },
    { id: 'h3', name: 'Christmas Day', date: '2000-12-25', recurring: true },
    { id: 'h4', name: 'Thanksgiving 2025', date: '2025-11-27', recurring: false },
    { id: 'h5', name: 'Labor Day 2025', date: '2025-09-01', recurring: false },
    { id: 'h6', name: 'Memorial Day 2025', date: '2025-05-26', recurring: false },
  ],
  settings: {
    defaultStartTime: '09:00',
    defaultDuration: 30,
    positions: [
      { id: 'p1', name: 'Technician', startTime: '09:00', duration: 30 },
      { id: 'p2', name: 'Office Staff', startTime: '10:00', duration: 30 },
      { id: 'p3', name: 'Sales', startTime: '09:00', duration: 30 },
      { id: 'p4', name: 'Manager', startTime: '09:00', duration: 60 },
    ],
    managers: [],
    locations: [],
    reviewEmails: { 30: '', 60: '', 180: '' },
    concurrentReviewPairs: [],
    calendarTimeZone: 'America/Chicago',
    firstDaySchedule: [],
    secondDaySchedule: [],
  },
};

export function loadData(): AppData {
  if (typeof window === 'undefined') return DEFAULT_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as AppData;
    return {
      employees: parsed.employees ?? [],
      holidays: parsed.holidays ?? DEFAULT_DATA.holidays,
      settings: {
        defaultStartTime:
          parsed.settings?.defaultStartTime ?? DEFAULT_DATA.settings.defaultStartTime,
        defaultDuration:
          parsed.settings?.defaultDuration ?? DEFAULT_DATA.settings.defaultDuration,
        positions: parsed.settings?.positions ?? DEFAULT_DATA.settings.positions,
        managers: parsed.settings?.managers ?? [],
        locations: (parsed.settings?.locations ?? []) as Location[],
        reviewEmails: parsed.settings?.reviewEmails ?? { 30: '', 60: '', 180: '' },
        concurrentReviewPairs: parsed.settings?.concurrentReviewPairs ?? [],
        calendarTimeZone:
          parsed.settings?.calendarTimeZone ?? DEFAULT_DATA.settings.calendarTimeZone,
        firstDaySchedule: parsed.settings?.firstDaySchedule ?? [],
        secondDaySchedule: parsed.settings?.secondDaySchedule ?? [],
      },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export function getEmployees(): Employee[] {
  return loadData().employees;
}

export function saveEmployee(employee: Employee): void {
  const data = loadData();
  const idx = data.employees.findIndex((e) => e.id === employee.id);
  if (idx >= 0) {
    data.employees[idx] = employee;
  } else {
    data.employees.push(employee);
  }
  saveData(data);
}

export function deleteEmployee(id: string): void {
  const data = loadData();
  data.employees = data.employees.filter((e) => e.id !== id);
  saveData(data);
}

export function getHolidays(): Holiday[] {
  return loadData().holidays;
}

export function saveHoliday(holiday: Holiday): void {
  const data = loadData();
  const idx = data.holidays.findIndex((h) => h.id === holiday.id);
  if (idx >= 0) {
    data.holidays[idx] = holiday;
  } else {
    data.holidays.push(holiday);
  }
  saveData(data);
}

export function deleteHoliday(id: string): void {
  const data = loadData();
  data.holidays = data.holidays.filter((h) => h.id !== id);
  saveData(data);
}

export function getSettings(): Settings {
  return loadData().settings;
}

export function saveSettings(settings: Settings): void {
  const data = loadData();
  data.settings = settings;
  saveData(data);
}
