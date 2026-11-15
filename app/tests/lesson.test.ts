import { describe, expect, it } from "vitest";

import type { Lesson } from "../utils/lesson";

import { lessonFromExample, lessonFromPuzzle } from "../utils/lesson";
import { generatePracticePuzzle } from "../utils/practice";
import { ACADEMY_TECHNIQUES } from "../utils/progression";
import { makeRng, solveBoard } from "../utils/sudokuCore";

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
