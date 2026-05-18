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
  additionalEmails?: string; // comma-separated
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
  // ----- Requisition Tracker dropdowns -----
  jobSources: string[];                       // populates Source + Posting Platforms
  interviewers: Interviewer[];                // populates Interviewer multi-select
  phoneScoreOptions: ScoreOption[];           // populates Phone Score buttons
  interviewScoreOptions: ScoreOption[];       // populates Interview Score buttons
  applicantStatuses: ApplicantStatusConfig[]; // populates Status dropdown
}

export interface AppData {
  employees: Employee[];
  holidays: Holiday[];
  settings: Settings;
}

// ---------------------------------------------------------------------------
// Requisition Tracker
// ---------------------------------------------------------------------------

/**
 * Configurable applicant status. `category` drives the funnel sidebar:
 *   - pipeline: still in progress / not yet decided
 *   - hired:    final outcome — hired
 *   - rejected: we said no
 *   - dropped:  they said no / went silent
 */
export type ApplicantStatusCategory = 'pipeline' | 'hired' | 'rejected' | 'dropped';

export interface ApplicantStatusConfig {
  value: string;  // canonical id used in applicant.status
  label: string;  // display label
  category: ApplicantStatusCategory;
}

/** Finite palette of supported pill colors (mapped to Tailwind classes in UI). */
export type ScoreColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

export interface ScoreOption {
  value: string;        // canonical id stored in applicant.*Score
  label: string;        // short display label (e.g. "G", "Green", "N/A")
  color: ScoreColor;    // visual color from the palette
}

/** A person who can interview applicants. Separate from Settings.managers. */
export interface Interviewer {
  id: string;
  name: string;
  email?: string;       // optional, for future calendar invites
}

export interface Applicant {
  id: string;
  name: string;
  source: string;                 // value from Settings.jobSources
  adpCompleteDate?: string;       // YYYY-MM-DD
  phoneInterviewDate?: string;    // YYYY-MM-DD
  phoneInterviewScore?: string;   // value from Settings.phoneScoreOptions
  firstInterviewDate?: string;    // YYYY-MM-DD
  firstInterviewTime?: string;    // HH:MM
  interviewScore?: string;        // value from Settings.interviewScoreOptions
  interviewerIds: string[];       // refs to Settings.interviewers ids
  status: string;                 // value from Settings.applicantStatuses
  notes?: string;
  hiredEmployeeId?: string;       // set when applicant has been turned into an Employee
}

export type RequisitionStatus = 'open' | 'closed' | 'on-hold';

export interface Requisition {
  id: string;
  reqNumber: string;              // e.g. "1439"
  positionTitle: string;          // free-text (e.g. "Seasonal Mosquito Technician")
  positionId?: string;            // optional link to Settings.positions
  locationId?: string;            // ref to Settings.locations
  locationName?: string;          // fallback free-text when no locationId
  openings: number;
  hiringApprovalDate?: string;    // YYYY-MM-DD
  hiringManagerId?: string;       // ref to Settings.managers
  datePosted?: string;            // YYYY-MM-DD
  dateClosed?: string;            // YYYY-MM-DD
  status: RequisitionStatus;
  postingPlatforms: string[];     // values from Settings.jobSources
  applicants: Applicant[];
  notes?: string;
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
