import { describe, it, expect } from "vitest";

import type { Grid } from "../types/sudoku";

import {
  makeRng,
  generatePuzzle,
  getGridCandidates,
  hasUniqueSolution,
  solveBoard,
} from "../utils/sudokuCore";
import {
  availableTechniques,
  movesNow,
  spottedMove,
  techniqueFor,
  notesEliminations,
  solveLogically,
  gradePuzzle,
  generateGradedPuzzle,
  neededTechniques,
  nextHint,
  patternUnit,
  singlesPath,
  techniquesRequired,
  STUCK,
  type SolveMove,
} from "../utils/sudokuGrader";

const grade = (d: string, seed: number) => generateGradedPuzzle(d, makeRng(seed)).grade;

describe("sudokuGrader — logical solver", () => {
  it("grades a nearly-full puzzle as singles (grade 1)", () => {
    const { puzzle } = generatePuzzle(20, makeRng(5));
    expect(gradePuzzle(puzzle)).toBe(1);
  });

  it("logical solution matches the backtracking solution when solvable", () => {
    expect.hasAssertions();
    for (const seed of [11, 22, 33, 44, 55]) {
      const { puzzle, solution } = generatePuzzle(45, makeRng(seed));
      const result = solveLogically(puzzle);
      if (result.solved) {
        expect(result.board).toEqual(solution);
        expect(solveBoard(puzzle)).toEqual(solution);
      }
    }
  });

  it("solved=true iff the board is complete; STUCK iff incomplete", () => {
    for (const seed of [99, 100, 101, 102]) {
      const { puzzle } = generatePuzzle(60, makeRng(seed));
      const result = solveLogically(puzzle);
      const flat = result.board.flat();
      if (result.solved) {
        expect(flat.every((v) => v >= 1 && v <= 9)).toBe(true);
        expect(result.grade).toBeLessThan(STUCK);
      } else {
        expect(result.grade).toBe(STUCK);
        expect(flat.some((v) => v === 0)).toBe(true);
      }
    }
  });

  it("grades the empty grid as STUCK (not logically solvable)", () => {
    const empty: Grid = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    expect(gradePuzzle(empty)).toBe(STUCK);
  });
});

