import { describe, it, expect } from "vitest";

import type { Placement } from "../utils/stuckMoments";

import { boardAt, replayOf } from "../utils/replay";

const empty = () => Array.from({ length: 9 }, () => Array<number>(9).fill(0));

describe("replayOf", () => {
  const log: Placement[] = [
    { r: 0, c: 0, num: 1, t: 30, restored: true },
    { r: 0, c: 1, num: 2, t: 35 },
    { r: 0, c: 2, num: 3, t: 125 }, // a 90 s wait from 0:35
    { r: 0, c: 3, num: 4, t: 125 },
  ];

  it("starts from the givens plus the restored digits, replaying only the rest", () => {
    const { start, moves } = replayOf(empty(), log, []);
    expect(start[0]!.slice(0, 4)).toEqual([1, 0, 0, 0]);
    expect(moves.map((p) => p.num)).toEqual([2, 3, 4]);
  });

  it("marks a stuck moment on the step before the move that ended it", () => {
    const { marks } = replayOf(empty(), log, [{ at: 35, gap: 90, technique: "naked-single" }]);
    expect(marks).toEqual([{ at: 35, gap: 90, technique: "naked-single", step: 1 }]);
    // A moment the moves can't place (a damaged log) is dropped, not drawn at the start.
    expect(replayOf(empty(), log, [{ at: 1, gap: 50, technique: null }]).marks).toEqual([]);
  });
});

describe("boardAt", () => {
  it("puts the first n moves on a copy of the start", () => {
    const { start, moves } = replayOf(
      empty(),
      [
        { r: 1, c: 1, num: 5, t: 1 },
        { r: 2, c: 2, num: 6, t: 2 },
      ],
      [],
    );
    expect(boardAt(start, moves, 0)).toEqual(empty());
    const one = boardAt(start, moves, 1);
    expect([one[1]![1], one[2]![2]]).toEqual([5, 0]);
    expect(boardAt(start, moves, 2)[2]![2]).toBe(6);
    expect(start).toEqual(empty());
  });
});
