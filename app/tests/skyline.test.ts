import { describe, it, expect } from "vitest";

import type { Placement } from "../utils/stuckMoments";

import { skylineOf } from "../utils/skyline";

const empty = () => Array.from({ length: 9 }, () => Array<number>(9).fill(0));

describe("skylineOf", () => {
  const puzzle = empty();
  puzzle[0]![0] = 7;
  const log: Placement[] = [
    { r: 1, c: 1, num: 5, t: 10 },
    { r: 0, c: 1, num: 2, t: 4, restored: true },
    { r: 2, c: 2, num: 9, t: 20 },
  ];
  const at = (r: number, c: number) => skylineOf(puzzle, log).find((x) => x.r === r && x.c === c)!;

  it("has a column for every cell, as tall as its digit", () => {
    expect(skylineOf(puzzle, log)).toHaveLength(81);
    expect(at(1, 1).height).toBe(5);
    expect(at(8, 8).height).toBe(0);
  });

  it("orders givens 0, then restored digits, then the moves", () => {
    expect(at(0, 0)).toEqual({ r: 0, c: 0, height: 7, order: 0, given: true });
    expect([at(0, 1).order, at(1, 1).order, at(2, 2).order]).toEqual([1, 2, 3]);
    expect(at(2, 2).given).toBe(false);
  });

  it("counts a cell's last placement", () => {
    const again = [...log, { r: 1, c: 1, num: 5, t: 30 }];
    expect(skylineOf(puzzle, again).find((x) => x.r === 1 && x.c === 1)!.order).toBe(4);
  });
});
