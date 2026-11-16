// Progression rules: which difficulties are open, the Academy's technique path and the
// technique of the week. Pure; unit-tested in tests/progression.test.ts.

import type { Difficulty } from "../types/sudoku";
import type { TechniqueId } from "./sudokuGrader";

// ---- Difficulty unlocks -------------------------------------------------------------------

export const LADDER: Difficulty[] = ["beginner", "easy", "medium", "hard", "expert", "master"];
/** Wins at the level below (or harder) that open the next one. */
const WINS_TO_UNLOCK = 2;

/** useScore's perDifficulty map (the win counts that already exist and already sync). */
export type WinsByDifficulty = Record<string, { wins: number; best?: number } | undefined>;

/** Beginner to Medium (and custom, off the ladder) are always open. */
const LAST_OPEN = LADDER.indexOf("medium");

// A best score with no wins is a level beaten before wins were counted (useScore's migration).
const winsAt = (e: WinsByDifficulty[string]) => Math.max(e?.wins ?? 0, (e?.best ?? 0) > 0 ? 1 : 0);
const winsFrom = (wins: WinsByDifficulty, i: number) =>
  LADDER.slice(i).reduce((n, d) => n + winsAt(wins[d]), 0);

interface Lock {
  /** The level whose wins (or harder ones) open this one. */
  at: Difficulty;
  have: number;
  need: number;
}

/**
 * null when `level` is open. A level past Medium opens after WINS_TO_UNLOCK wins at the level
 * below or harder. A win at the level itself or harder keeps it open (nobody loses what they've
 * beaten), as does a game in progress at it.
 */
export function lockOf(level: Difficulty, wins: WinsByDifficulty, hasSave = false): Lock | null {
  const i = LADDER.indexOf(level);
  if (i <= LAST_OPEN || hasSave || winsFrom(wins, i) > 0) return null;
  const have = winsFrom(wins, i - 1);
  return have >= WINS_TO_UNLOCK ? null : { at: LADDER[i - 1]!, have, need: WINS_TO_UNLOCK };
}

/** The levels locked right now; a win that opens one of them announces it. */
export function lockedLevels(
  wins: WinsByDifficulty,
  hasSave: (d: Difficulty) => boolean,
): Difficulty[] {
  return LADDER.filter((d) => lockOf(d, wins, hasSave(d)));
}

/**
 * Zen wins score nothing, so they live in their own {difficulty: count} map; they still open
 * levels. `zen` is read from storage, so anything malformed is ignored.
 */
