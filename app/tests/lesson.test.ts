import { describe, expect, it } from "vitest";

import type { Lesson } from "../utils/lesson";
import type { BoardUnit, CellRC } from "../utils/sudokuGrader";

import {
  instancesOf,
  lessonFromExample,
  lessonFromPuzzle,
  lessonUnits,
  missReason,
  shuffleLesson,
} from "../utils/lesson";
import { generatePracticePuzzle } from "../utils/practice";
import { ACADEMY_TECHNIQUES } from "../utils/progression";
import { makeRng, solveBoard } from "../utils/sudokuCore";

const ALL: CellRC[] = Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 }));
const covers = (u: BoardUnit, p: CellRC) =>
  u.kind === "row"
    ? u.r === p.r
    : u.kind === "col"
      ? u.c === p.c
      : Math.floor(u.r / 3) === Math.floor(p.r / 3) && Math.floor(u.c / 3) === Math.floor(p.c / 3);

// What a lesson asks of the player must be true of the real answer, and possible on its board.
function expectSound(lesson: Lesson) {
  const solved = solveBoard(lesson.board)!;
  expect(solved).not.toBeNull();
  expect(lesson.pattern.length).toBeGreaterThan(0);
  for (const p of lesson.pattern) expect(lesson.board[p.r]![p.c]).toBe(0);
  if (lesson.placement) {
    const { r, c, num } = lesson.placement;
    expect(solved[r]![c]).toBe(num);
    expect(lesson.notes[r]![c]).toContain(num);
  } else {
    expect(lesson.eliminations.length).toBeGreaterThan(0);
    for (const { r, c, num } of lesson.eliminations) {
      expect(solved[r]![c]).not.toBe(num);
      expect(lesson.notes[r]![c]).toContain(num); // there to be crossed out
    }
  }
  // Every pencil mark left standing still allows the answer.
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (!lesson.board[r]![c]) expect(lesson.notes[r]![c]).toContain(solved[r]![c]);
}

describe("lessons", () => {
  it.each(ACADEMY_TECHNIQUES.map((t) => t.id))("the %s example makes a sound lesson", (id) => {
    const lesson = lessonFromExample(id)!;
    expect(lesson.technique).toBe(id);
    expectSound(lesson);
  });

  it.each(["naked-single", "hidden-single", "pointing", "naked-pair", "x-wing"] as const)(
    "a %s puzzle's lesson names one unit where it can",
    async (id) => {
      const p = await generatePracticePuzzle(id, makeRng(11));
      expect(p.kind).toBe("puzzle");
      const lesson = lessonFromPuzzle(p.board, id)!;
      expect(lesson.technique).toBe(id);
      expectSound(lesson);
      if (id === "x-wing") expect(lesson.unit).toBeNull();
      else expect(lesson.unit).not.toBeNull();
    },
  );

  it.each(ACADEMY_TECHNIQUES.map((t) => t.id))(
    "a shuffled %s example is still a sound lesson",
    (id) => {
      for (const seed of [1, 2, 3]) {
        const lesson = shuffleLesson(lessonFromExample(id)!, makeRng(seed));
        expect(lesson.technique).toBe(id);
        expectSound(lesson);
        for (const p of lesson.pattern) {
          // A pattern cell never gets a "why not" reason, and the units cover it.
          expect(missReason(lesson, p).key).toBe("lesson.miss");
          expect(lessonUnits(lesson).some((u) => covers(u, p))).toBe(true);
        }
      }
    },
  );

  it.each(["hidden-single", "pointing", "box-line", "naked-pair", "x-wing"] as const)(
    "never explains a real %s pattern cell away in a real puzzle",
    async (id) => {
      const lesson = lessonFromPuzzle((await generatePracticePuzzle(id, makeRng(5))).board, id)!;
      for (const p of lesson.pattern) expect(missReason(lesson, p).key).toBe("lesson.miss");
    },
  );

  it("gives a filled cell, a cell without the digit and one outside the unit their reasons", () => {
    const pointing = lessonFromExample("pointing")!;
    const filled = ALL.find(({ r, c }) => pointing.board[r]![c])!;
    expect(missReason(pointing, filled).key).toBe("lesson.why.filled");
    const d = pointing.digits[0]!;
    const noDigit = ALL.find(
      ({ r, c }) => !pointing.board[r]![c] && !pointing.notes[r]![c]!.includes(d),
    )!;
    expect(missReason(pointing, noDigit)).toEqual({ key: "lesson.why.noDigit", params: { d } });
    const outside = ALL.find(
      ({ r, c }) => pointing.notes[r]![c]!.includes(d) && !covers(pointing.unit!, { r, c }),
    )!;
    expect(missReason(pointing, outside).key).toBe("lesson.why.outside");
  });

  it("accepts every same-size fish on the digit, each one sound", () => {
    for (const id of ["x-wing", "swordfish", "jellyfish"] as const) {
      const lesson = shuffleLesson(lessonFromExample(id)!, makeRng(9));
      const solved = solveBoard(lesson.board)!;
      const found = instancesOf(lesson);
      expect(found[0]!.pattern).toEqual(lesson.pattern);
      for (const inst of found) {
        expect(inst.pattern).toHaveLength(lesson.pattern.length);
        expect(inst.eliminations.length).toBeGreaterThan(0);
        for (const { r, c, num } of inst.eliminations) expect(solved[r]![c]).not.toBe(num);
      }
    }
    expect(instancesOf(lessonFromExample("pointing")!)).toHaveLength(1);
  });

  it("a single's pattern is the cell it fills, and a pointing pair's unit is its box", async () => {
    const single = lessonFromPuzzle(
      (await generatePracticePuzzle("naked-single", makeRng(3))).board,
      "naked-single",
    )!;
    expect(single.pattern).toEqual([{ r: single.placement!.r, c: single.placement!.c }]);
    expect(single.notes[single.placement!.r]![single.placement!.c]).toEqual([
      single.placement!.num,
    ]);
    const pointing = lessonFromExample("pointing")!;
    expect(pointing.unit?.kind).toBe("box");
  });
});
