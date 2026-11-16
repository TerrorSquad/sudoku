// "Challenge a friend": a won puzzle's givens and time as one short code that the friend pastes
// into Your puzzle. Pure; unit-tested in tests/challenge.test.ts.
//
// SP1-<81 digits>-<seconds>: givens row by row (0 = empty), then the time to beat (0 = untimed,
// a Zen win). It travels inside the share text, so parsing finds it anywhere in what was pasted.

import type { Grid } from "../types/sudoku";

export interface Challenge {
  board: Grid;
  /** The friend's time in seconds; 0 when they played without a clock. */
  seconds: number;
}

const CODE = /SP1-([0-9]{81})-([0-9]{1,6})/;

export function encodeChallenge(board: Grid, seconds: number): string {
  return `SP1-${board.flat().join("")}-${Math.max(0, Math.round(seconds))}`;
}

export function parseChallenge(text: string): Challenge | null {
  const m = CODE.exec(text.replace(/\s/g, ""));
  if (!m) return null;
  const digits = m[1]!.split("").map(Number);
  return {
    board: Array.from({ length: 9 }, (_, r) => digits.slice(r * 9, r * 9 + 9)) as Grid,
    seconds: Number(m[2]),
  };
}