export function withZenWins(wins: WinsByDifficulty, zen: unknown): WinsByDifficulty {
  const out = { ...wins };
  if (!zen || typeof zen !== "object") return out;
  for (const [d, n] of Object.entries(zen)) {
    if (typeof n === "number" && n > 0) out[d] = { ...out[d], wins: (out[d]?.wins ?? 0) + n };
  }
  return out;
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
  { id: "empty-rectangle", tier: "Advanced" },
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
 * Where practice.ts's search (600 digs) usually comes up empty and falls back to the Academy's
 * example. Measured over 40 seeds (with Empty Rectangle in the solver): jellyfish 0/40 real
 * puzzles, hidden quad 1/40, simple coloring 12/40, naked quad 12/40; everything else 27/40 or
 * better (Empty Rectangle the lowest).
 */
export const RARE_IN_PUZZLES: ReadonlySet<TechniqueId> = new Set([
  "naked-quad",
  "hidden-quad",
  "jellyfish",
  "simple-coloring",
]);

/** The first technique on the path not yet completed; null once all are. */
export function nextChallenge(done: readonly string[]): TechniqueId | null {
  return ACADEMY_TECHNIQUES.find((t) => !done.includes(t.id))?.id ?? null;
}

/**
 * Whether finishing `id`'s lesson completes the current challenge (the path goes in order). Only
 * the lesson checks that the technique was applied, so a practice win never does.
 */
export function completesChallenge(id: TechniqueId, done: readonly string[]): boolean {
  return id === nextChallenge(done);
}

/**
 * The lesson a finished one leads to: the path's next step when this lesson was it, else the next
 * technique in the Academy's order. Null after the last.
 */
export function nextLesson(
  id: TechniqueId,
  done: readonly string[],
  credited: boolean,
): TechniqueId | null {
  const after = ACADEMY_TECHNIQUES[ACADEMY_TECHNIQUES.findIndex((t) => t.id === id) + 1]?.id;
  return (credited ? nextChallenge(done) : null) ?? after ?? null;
}

// ---- Technique map ------------------------------------------------------------------------

/**
 * What each technique builds on, for the Academy's map: the idea it extends (a pair → a triple
 * → a quad, X-Wing → Swordfish → Jellyfish), or the reasoning it needs first (single-digit links
 * for the kite and colouring, bivalue cells for the wings). Every technique but the first has
 * one or two; the map draws a line from each. Acyclic (tests/progression.test.ts).
 */
export const BUILDS_ON: Partial<Record<TechniqueId, TechniqueId[]>> = {
  "hidden-single": ["naked-single"],
  pointing: ["hidden-single"],
  "box-line": ["pointing"],
  "naked-pair": ["naked-single"],
  "hidden-pair": ["hidden-single", "naked-pair"],
  "naked-triple": ["naked-pair"],
  "hidden-triple": ["hidden-pair"],
  "naked-quad": ["naked-triple"],
  "hidden-quad": ["hidden-triple"],
  "x-wing": ["box-line"],
  swordfish: ["x-wing"],
  skyscraper: ["x-wing"],
  "two-string-kite": ["skyscraper"],
  // A pointing pair on two lines at once, joined to a strong link the way the kite's box joins two.
  "empty-rectangle": ["pointing", "two-string-kite"],
  "finned-x-wing": ["x-wing"],
  jellyfish: ["swordfish"],
  "unique-rectangle": ["naked-pair"],
  "xy-wing": ["naked-pair"],
  "w-wing": ["xy-wing"],
  "xyz-wing": ["xy-wing"],
  "simple-coloring": ["two-string-kite"],
  "bug-plus-one": ["unique-rectangle"],
};

/**
 * Each technique's column on the map (its row is its tier). Laid out by hand so most links are
 * a step down or across: the subsets on the left, the fish on the right, columns 1–2 of the
 * Advanced row kept free for the naked pair's lines down to the uniqueness and wing techniques,
 * the Empty Rectangle beside the kite and under pointing's reach,
 * the XY-Wing between the W- and XYZ-Wing, and the fish in a chain off the X-Wing, so only the
 * X-Wing → Swordfish link has to arc over a tile.
 */
export const MAP_COLUMN: Record<TechniqueId, number> = {
  "naked-single": 1,
  "hidden-single": 3,
  "naked-triple": 0,
  "naked-pair": 1,
  "hidden-pair": 3,
  "hidden-triple": 4,
  pointing: 6,
  "box-line": 7,
  "naked-quad": 0,
  "hidden-quad": 3,
  "empty-rectangle": 4,
  "two-string-kite": 5,
  skyscraper: 6,
  "x-wing": 7,
  "finned-x-wing": 8,
  swordfish: 9,
  jellyfish: 10,
  "bug-plus-one": 0,
  "unique-rectangle": 1,
  "w-wing": 2,
  "xy-wing": 3,
  "xyz-wing": 4,
  "simple-coloring": 5, // under the kite it builds on
};

// ---- Lesson stars --------------------------------------------------------------------------

/** Best stars per technique's lesson: 3 with no help and no wrong move, 2 with one, else 1. */
export const LESSON_STARS_KEY = "sudoku_v1_lesson_stars";
export type Stars = 1 | 2 | 3;

export const lessonStarsFor = (slips: number): Stars => (slips === 0 ? 3 : slips === 1 ? 2 : 1);

/** Stored stars, keeping only known techniques and 1–3 (the value comes from storage or sync). */
export function readStars(raw: unknown): Partial<Record<TechniqueId, Stars>> {
  const out: Partial<Record<TechniqueId, Stars>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const { id } of ACADEMY_TECHNIQUES) {
    const v = (raw as Record<string, unknown>)[id];
    if (v === 1 || v === 2 || v === 3) out[id] = v;
  }
  return out;
}

/**
 * Each entry's better best, so a sync in either direction never loses a star. Entries this
 * version doesn't know (a later version's technique, say) pass through as long as they're
 * numbers, so an older client never strips them; readStars leaves them out when reading.
 */
export function mergeStars(a: unknown, b: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const raw of [a, b]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    for (const [id, n] of Object.entries(raw))
      if (typeof n === "number" && Number.isFinite(n)) out[id] = Math.max(out[id] ?? n, n);
  }
  return out;
}

// ---- Technique of the week ----------------------------------------------------------------

/** Techniques the generator reliably finds puzzles for, so the week's puzzle is a real one. */
export const WEEKLY_TECHNIQUES = ACADEMY_TECHNIQUES.map((t) => t.id).filter(
  (id) => !RARE_IN_PUZZLES.has(id),
);

const DAY = 86_400_000;

export interface Week {
  /** The ISO week (Monday-first) of a local date, e.g. "2026-W46". */
  key: string;
  technique: TechniqueId;
  /** Seeds the week's practice puzzle, the same for everyone. */
  seed: string;
}

/** The technique of the week: rotates through WEEKLY_TECHNIQUES one ISO week at a time. */
export function weekOf(date: Date = new Date()): Week {
  // UTC midnights avoid DST-length days; the ISO year is the one its Thursday falls in.
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
  const year = new Date(monday + 3 * DAY).getUTCFullYear();
  const n = 1 + Math.floor((monday + 3 * DAY - Date.UTC(year, 0, 1)) / (7 * DAY));
  const key = `${year}-W${String(n).padStart(2, "0")}`;
  // 1970-01-05 was a Monday: whole weeks since then.
  const technique = WEEKLY_TECHNIQUES[((monday - 4 * DAY) / (7 * DAY)) % WEEKLY_TECHNIQUES.length]!;
  return { key, technique, seed: `${key}:${technique}` };
}
