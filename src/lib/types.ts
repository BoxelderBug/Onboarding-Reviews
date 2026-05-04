export type ReviewType = 30 | 60 | 180;

export interface Review {
  type: ReviewType;
  calculatedDate: string; // YYYY-MM-DD
  calculatedTime: string; // HH:MM
  overrideEnabled: boolean;
  overrideDate: string; // YYYY-MM-DD
  overrideTime: string; // HH:MM
  gcalEventId?: string;
}

export interface Location {
  id: string;
  name: string;
  resourceEmail?: string; // Google Workspace room resource email
}

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  prependEmployees?: boolean;
  locationText?: string;
  locationId?: string;
  startTime: string; // HH:MM
  duration: number; // minutes
  inviteEmployee: boolean;
  inviteManager: boolean;
  additionalEmails: string; // comma-separated
}

export interface SchedulePushRecord {
  templateEventId: string;
  day: 1 | 2;
  scheduleDate: string; // YYYY-MM-DD — the Day 1 date this was pushed for
  gcalEventId: string;
}

export interface Employee {
  id: string;
  lastName: string;
  firstName: string;
  positionId: string;
  managerId?: string;
  outOfState: boolean;
  email: string;
  startDate: string; // YYYY-MM-DD
  reviews: Review[];
  schedulingPushes?: SchedulePushRecord[];
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD (year is ignored if recurring)
  recurring: boolean;
}

export interface ReviewTemplate {
  title: string;
  description: string;
}

export interface Position {
  id: string;
  name: string;
  startTime: string; // HH:MM
  duration: number; // minutes
  reviewTemplates?: {
    30?: ReviewTemplate;
    60?: ReviewTemplate;
    180?: ReviewTemplate;
  };
}

export interface Manager {
  id: string;
  name: string;
  email: string;
}

export interface Settings {
  defaultStartTime: string; // HH:MM
  defaultDuration: number; // minutes
  positions: Position[];
  managers: Manager[];
  locations: Location[];
  reviewEmails: Record<ReviewType, string>; // comma-separated per review type
  concurrentReviewPairs: string[]; // e.g. ["30-60"] — pairs allowed to overlap without conflict warning
  calendarTimeZone: string;
  firstDaySchedule: ScheduleEvent[];
  secondDaySchedule: ScheduleEvent[];
}

export interface AppData {
  employees: Employee[];
  holidays: Holiday[];
  settings: Settings;
}
