export type ReviewType = 30 | 60 | 180;

export interface Review {
  type: ReviewType;
  calculatedDate: string; // YYYY-MM-DD
  calculatedTime: string; // HH:MM
  overrideEnabled: boolean;
  overrideDate: string; // YYYY-MM-DD
  overrideTime: string; // HH:MM
}

export interface Employee {
  id: string;
  lastName: string;
  firstName: string;
  positionId: string;
  outOfState: boolean;
  email: string;
  startDate: string; // YYYY-MM-DD
  reviews: Review[];
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD (year is ignored if recurring)
  recurring: boolean;
}

export interface Position {
  id: string;
  name: string;
  startTime: string; // HH:MM
  duration: number; // minutes
}

export interface Settings {
  defaultStartTime: string; // HH:MM
  defaultDuration: number; // minutes
  positions: Position[];
}

export interface AppData {
  employees: Employee[];
  holidays: Holiday[];
  settings: Settings;
}
