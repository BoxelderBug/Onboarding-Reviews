import type { Holiday, Position, Review, ReviewType, Settings } from './types';

/**
 * Parse a YYYY-MM-DD string as a local date (avoids UTC offset issues).
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Convert a Date to YYYY-MM-DD string using local time.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Display a date in a human-friendly format: Mon, Jan 1 2025
 */
export function displayDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a time string HH:MM to 12-hour format: 9:00 AM
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${ampm}`;
}

/**
 * Check if a date is blocked by a holiday.
 */
function isHoliday(date: Date, holidays: Holiday[]): boolean {
  const dateStr = toDateString(date);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const h of holidays) {
    if (h.recurring) {
      const [, hMonth, hDay] = h.date.split('-').map(Number);
      if (hMonth === month && hDay === day) return true;
    } else {
      if (h.date === dateStr) return true;
    }
  }
  return false;
}

/**
 * Advance a date forward past weekends and holidays until a working day.
 */
export function calcReviewDate(base: Date, holidays: Holiday[]): Date {
  const result = new Date(base.getTime());
  while (true) {
    const dow = result.getDay(); // 0=Sun, 6=Sat
    if (dow === 0) {
      result.setDate(result.getDate() + 1);
      continue;
    }
    if (dow === 6) {
      result.setDate(result.getDate() + 2);
      continue;
    }
    if (isHoliday(result, holidays)) {
      result.setDate(result.getDate() + 1);
      continue;
    }
    break;
  }
  return result;
}

/**
 * Build/rebuild all 3 reviews for an employee.
 * Preserves existing override settings (enabled flag + override values).
 */
export function buildReviews(
  startDate: string,
  positionId: string,
  positions: Position[],
  settings: Settings,
  holidays: Holiday[],
  existingReviews: Review[] = []
): Review[] {
  const position = positions.find((p) => p.id === positionId);
  const time = position?.startTime || settings.defaultStartTime;

  const base = parseLocalDate(startDate);
  const reviewTypes: ReviewType[] = [30, 60, 180];

  return reviewTypes.map((type) => {
    const existing = existingReviews.find((r) => r.type === type);

    const offsetDate = new Date(base.getTime());
    offsetDate.setDate(offsetDate.getDate() + type);
    const adjusted = calcReviewDate(offsetDate, holidays);
    const calculatedDate = toDateString(adjusted);
    const calculatedTime = time;

    return {
      type,
      calculatedDate,
      calculatedTime,
      overrideEnabled: existing?.overrideEnabled ?? false,
      overrideDate: existing?.overrideDate ?? calculatedDate,
      overrideTime: existing?.overrideTime ?? calculatedTime,
    };
  });
}

/**
 * Get the effective date for a review (override or calculated).
 */
export function effectiveDate(review: Review): string {
  return review.overrideEnabled ? review.overrideDate : review.calculatedDate;
}

/**
 * Get the effective time for a review (override or calculated).
 */
export function effectiveTime(review: Review): string {
  return review.overrideEnabled ? review.overrideTime : review.calculatedTime;
}

/**
 * Return the number of days until the review date (negative = overdue).
 */
export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Return the next business day (non-weekend, non-holiday) after a given date.
 */
export function nextBusinessDay(dateStr: string, holidays: Holiday[]): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + 1);
  return toDateString(calcReviewDate(d, holidays));
}

/**
 * Returns: 'overdue' | 'today' | 'upcoming'
 */
export function reviewStatus(dateStr: string): 'overdue' | 'today' | 'upcoming' {
  const days = daysUntil(dateStr);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return 'upcoming';
}
