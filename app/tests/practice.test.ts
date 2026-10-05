import { describe, it, expect } from "vitest";

import { ACADEMY_EXAMPLES } from "../utils/academyExamples";
import { generatePracticePuzzle } from "../utils/practice";
import { makeRng, solveBoard } from "../utils/sudokuCore";
import { techniquesRequired, type TechniqueId } from "../utils/sudokuGrader";

const ALL: TechniqueId[] = [
  "naked-single",
  "hidden-single",
  "pointing",
  "box-line",
  "naked-pair",
  "hidden-pair",
  "naked-triple",
  "hidden-triple",
  "naked-quad",
  "hidden-quad",
  "x-wing",
  "swordfish",
  "jellyfish",
  "xy-wing",
  "xyz-wing",
];

describe("practice puzzles", () => {
  it("finds a real puzzle that requires the technique", async () => {
    const p = await generatePracticePuzzle("pointing", makeRng(7));
    expect(p.kind).toBe("puzzle");
    expect(techniquesRequired(p.board)?.has("pointing")).toBe(true);
    expect(solveBoard(p.board)).not.toBeNull();
  });

  it("falls back to the Academy drill when the search finds nothing", async () => {
    const p = await generatePracticePuzzle("swordfish", makeRng(1), { maxAttempts: 0 });
    expect(p.kind).toBe("drill");
    expect(p.board).toBe(ACADEMY_EXAMPLES.swordfish!.board);
    expect(p.notes).toBeDefined();
  });

  it("every technique has a solvable drill with pencil marks to work from", () => {
    for (const id of ALL) {
      const ex = ACADEMY_EXAMPLES[id];
      // Tuples keep the technique id in the failure message.
      expect([id, ex !== undefined]).toEqual([id, true]);
      expect([id, solveBoard(ex!.board) !== null]).toEqual([id, true]);
      expect([id, Object.keys(ex!.notes).length > 0]).toEqual([id, true]);
    }
  });
});
