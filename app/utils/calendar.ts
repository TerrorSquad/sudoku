// Pure calendar layout for the Daily activity heat-map — no Vue, no storage.
// Unit-tested in tests/calendar.test.ts.

import { localDateKey } from "../composables/useDailyPuzzle";

export interface CalendarDay {
  key: string;
  /** After today: rendered as an empty slot so the grid stays rectangular. */
  future: boolean;
}

/**
 * `weeks` columns of 7 days (Monday first) ending with the week that contains `today`.
 * Returned column-major: index = week * 7 + weekday.
 */
export function calendarDays(today: Date, weeks: number): CalendarDay[] {
  const sinceMonday = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - sinceMonday - (weeks - 1) * 7);
  const todayKey = localDateKey(today);
  const days: CalendarDay[] = [];
  const d = new Date(start);
  for (let i = 0; i < weeks * 7; i++) {
    const key = localDateKey(d);
    days.push({ key, future: key > todayKey });
    d.setDate(d.getDate() + 1);
  }
  return days;
}
