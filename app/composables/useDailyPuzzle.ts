import type { Grid } from '../types/sudoku';
import { generatePuzzle, makeRng, seedFromString } from '../utils/sudokuCore';

const DAILY_REMOVE_TARGET = 45;

/** Local calendar date (YYYY-MM-DD) — the daily rolls over at local midnight, not UTC. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministic per-date puzzle with a guaranteed unique solution. */
export function generateDailyBoard(dateStr: string): Grid {
  return generatePuzzle(DAILY_REMOVE_TARGET, makeRng(seedFromString(dateStr))).puzzle;
}

/**
 * Consecutive completed days ending today, or ending yesterday when
 * today's puzzle hasn't been finished yet (an unplayed today doesn't
 * break the streak until the day is over).
 */
export function computeStreak(isCompleted: (key: string) => boolean, today: Date = new Date()): number {
  const day = new Date(today);
  if (!isCompleted(localDateKey(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (isCompleted(localDateKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

const SAVE_PREFIX = 'sudoku_v1_daily_';

interface DailyRecord {
  completed: boolean;
  time: number;
  mistakes: number;
}

export function useDailyPuzzle() {
  const key = localDateKey();

  function getBoard(): Grid {
    return generateDailyBoard(key);
  }

  function getRecordFor(dateKey: string): DailyRecord | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + dateKey);
      return raw ? (JSON.parse(raw) as DailyRecord) : null;
    } catch {
      return null;
    }
  }

  function getRecord(): DailyRecord | null {
    return getRecordFor(key);
  }

  function markComplete(time: number, mistakes: number): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SAVE_PREFIX + key, JSON.stringify({ completed: true, time, mistakes }));
    } catch { }
  }

  function getStreak(): number {
    return computeStreak(k => getRecordFor(k)?.completed === true);
  }

  return { getBoard, getRecord, markComplete, getStreak, dateKey: key };
}
