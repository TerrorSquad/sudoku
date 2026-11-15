import type { Grid } from "../types/sudoku";

import { readJSON, writeJSON } from "../utils/safeJson";
import { streakState } from "../utils/streak";
import { generatePuzzle, makeRng, seedFromString } from "../utils/sudokuCore";

const DAILY_REMOVE_TARGET = 45;

/** Local calendar date (YYYY-MM-DD) — the daily rolls over at local midnight, not UTC. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Deterministic per-date puzzle with a guaranteed unique solution. */
export function generateDailyBoard(dateStr: string): Grid {
  return generatePuzzle(DAILY_REMOVE_TARGET, makeRng(seedFromString(dateStr))).puzzle;
}

const SAVE_PREFIX = "sudoku_v1_daily_";

interface DailyRecord {
  completed: boolean;
  time: number;
  mistakes: number;
}

/** Fastest completed Daily among the stored `keys`, in seconds; 0 when there is none. */
export function fastestDaily(
  keys: string[],
  getRecordFor: (dateKey: string) => DailyRecord | null,
): number {
  let best = 0;
  for (const key of keys) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const r = getRecordFor(key.slice(SAVE_PREFIX.length));
    if (r?.completed && r.time > 0 && (best === 0 || r.time < best)) best = r.time;
  }
  return best;
}

export function useDailyPuzzle() {
  // Evaluated per call, not once: a tab or PWA left open past midnight must roll over.
  const todayKey = () => localDateKey();

  function getBoard(): Grid {
    return generateDailyBoard(todayKey());
  }

  function getRecordFor(dateKey: string): DailyRecord | null {
    return readJSON<DailyRecord | null>(SAVE_PREFIX + dateKey, null);
  }

  function getRecord(): DailyRecord | null {
    return getRecordFor(todayKey());
  }

  /** `dateKey` is the Daily's own day: a game started before midnight can end after it. */
  function markComplete(time: number, mistakes: number, dateKey: string): void {
    writeJSON(SAVE_PREFIX + dateKey, { completed: true, time, mistakes });
  }

  function storedKeys(): string[] {
    try {
      return Object.keys(localStorage);
    } catch {
      return []; // SSR or blocked storage: no history to compare against.
    }
  }

  function getBestTime(): number {
    return fastestDaily(storedKeys(), getRecordFor);
  }

  /** Current and longest streak, freezes held and the days they covered (utils/streak.ts). */
  function getStreakState() {
    const dates = storedKeys()
      .filter((k) => k.startsWith(SAVE_PREFIX))
      .map((k) => k.slice(SAVE_PREFIX.length))
      .filter((d) => getRecordFor(d)?.completed);
    return streakState(dates, todayKey());
  }
  const getStreak = () => getStreakState().current;
  const getLongestStreak = () => getStreakState().longest;

  return {
    getBoard,
    getRecord,
    getRecordFor,
    markComplete,
    getStreak,
    getBestTime,
    getLongestStreak,
    getStreakState,
    todayKey,
  };
}