describe("sudokuGrader — graded generation", () => {
  it.each(["beginner", "easy", "medium", "hard", "expert", "master"])(
    "always returns a fully logically-solvable %s puzzle (never STUCK)",
    (difficulty) => {
      const gp = generateGradedPuzzle(difficulty, makeRng(2026));
      expect(hasUniqueSolution(gp.puzzle)).toBe(true);
      expect(gp.grade).toBeGreaterThanOrEqual(1);
      expect(gp.grade).toBeLessThan(STUCK);
      // Grade is the genuine logical difficulty: the tier-only solver completes it.
      expect(solveLogically(gp.puzzle).solved).toBe(true);
      expect(solveBoard(gp.puzzle)).toEqual(gp.solution);
    },
  );

  it("beginner puzzles are always solvable with singles only", () => {
    for (const seed of [1, 2, 3]) {
      const gp = generateGradedPuzzle("beginner", makeRng(seed));
      expect(gp.grade).toBe(1);
    }
  });

  it("harder difficulties trend to higher tiers than easier ones", () => {
    // Average across seeds keeps this robust against the rare fallback board.
    const avg = (d: string) => [1, 2, 3, 4, 5].reduce((s, seed) => s + grade(d, seed), 0) / 5;
    expect(avg("beginner")).toBeLessThanOrEqual(avg("hard"));
    expect(avg("easy")).toBeLessThanOrEqual(avg("expert"));
  });

  it("the top levels differ in how much hard work a board holds, not only in its hardest move", () => {
    // Graded on the peak alone, Hard and Expert were both "one tier-4 move" boards and Master was
    // "one tier-5 move": a Master could play lighter than a Hard.
    const work = (d: string, seed: number) => {
      const r = solveLogically(generateGradedPuzzle(d, makeRng(seed)).puzzle);
      return { grade: r.grade, hard: r.moves[3]! + r.moves[4]! + r.moves[5]! };
    };
    for (let seed = 1; seed <= 10; seed++) {
      expect(work("medium", seed).grade).toBeGreaterThanOrEqual(2);
      const hard = work("hard", seed);
      expect([3, 4]).toContain(hard.grade);
      expect(hard.hard).toBeLessThanOrEqual(2);
      const expert = work("expert", seed);
      expect(expert.grade).toBe(4);
      expect(expert.hard).toBeGreaterThanOrEqual(3);
      const master = work("master", seed);
      expect(master.grade).toBe(5);
      expect(master.hard).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("sudokuGrader — neededTechniques", () => {
  it("lists only singles when nothing harder is needed", () => {
    const needed = neededTechniques(generatePuzzle(20, makeRng(5)).puzzle);
    expect(needed.length).toBeGreaterThan(0);
    for (const id of needed) expect(["naked-single", "hidden-single"]).toContain(id);
  });

  it("drops the singles and puts the hardest technique first", () => {
    // The board e2e/needed-techniques.spec.ts wins on.
    const puzzle: Grid = [
      ".7.....5.",
      "...85.2..",
      "...6..8.3",
      "4....9..7",
      "..13.....",
      "..9..53.6",
      "......642",
      "15.4.....",
      "2........",
    ].map((row) => [...row].map((ch) => (ch === "." ? 0 : Number(ch))));
    // The solver met these easiest-first: hidden single, pointing, hidden pair, xy-wing, naked single.
    expect([...techniquesRequired(puzzle)!]).toContain("naked-single");
    expect(neededTechniques(puzzle)).toEqual(["xy-wing", "hidden-pair", "pointing"]);
  });

  it("is empty when logic alone can't finish the board", () => {
    const empty: Grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(neededTechniques(empty)).toEqual([]);
  });
});

describe("sudokuGrader — singlesPath", () => {
  it("fills a board that singles finish, in an order the solver can follow", () => {
    const { puzzle, solution } = generatePuzzle(20, makeRng(5));
    const path = singlesPath(puzzle)!;
    expect(path).toHaveLength(puzzle.flat().filter((v) => v === 0).length);
    for (const { r, c, num } of path) expect(num).toBe(solution[r]![c]);
  });

  it("is empty for a full board and null when singles run dry", () => {
    const { solution } = generatePuzzle(20, makeRng(5));
    expect(singlesPath(solution)).toEqual([]);
    expect(singlesPath(generateGradedPuzzle("expert", makeRng(7)).puzzle)).toBeNull();
  });
});

describe("sudokuGrader — patternUnit", () => {
  const move = (m: Partial<SolveMove>): SolveMove => ({
    technique: "naked-pair",
    tier: 2,
    eliminations: [],
    triggers: [],
    digits: [1],
    ...m,
  });

  it("names the one row, column or box that holds the whole pattern", () => {
    const pairInRow = move({
      triggers: [
        { r: 3, c: 0 },
        { r: 3, c: 7 },
      ],
      eliminations: [{ r: 3, c: 4, num: 1 }],
    });
    expect(patternUnit(pairInRow)).toEqual({ kind: "row", r: 3, c: 4 });
    const pairInCol = move({
      triggers: [
        { r: 0, c: 5 },
        { r: 8, c: 5 },
      ],
      eliminations: [{ r: 4, c: 5, num: 1 }],
    });
    expect(patternUnit(pairInCol).kind).toBe("col");
    const claiming = move({
      technique: "box-line",
      triggers: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      eliminations: [{ r: 2, c: 2, num: 1 }],
    });
    expect(patternUnit(claiming)).toEqual({ kind: "box", r: 2, c: 2 });
  });

  it("uses the unit a hidden single was found in", () => {
    const lone = move({
      technique: "hidden-single",
      placement: { r: 2, c: 5, num: 4 },
      unit: "col",
    });
    expect(patternUnit(lone)).toEqual({ kind: "col", r: 2, c: 5 });

    // Real hidden singles: the named unit has no other spot for the digit.
    let seen = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const board = generatePuzzle(50, makeRng(seed)).puzzle;
      const m = nextHint(board);
      if (m?.technique !== "hidden-single") continue;
      seen++;
      const u = patternUnit(m);
      expect(u.kind).toBe(m.unit);
      const { r, c, num } = m.placement!;
      const cells = [...Array(81).keys()]
        .map((i) => ({ r: Math.floor(i / 9), c: i % 9 }))
        .filter((p) =>
          u.kind === "row"
            ? p.r === r
            : u.kind === "col"
              ? p.c === c
              : Math.floor(p.r / 3) === Math.floor(r / 3) &&
                Math.floor(p.c / 3) === Math.floor(c / 3),
        );
      const fits = (p: { r: number; c: number }) =>
        board[p.r]![p.c] === 0 &&
        [...Array(9).keys()].every((k) => board[p.r]![k] !== num && board[k]![p.c] !== num) &&
        [...Array(9).keys()].every(
          (k) => board[p.r - (p.r % 3) + Math.floor(k / 3)]![p.c - (p.c % 3) + (k % 3)] !== num,
        );
      expect(cells.filter(fits)).toEqual([{ r, c }]);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("falls back to the box the move acts in when the pattern spans units", () => {
    const xWing = move({
      technique: "x-wing",
      triggers: [
        { r: 1, c: 1 },
        { r: 1, c: 7 },
        { r: 6, c: 1 },
        { r: 6, c: 7 },
      ],
      eliminations: [{ r: 4, c: 7, num: 1 }],
    });
    expect(patternUnit(xWing)).toEqual({ kind: "box", r: 4, c: 7 });
  });
});

describe("availableTechniques", () => {
  it("lists the next hint's technique first, then every other finder that applies", () => {
    expect.hasAssertions();
    for (const seed of [3, 7, 12]) {
      const { puzzle } = generateGradedPuzzle("expert", makeRng(seed));
      const found = availableTechniques(puzzle);
      expect(found[0]).toBe(nextHint(puzzle)!.technique);
      expect(new Set(found).size).toBe(found.length);
    }
  });

  it("counts the player's pencil marks: a single the notes leave is listed", () => {
    // A Master board as reported: r8c3 is {6, 9} by the digits, but its notes keep only the 6.
    const board: Grid = [
      [0, 0, 0, 5, 4, 2, 6, 8, 3],
      [2, 0, 0, 1, 3, 9, 5, 7, 4],
      [5, 3, 4, 8, 7, 6, 2, 9, 1],
      [4, 0, 0, 9, 2, 3, 1, 6, 7],
      [9, 7, 3, 6, 8, 1, 4, 2, 5],
      [0, 0, 2, 4, 5, 7, 8, 3, 9],
      [8, 2, 1, 3, 9, 5, 7, 4, 6],
      [0, 4, 0, 7, 1, 8, 0, 5, 2],
      [0, 0, 0, 2, 6, 4, 0, 1, 8],
    ];
    const noted: Record<string, number[]> = {
      "0-0": [1, 7],
      "0-1": [1, 9],
      "0-2": [7, 9],
      "1-1": [6, 8],
      "1-2": [6, 8],
      "3-1": [5, 8],
      "3-2": [5, 8],
      "5-0": [1, 6],
      "5-1": [1, 6],
      "7-0": [3, 6],
      "7-2": [6],
      "7-6": [3, 9],
      "8-0": [3, 7],
      "8-1": [5, 9],
      "8-2": [5, 7, 9],
      "8-6": [3, 9],
    };
    const notes = board.map((row, r) =>
      row.map((_, c) => Array.from({ length: 10 }, (_v, n) => !!noted[`${r}-${c}`]?.includes(n))),
    );
    expect(availableTechniques(board)).not.toContain("naked-single");
    expect(availableTechniques(board, notesEliminations(board, notes))).toContain("naked-single");
  });

  it("lists nothing on a solved board", () => {
    const { solution } = generatePuzzle(40, makeRng(1));
    expect(availableTechniques(solution)).toEqual([]);
  });
});

describe("spottedMove", () => {
  it("names a technique when the player takes out its last pencil mark, not before", () => {
    const { puzzle } = generateGradedPuzzle("expert", makeRng(3));
    const cands = getGridCandidates(puzzle);
    const notes = cands.map((row) =>
      row.map((cs) => Array.from({ length: 10 }, (_v, n) => cs.includes(n))),
    );
    const move = movesNow(puzzle).find((m) => m.tier >= 2 && m.eliminations.length >= 2)!;
    const [first, ...rest] = move.eliminations;
    expect(spottedMove(puzzle, notes, first!)).toBeNull();
    for (const e of rest.slice(0, -1).concat(first!)) notes[e.r]![e.c]![e.num] = false;
    const last = rest.at(-1)!;
    expect(spottedMove(puzzle, notes, last)?.technique).toBe(move.technique);
  });
});

describe("techniqueFor", () => {
  it("is null for a single and names what a harder placement took", () => {
    const { puzzle, solution } = generateGradedPuzzle("expert", makeRng(3));
    const single = nextHint(puzzle)!.placement!;
    expect(techniqueFor(puzzle, single)).toBeNull();
    // A cell the solver only reaches past the singles names a technique above them.
    const found = puzzle
      .flatMap((row, r) => row.map((v, c) => ({ r, c, v })))
      .filter(({ v }) => v === 0)
      .map(({ r, c }) => techniqueFor(puzzle, { r, c }))
      .filter((t) => t !== null);
    expect(found.length).toBeGreaterThan(0);
    expect(solution[single.r]![single.c]).toBe(single.num);
  });
});
