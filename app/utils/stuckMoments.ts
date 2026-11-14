// "Where you got stuck": the long waits between placements, and what would have broken each one.
// Pure, unit-tested in tests/stuckMoments.test.ts.
import type { Grid } from "../types/sudoku";

import { nextHint, type DigitAt, type SolveMove, type TechniqueId } from "./sudokuGrader";

/** A correct digit going in (by the player, a hint or Finish), stamped with the game clock (s). */
export interface Placement extends DigitAt {
  t: number;
  /** Already on the board when the log began (an older save): when it went in is unknown. */
  restored?: true;
}

export interface StuckMoment {
  /** Game clock (s) when the wait began. */
  at: number;
  /** How long it lasted (s). */
  gap: number;
  /** What the solver needed from that position; null if logic alone couldn't go on. */
  technique: TechniqueId | null;
}

/** A wait shorter than this is just playing. */
export const STUCK_MIN_GAP = 40;

/**
 * The longest waits before a placement (at least `minGap` s), at most `max`, in game order. Each
 * replays the log onto the givens to rebuild the board the player was staring at.
 */
export function stuckMoments(
  puzzle: Grid,
  log: Placement[],
  minGap = STUCK_MIN_GAP,
  max = 3,
): StuckMoment[] {
  return log
    .map((p, i) => ({ i, at: i ? log[i - 1]!.t : 0, gap: p.t - (i ? log[i - 1]!.t : 0) }))
    .filter((w) => w.gap >= minGap && !log[w.i]!.restored)
    .toSorted((a, b) => b.gap - a.gap)
    .slice(0, max)
    .toSorted((a, b) => a.i - b.i)
    .map(({ i, at, gap }) => {
      const board = puzzle.map((row) => [...row]);
      for (const p of log.slice(0, i)) board[p.r]![p.c] = p.num;
      return { at, gap, technique: techniqueAt(board) };
    });
}

/** The entries whose digit is still on the board: an undone or erased placement drops out. */
export function onBoard(log: Placement[], board: Grid): Placement[] {
  return log.filter((p) => board[p.r]?.[p.c] === p.num);
}

const isCell = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 8;
function isPlacement(x: unknown): x is Placement {
  const p = x as Partial<Placement> | null;
  return (
    typeof p === "object" &&
    p !== null &&
    isCell(p.r) &&
    isCell(p.c) &&
    Number.isInteger(p.num) &&
    p.num! >= 1 &&
    p.num! <= 9 &&
    Number.isFinite(p.t) &&
    (p.restored === undefined || p.restored === true)
  );
}

/**
 * The log a saved game resumes with: its own when well-formed, else (a save from before the log,
 * or one damaged in an import) every correct digit already played, marked `restored` at the
 * save's clock so the time before them is never read as a wait.
 */
export function restorePlacements(save: {
  placements?: unknown;
  initialBoard: Grid;
  currentBoard: Grid;
  solvedBoard: Grid;
  timerSeconds: number;
}): Placement[] {
  const { placements, initialBoard, currentBoard, solvedBoard, timerSeconds } = save;
  if (Array.isArray(placements) && placements.every(isPlacement))
    return onBoard(placements, currentBoard);
  const t = Number.isFinite(timerSeconds) ? timerSeconds : 0;
  const log: Placement[] = [];
  currentBoard.forEach((row, r) =>
    row.forEach((num, c) => {
      if (num && !initialBoard[r]![c] && num === solvedBoard[r]![c])
        log.push({ r, c, num, t, restored: true });
    }),
  );
  return log;
}

// The hardest step on the solver's way to its next placement: past an elimination the easiest
// next move may be a single, but the elimination was the wall.
function techniqueAt(board: Grid): TechniqueId | null {
  const elims: DigitAt[] = [];
  let hardest: SolveMove | null = null;
  for (let step = 0; step < 100; step++) {
    const move = nextHint(board, elims);
    if (!move) return null;
    if (!hardest || move.tier > hardest.tier) hardest = move;
    if (move.placement) return hardest.technique;
    elims.push(...move.eliminations);
  }
  return null;
}
