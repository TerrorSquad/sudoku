import type { Difficulty, Grid } from "../types/sudoku";

import { readJSON, writeJSON } from "../utils/safeJson";
import { localDateKey, streakState } from "../utils/streak";
import { generatePuzzle, makeRng, seedFromString } from "../utils/sudokuCore";
import { generateGradedPuzzle } from "../utils/sudokuGrader";

const DAILY_REMOVE_TARGET = 45;

/**
 * Deterministic per-date (and per-level) puzzle with a guaranteed unique solution. Medium is the
 * original Daily: its seed and digging never change, so its boards, records and leaderboards carry
 * on. Every other level is a graded board of that level, seeded from the date and the level.
 */
export function generateDailyBoard(dateStr: string, level: Difficulty = "medium"): Grid {
  if (level === "medium")
    return generatePuzzle(DAILY_REMOVE_TARGET, makeRng(seedFromString(dateStr))).puzzle;
  return generateGradedPuzzle(level, makeRng(seedFromString(`${dateStr}:${level}`))).puzzle;
}

const SAVE_PREFIX = "sudoku_v1_daily_";

/** A Daily's record key: Medium keeps the original sudoku_v1_daily_<date>, the rest add the level. */
export const dailyKey = (dateKey: string, level: Difficulty = "medium") =>
  SAVE_PREFIX + (level === "medium" ? "" : `${level}_`) + dateKey;

/** The level and date of a Daily record key, or null for any other key. */
export function parseDailyKey(key: string): { level: Difficulty; date: string } | null {
  const m = /^sudoku_v1_daily_(?:(beginner|easy|hard|expert|master)_)?(\d{4}-\d{2}-\d{2})$/.exec(
    key,
  );
  return m ? { level: (m[1] ?? "medium") as Difficulty, date: m[2]! } : null;
}

interface DailyRecord {
  completed: boolean;
  time: number;
  mistakes: number;
}

type ReadRecord = (dateKey: string, level: Difficulty) => DailyRecord | null;

/** Fastest completed `level` Daily among the stored `keys`, in seconds; 0 when there is none. */
export function fastestDaily(
  keys: string[],
  getRecordFor: ReadRecord,
  level: Difficulty = "medium",
) {
  let best = 0;
  for (const key of keys) {
    const k = parseDailyKey(key);
    if (k?.level !== level) continue;
    const r = getRecordFor(k.date, level);
    if (r?.completed && r.time > 0 && (best === 0 || r.time < best)) best = r.time;
  }
  return best;
}

/** The days any Daily was completed: what the streak and the calendar count. */
export function completedDays(keys: string[], getRecordFor: ReadRecord): string[] {
  return keys
    .map(parseDailyKey)
    .filter((k) => k && getRecordFor(k.date, k.level)?.completed)
    .map((k) => k!.date);
}

export function useDailyPuzzle() {
  // Evaluated per call, not once: a tab left open past midnight must roll over.
  const todayKey = () => localDateKey();

  function getRecordFor(dateKey: string, level: Difficulty = "medium"): DailyRecord | null {
    return readJSON<DailyRecord | null>(dailyKey(dateKey, level), null);
  }

  function getRecord(level: Difficulty = "medium"): DailyRecord | null {
    return getRecordFor(todayKey(), level);
  }

  /** `dateKey` is the Daily's own day: a game started before midnight can end after it. */
  function markComplete(time: number, mistakes: number, dateKey: string, level: Difficulty) {
    writeJSON(dailyKey(dateKey, level), { completed: true, time, mistakes });
  }

  function storedKeys(): string[] {
    try {
      return Object.keys(localStorage);
    } catch {
      return []; // SSR or blocked storage: no history to compare against.
    }
  }

  function getBestTime(level: Difficulty = "medium"): number {
    return fastestDaily(storedKeys(), getRecordFor, level);
  }

  const getCompletedDays = () => new Set(completedDays(storedKeys(), getRecordFor));

  /**
   * Current and longest streak, freezes held and the days they covered (utils/streak.ts). A day
   * counts when any Daily was done: one who only ever played Medium keeps the same streak.
   */
  function getStreakState() {
    return streakState([...getCompletedDays()], todayKey());
  }
  const getStreak = () => getStreakState().current;
  const getLongestStreak = () => getStreakState().longest;

  return {
    getRecord,
    getRecordFor,
    markComplete,
    getStreak,
    getBestTime,
    getLongestStreak,
    getStreakState,
    getCompletedDays,
    todayKey,
  };
}
