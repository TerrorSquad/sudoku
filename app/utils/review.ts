// Daily review: a Leitner schedule over the techniques whose lessons the player finished. Pure;
// unit-tested in tests/review.test.ts. Dates are local calendar keys (YYYY-MM-DD, like the Daily).
//
// A finished lesson puts its technique in box 1, due the next day. A review that finds the pattern
// with at most one wrong tap moves it up a box, a worse one (or a skip) back to box 1; each box
// waits INTERVALS[box - 1] days.

import type { TechniqueId } from "./sudokuGrader";

import { ACADEMY_TECHNIQUES } from "./progression";

export const REVIEW_KEY = "sudoku_v1_review";
/** Days until the next review, by box (1–5). */
export const INTERVALS = [1, 3, 7, 14, 30] as const;
/** Techniques per review session. */
export const SESSION_SIZE = 5;

export interface Card {
  box: number;
  /** The day it's due, YYYY-MM-DD. */
  next: string;
}
export type Schedule = Partial<Record<TechniqueId, Card>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN = new Set<string>(ACADEMY_TECHNIQUES.map((t) => t.id));

const isCard = (v: unknown): v is Card =>
  !!v &&
  typeof v === "object" &&
  Number.isInteger((v as Card).box) &&
  (v as Card).box >= 1 &&
  typeof (v as Card).next === "string" &&
  DATE.test((v as Card).next);

/** `days` after a date key, as a date key (UTC arithmetic on the date, so DST can't shift it). */
export function addDays(key: string, days: number): string {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8) + days));
  return d.toISOString().slice(0, 10);
}

/** The stored schedule, keeping only known techniques and well-formed cards. */
export function readReview(raw: unknown): Schedule {
  const out: Schedule = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, card] of Object.entries(raw))
    if (KNOWN.has(id) && isCard(card))
      out[id as TechniqueId] = { box: Math.min(card.box, INTERVALS.length), next: card.next };
  return out;
}

/**
 * The schedule with `learned` techniques that have no card yet put in box 1, due `due`. Lessons
 * finished before review existed come in this way (due today), without anything being stored.
 */
export function withLearned(schedule: Schedule, learned: readonly string[], due: string): Schedule {
  const out = { ...schedule };
  for (const id of learned)
    if (KNOWN.has(id) && !out[id as TechniqueId]) out[id as TechniqueId] = { box: 1, next: due };
  return out;
}

/** Due techniques, the longest overdue (then the lowest box) first, at most SESSION_SIZE. */
export function dueToday(schedule: Schedule, today: string): TechniqueId[] {
  return (Object.entries(schedule) as [TechniqueId, Card][])
    .filter(([, c]) => c.next <= today)
    .toSorted(([, a], [, b]) => a.next.localeCompare(b.next) || a.box - b.box)
    .map(([id]) => id);
}

/** The next day anything is due after today; null with nothing scheduled. */
export function nextReviewDay(schedule: Schedule, today: string): string | null {
  const later = Object.values(schedule)
    .map((c) => c!.next)
    .filter((d) => d > today)
    .toSorted();
  return later[0] ?? null;
}

/** How a due date reads: `tomorrow` for the day after `today`, else a short date in `lang`. */
export function dayLabel(key: string, today: string, lang: string, tomorrow: string): string {
  if (key === addDays(today, 1)) return tomorrow;
  return new Date(`${key}T12:00:00`).toLocaleDateString(lang, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** A review's outcome: found with at most one wrong tap and no skip. */
export const reviewPassed = (misses: number, skipped: boolean) => !skipped && misses <= 1;

/** The card after a review on `today`. */
export function reviewCard(card: Card | undefined, passed: boolean, today: string): Card {
  const box = passed ? Math.min((card?.box ?? 1) + 1, INTERVALS.length) : 1;
  return { box, next: addDays(today, INTERVALS[box - 1]!) };
}

/** A finished lesson's card: box 1, due tomorrow, unless the technique is already scheduled. */
export const lessonCard = (card: Card | undefined, today: string): Card =>
  card ?? { box: 1, next: addDays(today, INTERVALS[0]) };

/** The day a card was last set: its due date less its box's interval. */
const setOn = (c: Card) => addDays(c.next, -INTERVALS[Math.min(c.box, INTERVALS.length) - 1]!);

/**
 * Two schedules as one: per technique the card set last (the later review day, so a miss after a
 * pass wins even though it's due sooner; on the same day the lower box, so a miss is never undone).
 * Cards this version doesn't know pass through as long as they're well formed, so an older client
 * never strips them.
 */
export function mergeReview(a: unknown, b: unknown): Record<string, Card> {
  const out: Record<string, Card> = {};
  for (const raw of [a, b]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    for (const [id, card] of Object.entries(raw)) {
      if (!isCard(card)) continue;
      const have = out[id];
      const [mine, theirs] = have ? [setOn(card), setOn(have)] : ["", ""];
      if (!have || mine > theirs || (mine === theirs && card.box < have.box))
        out[id] = { box: card.box, next: card.next };
    }
  }
  return out;
}
