// "Watch your solve": a won game's placement log replayed over its givens, move by move.
// Pure, unit-tested in tests/replay.test.ts.
import type { Grid } from "../types/sudoku";
import type { Placement, StuckMoment } from "./stuckMoments";

/**
 * The board the replay starts from (digits restored from an older save were already on it, at an
 * unknown time), the moves after it, and the step each stuck moment ends at: the board the player
 * was staring at, just before the move that broke the wait.
 */
export function replayOf(puzzle: Grid, log: Placement[], stuck: StuckMoment[]) {
  const start = puzzle.map((row) => [...row]);
  for (const p of log) if (p.restored) start[p.r]![p.c] = p.num;
  const moves = log.filter((p) => !p.restored);
  const marks = stuck
    .map((m) => ({ ...m, step: moves.findIndex((p) => p.t === m.at + m.gap) }))
    .filter((m) => m.step >= 0);
  return { start, moves, marks };
}

/** The board after the first `step` moves. */
export function boardAt(start: Grid, moves: Placement[], step: number): Grid {
  const board = start.map((row) => [...row]);
  for (const p of moves.slice(0, step)) board[p.r]![p.c] = p.num;
  return board;
}
