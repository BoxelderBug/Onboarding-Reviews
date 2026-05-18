import type { AppData, ApplicantStatusConfig, Employee, Holiday, Interviewer, Location, ScoreOption, Settings } from './types';

const STORAGE_KEY = 'onboarding-reviews';

export const DEFAULT_JOB_SOURCES: string[] = [
  'Indeed', 'ZipRecruiter', 'Website', "Adam's", 'EE Referral', 'Career Fair',
  'Craigslist', 'Facebook', 'Glassdoor', 'JobsHQ', 'LinkedIn', 'LJ Network',
  'MN Diversity', 'MN Works', 'NPMA', 'Handshake', 'Instagram', 'Vocational',
  'DEED', 'KFAN', 'Internal', 'Email Comp', 'ADP', 'Other',
];

export const DEFAULT_APPLICANT_STATUSES: ApplicantStatusConfig[] = [
  { value: 'new',                 label: 'New',                          category: 'pipeline' },
  { value: 'unable-to-connect',   label: 'Unable to Connect',            category: 'dropped'  },
  { value: 'phone-scheduled',     label: 'Phone Interview Scheduled',    category: 'pipeline' },
  { value: 'no-phone-needed',     label: 'No Phone Interview Needed',    category: 'pipeline' },
  { value: 'rejected-phone',      label: 'Rejected at Phone Interview',  category: 'rejected' },
  { value: 'interview-scheduled', label: 'Interview Scheduled',          category: 'pipeline' },
  { value: 'no-call-no-show',     label: 'No Call No Show',              category: 'dropped'  },
  { value: 'rejected-interview',  label: 'Rejected at Interview',        category: 'rejected' },
  { value: 'offer-extended',      label: 'Offer Extended',               category: 'pipeline' },
  { value: 'offer-accepted',      label: 'Offer Accepted',               category: 'pipeline' },
  { value: 'offer-declined',      label: 'Offer Declined',               category: 'dropped'  },
  { value: 'offer-rescinded',     label: 'Offer Rescinded',              category: 'rejected' },
  { value: 'withdrew',            label: 'Withdrew',                     category: 'dropped'  },
  { value: 'hired',               label: 'Hired',                        category: 'hired'    },
];

export const DEFAULT_PHONE_SCORE_OPTIONS: ScoreOption[] = [
  { value: 'red',    label: 'Red',    color: 'red'    },
  { value: 'yellow', label: 'Yellow', color: 'yellow' },
  { value: 'green',  label: 'Green',  color: 'green'  },
];

export const DEFAULT_INTERVIEW_SCORE_OPTIONS: ScoreOption[] = [
  { value: 'red',    label: 'Red',    color: 'red'    },
  { value: 'yellow', label: 'Yellow', color: 'yellow' },
  { value: 'green',  label: 'Green',  color: 'green'  },
  { value: 'na',     label: 'N/A',    color: 'gray'   },
];

export const DEFAULT_INTERVIEWERS: Interviewer[] = [];

export const DEFAULT_LOCATION_MEDINA_ID = 'loc_medina';
export const DEFAULT_LOCATION_NISSWA_ID = 'loc_nisswa';

export const DEFAULT_LOCATIONS: Location[] = [
  { id: DEFAULT_LOCATION_MEDINA_ID, name: 'Medina' },
  { id: DEFAULT_LOCATION_NISSWA_ID, name: 'Nisswa' },
];

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
    locations: DEFAULT_LOCATIONS,
    reviewEmails: { 30: '', 60: '', 180: '' },
    concurrentReviewPairs: [],
    calendarTimeZone: 'America/Chicago',
    firstDaySchedule: [],
    secondDaySchedule: [],
    jobSources: DEFAULT_JOB_SOURCES,
    interviewers: DEFAULT_INTERVIEWERS,
    phoneScoreOptions: DEFAULT_PHONE_SCORE_OPTIONS,
    interviewScoreOptions: DEFAULT_INTERVIEW_SCORE_OPTIONS,
    applicantStatuses: DEFAULT_APPLICANT_STATUSES,
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
        locations:
          parsed.settings?.locations && parsed.settings.locations.length > 0
            ? (parsed.settings.locations as Location[])
            : DEFAULT_LOCATIONS,
        reviewEmails: parsed.settings?.reviewEmails ?? { 30: '', 60: '', 180: '' },
        concurrentReviewPairs: parsed.settings?.concurrentReviewPairs ?? [],
        calendarTimeZone:
          parsed.settings?.calendarTimeZone ?? DEFAULT_DATA.settings.calendarTimeZone,
        firstDaySchedule: parsed.settings?.firstDaySchedule ?? [],
        secondDaySchedule: parsed.settings?.secondDaySchedule ?? [],
        jobSources:
          parsed.settings?.jobSources && parsed.settings.jobSources.length > 0
            ? parsed.settings.jobSources
            : DEFAULT_JOB_SOURCES,
        interviewers: parsed.settings?.interviewers ?? DEFAULT_INTERVIEWERS,
        phoneScoreOptions:
          parsed.settings?.phoneScoreOptions && parsed.settings.phoneScoreOptions.length > 0
            ? parsed.settings.phoneScoreOptions
            : DEFAULT_PHONE_SCORE_OPTIONS,
        interviewScoreOptions:
          parsed.settings?.interviewScoreOptions && parsed.settings.interviewScoreOptions.length > 0
            ? parsed.settings.interviewScoreOptions
            : DEFAULT_INTERVIEW_SCORE_OPTIONS,
        applicantStatuses:
          parsed.settings?.applicantStatuses && parsed.settings.applicantStatuses.length > 0
            ? parsed.settings.applicantStatuses
            : DEFAULT_APPLICANT_STATUSES,
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
