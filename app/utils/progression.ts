// Progression rules: which difficulties are open, the Academy's technique path and the
// technique of the week. Pure; unit-tested in tests/progression.test.ts.

import type { Difficulty } from "../types/sudoku";
import type { TechniqueId } from "./sudokuGrader";

// ---- Difficulty unlocks -------------------------------------------------------------------

export const LADDER: Difficulty[] = ["beginner", "easy", "medium", "hard", "expert", "master"];
/** Wins at the level below (or harder) that open the next one. */
export const WINS_TO_UNLOCK = 2;

/** useScore's perDifficulty map: the win counts that already exist and already sync. */
export type WinsByDifficulty = Record<string, { wins: number } | undefined>;

const winsFrom = (wins: WinsByDifficulty, i: number) =>
  LADDER.slice(i).reduce((n, d) => n + (wins[d]?.wins ?? 0), 0);

export interface Lock {
  /** The level whose wins (or harder ones) open this one. */
  at: Difficulty;
  have: number;
  need: number;
}

/**
 * null when `level` is open. Beginner–Medium (and custom) are always open; a harder level opens
 * after WINS_TO_UNLOCK wins at the level below or harder. A win at the level itself or harder
 * keeps it open (nobody loses what they've beaten), as does a game in progress at it.
 */
export function lockOf(level: Difficulty, wins: WinsByDifficulty, hasSave = false): Lock | null {
  const i = LADDER.indexOf(level);
  if (i < 3 || hasSave || winsFrom(wins, i) > 0) return null;
  const have = winsFrom(wins, i - 1);
  return have >= WINS_TO_UNLOCK ? null : { at: LADDER[i - 1]!, have, need: WINS_TO_UNLOCK };
}

/** Levels a win just opened: locked by `before`'s wins, open by `after`'s. */
export function levelsOpenedBy(before: WinsByDifficulty, after: WinsByDifficulty): Difficulty[] {
  return LADDER.filter((d) => lockOf(d, before) && !lockOf(d, after));
}

// ---- Technique path -----------------------------------------------------------------------

export type Tier = "Basic" | "Intermediate" | "Advanced" | "Expert";

/** The Academy's techniques in its order, which is also the path's challenge order. */
export const ACADEMY_TECHNIQUES: { id: TechniqueId; tier: Tier }[] = [
  { id: "naked-single", tier: "Basic" },
  { id: "hidden-single", tier: "Basic" },
  { id: "pointing", tier: "Intermediate" },
  { id: "box-line", tier: "Intermediate" },
  { id: "naked-pair", tier: "Intermediate" },
  { id: "hidden-pair", tier: "Intermediate" },
  { id: "naked-triple", tier: "Intermediate" },
  { id: "hidden-triple", tier: "Intermediate" },
  { id: "naked-quad", tier: "Advanced" },
  { id: "hidden-quad", tier: "Advanced" },
  { id: "x-wing", tier: "Advanced" },
  { id: "swordfish", tier: "Advanced" },
  { id: "skyscraper", tier: "Advanced" },
  { id: "two-string-kite", tier: "Advanced" },
  { id: "finned-x-wing", tier: "Advanced" },
  { id: "jellyfish", tier: "Advanced" },
  { id: "unique-rectangle", tier: "Expert" },
  { id: "xy-wing", tier: "Expert" },
  { id: "w-wing", tier: "Expert" },
  { id: "xyz-wing", tier: "Expert" },
  { id: "simple-coloring", tier: "Expert" },
  { id: "bug-plus-one", tier: "Expert" },
];

/**
 * Where practice.ts's search (600 digs) usually comes up empty and starts the Academy drill
 * instead, so winning the drill has to count. Measured over 40 seeds: hidden quad 1/40 real
 * puzzles, jellyfish 2/40, naked quad 12/40; everything else 25/40 or better (simple coloring
 * the lowest), so for those only a real puzzle completes the challenge.
 */
export const DRILL_COUNTS: ReadonlySet<TechniqueId> = new Set([
  "naked-quad",
  "hidden-quad",
  "jellyfish",
]);

/** The first technique on the path not yet completed; null once all are. */
export function nextChallenge(done: readonly string[]): TechniqueId | null {
  return ACADEMY_TECHNIQUES.find((t) => !done.includes(t.id))?.id ?? null;
}

/** Whether winning a practice game of `id` completes the current challenge. */
export function completesChallenge(
  id: TechniqueId,
  kind: "puzzle" | "drill",
  done: readonly string[],
): boolean {
  return id === nextChallenge(done) && (kind === "puzzle" || DRILL_COUNTS.has(id));
}

// ---- Technique of the week ----------------------------------------------------------------

/** Techniques the generator reliably finds puzzles for, so the week's puzzle is a real one. */
export const WEEKLY_TECHNIQUES = ACADEMY_TECHNIQUES.map((t) => t.id).filter(
  (id) => !DRILL_COUNTS.has(id),
);

const DAY = 86_400_000;

/** The ISO week (Monday-first) of a local date, e.g. "2026-W46"; seeds the week's puzzle. */
export function isoWeekKey(date: Date = new Date()): string {
  // Thursday decides the ISO year; UTC midnights avoid DST-length days.
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const thursday = new Date(day + (3 - ((new Date(day).getUTCDay() + 6) % 7)) * DAY);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Rotates through WEEKLY_TECHNIQUES one ISO week at a time, the same for everyone. */
export function techniqueOfWeek(date: Date = new Date()): TechniqueId {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  // 1970-01-05 was a Monday: whole weeks since then.
  const weeks = Math.floor((day - 4 * DAY) / (7 * DAY));
  return WEEKLY_TECHNIQUES[weeks % WEEKLY_TECHNIQUES.length]!;
}
