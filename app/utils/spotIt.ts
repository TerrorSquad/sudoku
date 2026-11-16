// Spot it: a timed round of find-the-pattern on real positions, one Academy tier at a time.
// Pure; unit-tested in tests/spotIt.test.ts. The positions come from utils/lesson.ts.

import type { Rng } from "./sudokuCore";
import type { TechniqueId } from "./sudokuGrader";

import { ACADEMY_TECHNIQUES, type Tier } from "./progression";

export const SPOT_TIERS: Tier[] = ["Basic", "Intermediate", "Advanced", "Expert"];
export const ROUND_SIZE = 10;
/** Seconds added for a wrong tap, and for skipping a position (which shows the answer). */
export const MISS_PENALTY = 5;
export const SKIP_PENALTY = 15;
/** Best round time per tier, in seconds: {Basic: 31.4, …}. */
export const SPOT_BEST_KEY = "sudoku_v1_spot_best";
/** Puzzle rush: positions keep coming until this many misses (a wrong tap or a skip). */
export const RUSH_LIVES = 3;
/** Longest rush per tier, in positions found: {Basic: 12, …}. */
export const RUSH_BEST_KEY = "sudoku_v1_spot_rush";

interface Slot {
  technique: TechniqueId;
  /** Seeds the position, so a round (and a test) can be replayed exactly. */
  seed: number;
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * A round's positions: the tier's techniques in shuffled passes, so each comes up as evenly as
 * ten allows, and never the same one twice running when the tier has more than one. A rush
 * chains rounds, passing the last technique as `after` so the seam doesn't repeat one either.
 */
export function buildRound(tier: Tier, rng: Rng, after?: TechniqueId): Slot[] {
  const ids = ACADEMY_TECHNIQUES.filter((t) => t.tier === tier).map((t) => t.id);
  const order: TechniqueId[] = [];
  while (order.length < ROUND_SIZE) {
    const pass = shuffle(ids, rng);
    if (pass.length > 1 && pass[0] === (order.at(-1) ?? after))
      [pass[0], pass[1]] = [pass[1]!, pass[0]!];
    order.push(...pass);
  }
  return order
    .slice(0, ROUND_SIZE)
    .map((technique) => ({ technique, seed: Math.floor(rng() * 2 ** 31) }));
}

export interface SpotResult {
  technique: TechniqueId;
  /** Time on the position, penalties included. */
  seconds: number;
  misses: number;
  skipped: boolean;
  /** A rush's last life went on a wrong tap here: shown, but neither found nor skipped. */
  out?: boolean;
}

export const totalTime = (results: SpotResult[]) => results.reduce((s, r) => s + r.seconds, 0);
/** A rush's score: the positions found, not skipped. */
export const foundCount = (results: SpotResult[]) =>
  results.filter((r) => !r.skipped && !r.out).length;
/** A rush's lives spent: every wrong tap and every skip. */
export const missCount = (results: SpotResult[]) =>
  results.reduce((n, r) => n + r.misses + (r.skipped ? 1 : 0), 0);

interface TechniqueRow {
  technique: TechniqueId;
  /** Average seconds per position, penalties included. */
  average: number;
  misses: number;
  skips: number;
  /** Worth a lesson: skipped, missed, or slower than the round's average. */
  weak: boolean;
}

/** Per technique, slowest first. */
export function breakdown(results: SpotResult[]): TechniqueRow[] {
  const mean = results.length ? totalTime(results) / results.length : 0;
  const rows = new Map<TechniqueId, SpotResult[]>();
  for (const r of results) rows.set(r.technique, [...(rows.get(r.technique) ?? []), r]);
  return [...rows]
    .map(([technique, rs]) => {
      const average = totalTime(rs) / rs.length;
      const misses = rs.reduce((n, r) => n + r.misses, 0);
      const skips = rs.filter((r) => r.skipped).length;
      return { technique, average, misses, skips, weak: !!(misses || skips) || average > mean };
    })
    .toSorted((a, b) => b.average - a.average);
}

const isTime = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Stored bests, keeping only known tiers and positive times (the value comes from storage or
 * sync). Rush bests are positive counts, so they read the same way.
 */
export function readSpotBest(raw: unknown): Partial<Record<Tier, number>> {
  const out: Partial<Record<Tier, number>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const tier of SPOT_TIERS) {
    const v = (raw as Record<string, unknown>)[tier];
    if (isTime(v)) out[tier] = v;
  }
  return out;
}

/**
 * Each tier's faster best (`pick` Math.max for a rush's longest), so a sync in either direction
 * never loses one. Entries this version doesn't know pass through as long as they're positive
 * numbers, so an older client never strips them.
 */
export function mergeSpotBest(
  a: unknown,
  b: unknown,
  pick: (x: number, y: number) => number = Math.min,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const raw of [a, b]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    for (const [k, v] of Object.entries(raw)) if (isTime(v)) out[k] = pick(out[k] ?? v, v);
  }
  return out;
}

/** "1:05.3" or "42.0 s": tenths, as rounds are short. */
export function formatSpotTime(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const m = Math.floor(tenths / 600);
  const s = ((tenths % 600) / 10).toFixed(1);
  return m ? `${m}:${s.padStart(4, "0")}` : `${s} s`;
}
