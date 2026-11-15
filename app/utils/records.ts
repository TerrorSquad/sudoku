// Personal records: pure update rules, no Vue or storage. Unit-tested in tests/records.test.ts.
//
// Only what the stored data can honestly answer. Fastest times already live in useScore
// (perDifficulty.bestTime) and the longest Daily streak is derived from the Daily history, so
// neither is stored here. The rest count from the first win after this shipped: no history of
// win dates, mistakes or hints per game exists to backfill them from.

import type { Difficulty } from "../types/sudoku";

import { LADDER } from "./progression";

export const RECORDS_KEY = "sudoku_v1_records";

export interface Records {
  /** Local date (YYYY-MM-DD) of the latest win, and how many wins that day has had. */
  day: string;
  dayWins: number;
  mostInDay: number;
  /** Wins in a row without a mistake: the current run and the longest. */
  cleanRun: number;
  bestCleanRun: number;
  /** The hardest level won without a hint. */
  hardestNoHint: Difficulty | null;
}

export const NO_RECORDS: Records = {
  day: "",
  dayWins: 0,
  mostInDay: 0,
  cleanRun: 0,
  bestCleanRun: 0,
  hardestNoHint: null,
};

const count = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : 0);
const rank = (d: Difficulty | null) => (d ? LADDER.indexOf(d) : -1);
const harder = (a: Difficulty | null, b: Difficulty | null) => (rank(a) > rank(b) ? a : b);

/** Whatever is stored, as valid records: a damaged field reads as no record yet. */
export function readRecords(raw: unknown): Records {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    day: typeof r.day === "string" ? r.day : "",
    dayWins: count(r.dayWins),
    mostInDay: count(r.mostInDay),
    cleanRun: count(r.cleanRun),
    bestCleanRun: count(r.bestCleanRun),
    hardestNoHint: LADDER.includes(r.hardestNoHint as Difficulty)
      ? (r.hardestNoHint as Difficulty)
      : null,
  };
}

export interface WinFacts {
  day: string;
  difficulty: Difficulty;
  mistakes: number;
  hints: number;
}

export function addWin(rec: Records, win: WinFacts): Records {
  const dayWins = win.day === rec.day ? rec.dayWins + 1 : 1;
  const cleanRun = win.mistakes === 0 ? rec.cleanRun + 1 : 0;
  return {
    day: win.day,
    dayWins,
    mostInDay: Math.max(rec.mostInDay, dayWins),
    cleanRun,
    bestCleanRun: Math.max(rec.bestCleanRun, cleanRun),
    hardestNoHint: win.hints === 0 ? harder(win.difficulty, rec.hardestNoHint) : rec.hardestNoHint,
  };
}

/** The first mistake in a game ends the clean run, whether the game is then won or abandoned. */
export const breakCleanRun = (rec: Records): Records => ({ ...rec, cleanRun: 0 });

/** Two copies of the records as one: the better of each best, `incoming`'s running counts. */
export function mergeRecords(other: Records, incoming: Records): Records {
  return {
    ...incoming,
    mostInDay: Math.max(other.mostInDay, incoming.mostInDay),
    bestCleanRun: Math.max(other.bestCleanRun, incoming.bestCleanRun),
    hardestNoHint: harder(incoming.hardestNoHint, other.hardestNoHint),
  };
}

/** Everything a win can break, read just before and just after recording it. */
export interface Snapshot extends Records {
  /** This difficulty's fastest win in seconds; 0 = none, or not a timed level. */
  fastest: number;
  /** Longest Daily streak ever. */
  streak: number;
}

export type NewRecord =
  | { kind: "fastest"; value: number; was: number }
  | { kind: "noHint"; value: Difficulty; was: Difficulty }
  | { kind: "streak" | "cleanRun" | "mostInDay"; value: number; was: number };

/**
 * The records a win broke, most notable first. Only ones that beat an earlier value: a first win
 * at a level sets a record, it doesn't break one, and saying so after every first game is noise.
 */
export function brokenRecords(before: Snapshot, after: Snapshot): NewRecord[] {
  const out: NewRecord[] = [];
  if (before.fastest && after.fastest < before.fastest)
    out.push({ kind: "fastest", value: after.fastest, was: before.fastest });
  if (before.hardestNoHint && rank(after.hardestNoHint) > rank(before.hardestNoHint))
    out.push({ kind: "noHint", value: after.hardestNoHint!, was: before.hardestNoHint });
  for (const [kind, key] of [
    ["streak", "streak"],
    ["cleanRun", "bestCleanRun"],
    ["mostInDay", "mostInDay"],
  ] as const) {
    if (before[key] && after[key] > before[key])
      out.push({ kind, value: after[key], was: before[key] });
  }
  return out;
}
