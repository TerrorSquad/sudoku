import { describe, it, expect, beforeEach, vi } from "vitest";

// Engine poziva useI18n() van komponente — mockujemo prevod za testove
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import type { Grid } from "../types/sudoku";

import { useSudokuEngine } from "../composables/useSudokuEngine";
import { circled } from "../utils/patternMarks";
import { makeRng, solveBoard } from "../utils/sudokuCore";
import { generateGradedPuzzle, movesNow, nextHint } from "../utils/sudokuGrader";

describe("Sudoku Engine Unit Tests - Sveobuhvatne Tehnike Rešavanja", () => {
  let engine: ReturnType<typeof useSudokuEngine>;

  beforeEach(() => {
    engine = useSudokuEngine();
  });

  it("Treba uspešno da prepozna i reši Naked Single", () => {
    // Postavi tablu gde ćelija (0,0) ima samo jednog preostalog kandidata (npr. 5)
    engine.currentBoard.value = [
      [0, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    engine.solvedBoard.value = engine.currentBoard.value.map((row) => [...row]);
    engine.solvedBoard.value[0]![0] = 5;

    const candidates = engine.getGridCandidates(engine.currentBoard.value);
    expect(candidates[0]![0]).toEqual([5]); // Dokazujemo da je 5 jedini preostali kandidat
  });

  it("Treba bezbedno da detektuje konfliktne ćelije u realnom vremenu unutar reda i kolone", () => {
    engine.currentBoard.value[0]![0] = 5;
    engine.currentBoard.value[0]![1] = 5; // Dupli broj u istom redu

    const conflicts = engine.getConflictCells(0, 0, 5);
    expect(conflicts).toContainEqual({ r: 0, c: 1 });
  });

  it("Mehanizam za istoriju (Undo) mora ispravno da vrati prethodno stanje table i obriše animacije", () => {
    engine.currentBoard.value[0]![0] = 0;
    engine.saveHistory();
    engine.currentBoard.value[0]![0] = 9;

    engine.undoMove();
    expect(engine.currentBoard.value[0]![0]).toBe(0);
  });

  it("Treba uspešno da validira pobednički uslov (Win Condition) kada se poklope sve ćelije", () => {
    // Simuliramo kompletno rešenu tablu
    const testSolved = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    engine.currentBoard.value = testSolved.map((row) => row.concat());
    engine.solvedBoard.value = testSolved.map((row) => row.concat());

    const won = engine.checkWinCondition();
    expect(won).toBe(true);
  });

  it("Treba ispravno da detektuje promenu broja preostalih numpad eksponenata pri unosu", () => {
    // Inicijalna tabla bez petica
    engine.currentBoard.value = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    engine.solvedBoard.value = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];

    // Upisujemo tačnu peticu na (0,0)
    engine.currentBoard.value[0]![0] = 5;

    // Proveravamo da li se broj unesenih petica ispravno inkrementirao na 1
    const counts = engine.numberCounts.value;
    expect(counts[5]).toBe(1);
  });

  describe("undo / redo", () => {
    const edit = (value: number) => {
      engine.saveHistory();
      engine.currentBoard.value[0]![0] = value;
    };

    it("redo restores what undo removed, and undo can step back again", () => {
      edit(5);
      edit(7);
      engine.undoMove();
      expect(engine.currentBoard.value[0]![0]).toBe(5);
      engine.redoMove();
      expect(engine.currentBoard.value[0]![0]).toBe(7);
      engine.undoMove();
      engine.undoMove();
      expect(engine.currentBoard.value[0]![0]).toBe(0);
      expect(engine.redoHistory.value).toHaveLength(2);
    });

    it("a fresh edit after undo drops the redo stack", () => {
      edit(5);
      engine.undoMove();
      expect(engine.redoHistory.value).toHaveLength(1);
      edit(9);
      expect(engine.redoHistory.value).toHaveLength(0);
      engine.redoMove();
      expect(engine.currentBoard.value[0]![0]).toBe(9);
    });

    it("undo/redo with nothing to do are no-ops", () => {
      engine.undoMove();
      engine.redoMove();
      expect(engine.currentBoard.value[0]![0]).toBe(0);
    });

    describe("jumpTo (the move history scrubber)", () => {
      const cell = () => engine.currentBoard.value[0]![0];
      beforeEach(() => [5, 7, 9].forEach(edit));

      it("jumps back, then forward again like redo", () => {
        engine.jumpTo(1);
        expect(cell()).toBe(5);
        expect(engine.redoHistory.value).toHaveLength(2);
        engine.jumpTo(2);
        expect(cell()).toBe(7);
        engine.redoMove();
        expect(cell()).toBe(9);
      });

      it("jumpTo(0) goes back to the oldest kept state", () => {
        engine.jumpTo(0);
        expect(cell()).toBe(0);
        expect(engine.boardHistory.value).toHaveLength(0);
        expect(engine.redoHistory.value).toHaveLength(3);
      });

      it("a fresh edit after a jump drops what was jumped over", () => {
        engine.jumpTo(1);
        edit(4);
        expect(engine.redoHistory.value).toHaveLength(0);
        expect(engine.boardHistory.value).toHaveLength(2);
      });

      it("past the end stops at the last state", () => {
        engine.jumpTo(0);
        engine.jumpTo(99);
        expect(cell()).toBe(9);
        expect(engine.boardHistory.value).toHaveLength(3);
        expect(engine.redoHistory.value).toHaveLength(0);
      });
    });
  });

  describe("hints respect the player's notes", () => {
    // Its first hint is a pointing pair removing 2 from r5c2 and r5c4.
    const board = [
      [9, 3, 6, 8, 5, 0, 0, 1, 0],
      [0, 7, 2, 6, 3, 0, 5, 9, 8],
      [5, 0, 0, 0, 0, 0, 0, 3, 6],
      [0, 0, 0, 0, 0, 3, 6, 8, 9],
      [8, 0, 3, 0, 6, 9, 0, 4, 0],
      [6, 0, 0, 0, 8, 0, 1, 5, 3],
      [7, 0, 0, 0, 4, 6, 3, 2, 5],
      [3, 6, 0, 0, 0, 5, 8, 7, 4],
      [2, 4, 5, 3, 7, 8, 9, 6, 1],
    ] as Grid;
    const note = (r: number, c: number, nums: number[]) => {
      engine.notesBoard.value[r]![c] = Array.from({ length: 10 }, (_, n) => nums.includes(n));
    };

    beforeEach(() => {
      engine.currentBoard.value = board.map((row) => [...row]);
      engine.solvedBoard.value = solveBoard(board)!;
    });

    it("suggests a removal the notes still show", () => {
      engine.triggerComplexHint();
      expect(engine.activeMove.value?.eliminations).toContainEqual({ r: 4, c: 1, num: 2 });
    });

    it("a removal-only hint has no target cell and doesn't paint a selection over the pattern", () => {
      engine.selectedCell.value = { r: 4, c: 6 };
      engine.triggerComplexHint();
      expect(engine.activeComplexHint.value?.targetCell).toBeNull();
      expect(engine.activeHintCell.value).toBeNull();
      expect(engine.selectedCell.value).toBeNull();
    });

    it("skips a removal the player already made", () => {
      note(4, 1, [1, 5]);
      note(4, 3, [1, 5]);
      engine.triggerComplexHint();
      const elims = engine.activeMove.value?.eliminations ?? [];
      expect(elims).not.toContainEqual({ r: 4, c: 1, num: 2 });
      expect(elims).not.toContainEqual({ r: 4, c: 3, num: 2 });
    });

    it("never reads a gap in the notes as a deduction (that would leak the answer)", () => {
      // Notes holding only each cell's answer: reading their gaps would hand out naked singles.
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          if (board[r]![c] === 0) note(r, c, [engine.solvedBoard.value[r]![c]!]);
      // What logic alone reaches: every removal it finds is already in the notes, so it's skipped.
      const elims: { r: number; c: number; num: number }[] = [];
      let expected = nextHint(board, elims);
      while (expected && !expected.placement) {
        elims.push(...expected.eliminations);
        expected = nextHint(board, elims);
      }
      engine.triggerComplexHint();
      expect(engine.activeMove.value?.technique).toBe(expected?.technique);
      expect(engine.activeMove.value?.placement).toEqual(expected?.placement);
    });

    it("never trusts a note that crossed out the answer", () => {
      const { r, c } = { r: 4, c: 1 };
      const answer = engine.solvedBoard.value[r]![c]!;
      note(
        r,
        c,
        [1, 2, 5].filter((n) => n !== answer),
      );
      engine.triggerComplexHint();
      const move = engine.activeMove.value!;
      if (move.placement)
        expect(move.placement.num).toBe(
          engine.solvedBoard.value[move.placement.r]![move.placement.c],
        );
      for (const e of move.eliminations)
        expect(e.num).not.toBe(engine.solvedBoard.value[e.r]![e.c]);
    });

    it("points at a wrong entry before any technique, and applying it clears the cell", () => {
      engine.initialBoard.value = board.map((row) => [...row]);
      const answer = engine.solvedBoard.value[4]![1]!;
      const wrong = [1, 2, 5].find((n) => n !== answer)!; // a candidate, so no visible clash
      engine.currentBoard.value[4]![1] = wrong;
      expect(engine.peekHint()).toEqual({ at: { r: 4, c: 1 }, move: null });

      engine.triggerComplexHint();
      const hint = engine.activeComplexHint.value!;
      expect(hint.wrongEntry).toBe(true);
      expect(hint.title).toBe("hint.wrong.name");
      expect(hint.targetCell).toEqual({ r: 4, c: 1 });
      expect(engine.activeMove.value).toBeNull();

      engine.nextHintStep(() => {});
      engine.nextHintStep(() => {});
      expect(engine.currentBoard.value[4]![1]).toBe(0);
      expect(engine.activeComplexHint.value).toBeNull();

      engine.triggerComplexHint();
      expect(engine.activeComplexHint.value?.wrongEntry).toBeUndefined();
      expect(engine.activeMove.value?.eliminations).toContainEqual({ r: 4, c: 1, num: 2 });

      engine.undoMove(); // the clear is one undoable step
      expect(engine.currentBoard.value[4]![1]).toBe(wrong);
    });
  });
  it("autoFillNotes gives every empty cell exactly its candidates, keeps filled cells, and undoes", () => {
    const solved = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    const puzzle = solved.map((row) => [...row]);
    puzzle[0]![0] = 0;
    puzzle[0]![1] = 0;
    puzzle[1]![0] = 0;
    engine.loadCustomBoard(puzzle);
    engine.notesBoard.value[0]![0]![9] = true; // a stale note the fill must drop
    engine.notesBoard.value[4]![4]![2] = true; // a filled cell's notes stay as they are

    engine.autoFillNotes();
    const marks = (r: number, c: number) =>
      engine.notesBoard.value[r]![c]!.flatMap((on, n) => (on ? [n] : []));
    expect(marks(0, 0)).toEqual([5]);
    expect(marks(0, 1)).toEqual([3]);
    expect(marks(1, 0)).toEqual([6]);
    expect(marks(4, 4)).toEqual([2]);

    engine.undoMove();
    expect(marks(0, 0)).toEqual([9]);
    expect(marks(0, 1)).toEqual([]);
  });

  it("completedAt lists the units and the digit a correct placement finishes", () => {
    const solved = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    engine.solvedBoard.value = solved.map((row) => [...row]);
    engine.currentBoard.value = solved.map((row) => [...row]);
    engine.currentBoard.value[8]![8] = 0; // the 9 at (8, 8) is still missing
    engine.currentBoard.value[8]![3] = 0; // so is (8, 3): row 8 and digit 2 stay open

    expect(engine.completedAt(0, 0)).toEqual({
      units: 3,
      done: (["row", "col", "box"] as const).map((kind) => ({ kind, r: 0, c: 0 })),
      digitDone: true, // all nine 5s are in
      cells: expect.any(Array),
    });
    expect(engine.completedAt(0, 0).cells).toHaveLength(9 * 3 + 9);

    engine.currentBoard.value[8]![8] = 9;
    const done = engine.completedAt(8, 8);
    expect(done.units).toBe(2); // column 8 and the bottom-right box; row 8 lacks (8, 3)
    expect(done.digitDone).toBe(true);
    expect(done.cells).toHaveLength(9 * 2 + 9);
    expect(done.cells.slice(0, 9)).toEqual(Array.from({ length: 9 }, (_, i) => ({ r: i, c: 8 })));
  });

  it("an applied hint circles its placement for a moment; undo clears it at once", () => {
    vi.useFakeTimers();
    const placement = { r: 0, c: 0, num: 5 };
    const move = {
      technique: "nakedSingle",
      digits: [5],
      triggers: [],
      eliminations: [],
      placement,
    };
    engine.showApplied(move as unknown as Parameters<typeof engine.showApplied>[0]);
    expect(engine.hintMarks.value).toEqual([circled(placement)]);
    vi.advanceTimersByTime(1400);
    expect(engine.hintMarks.value).toEqual([]);

    engine.showApplied(move as unknown as Parameters<typeof engine.showApplied>[0]);
    engine.undoMove(); // nothing to undo still starts clean
    expect(engine.hintMarks.value).toEqual([]);
    vi.useRealTimers();
  });
});

describe("peekMove: a technique picked from the panel's list", () => {
  it("opens on where to look, hiding the target, then steps to the same apply as a hint", () => {
    const engine = useSudokuEngine();
    const { puzzle, solution } = generateGradedPuzzle("expert", makeRng(3));
    engine.currentBoard.value = puzzle.map((row) => [...row]);
    engine.initialBoard.value = puzzle.map((row) => [...row]);
    engine.solvedBoard.value = solution;
    // Not the next hint: the last kind of move on the board that places a digit.
    const move = movesNow(puzzle).findLast((m) => m.placement)!;

    engine.peekMove(move);
    expect(engine.activeComplexHint.value!.steps).toHaveLength(3);
    expect(engine.currentStep.value!.label).toBe("hint.peek.lookLabel");
    expect(engine.lookUnit.value).not.toBeNull();
    expect(engine.activeHintCell.value).toBeNull();
    expect(engine.hintMarks.value).toEqual([]);

    engine.nextHintStep(() => {});
    expect(engine.lookUnit.value).toBeNull();
    expect(engine.activeHintCell.value).toEqual({ r: move.placement!.r, c: move.placement!.c });

    engine.nextHintStep(() => {});
    engine.nextHintStep(() => {});
    const { r, c, num } = move.placement!;
    expect(engine.currentBoard.value[r]![c]).toBe(num);
    expect(engine.activeComplexHint.value).toBeNull();
    // The next plain hint is back to two steps.
    engine.triggerComplexHint();
    expect(engine.activeComplexHint.value!.steps).toHaveLength(2);
  });
});
