// "Your solve in 3D": the finished board as a city, each cell a column as tall as its digit,
// coloured by when it went in. Pure, unit-tested in tests/skyline.test.ts; SolveSkyline.vue draws it.
import type { Grid } from "../types/sudoku";
import type { Placement } from "./stuckMoments";

import { boardAt, replayOf } from "./replay";

export interface SkylineColumn {
  r: number;
  c: number;
  /** The digit. */
  height: number;
  /** 0 for a given, else 1..n in the order the cell was filled (its last placement counts). */
  order: number;
  given: boolean;
}

/** The 81 columns, row by row. Restored digits came first, at an unknown time, so they go in early. */
export function skylineOf(puzzle: Grid, placements: Placement[]): SkylineColumn[] {
  const { start, moves } = replayOf(puzzle, placements, []);
  const board = boardAt(start, moves, moves.length);
  const sequence = [...placements.filter((p) => p.restored), ...moves];
  const order = new Map<number, number>();
  sequence.forEach((p, i) => order.set(p.r * 9 + p.c, i + 1));
  return board.flatMap((row, r) =>
    row.map((height, c) => {
      const given = !!puzzle[r]?.[c];
      return { r, c, height, order: given ? 0 : (order.get(r * 9 + c) ?? 0), given };
    }),
  );
}
