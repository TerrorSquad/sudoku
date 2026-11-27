import { describe, expect, it } from "vitest";

import type { Lesson } from "../utils/lesson";
import type { BoardUnit, CellRC } from "../utils/sudokuGrader";

import {
  instancesOf,
  lessonFromExample,
  lessonFromPosition,
  lessonFromPuzzle,
  lessonUnits,
  missReason,
  notesGrid,
  removalReason,
  shuffleLesson,
  tapPattern,
} from "../utils/lesson";
import { generatePracticePuzzle } from "../utils/practice";
import { ACADEMY_TECHNIQUES } from "../utils/progression";
import { stuckPosition } from "../utils/review";
import { getGridCandidates, makeRng, solveBoard } from "../utils/sudokuCore";

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
  it("turns a lesson's marks into a board's notes grid", () => {
    const lesson = lessonFromExample("naked-pair")!;
    const grid = notesGrid(lesson);
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        expect(grid[r]![c]!.flatMap((on, n) => (on ? [n] : []))).toEqual(lesson.notes[r]![c]);
  });

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

  it("accepts another XY-Chain on the same digit with as many cells", () => {
    // Two 4-cell chains from 1 to 1: the lesson's, and one down columns 1 and 8.
    const notes: number[][][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => []),
    );
    const set = (r: number, c: number, ns: number[]) => (notes[r]![c] = ns);
    const lessonChain = [
      { r: 0, c: 4 },
      { r: 1, c: 5 },
      { r: 6, c: 5 },
      { r: 7, c: 3 },
    ];
    for (const [{ r, c }, ns] of lessonChain.map(
      (p, i) =>
        [
          p,
          [
            [1, 3],
            [3, 8],
            [7, 8],
            [1, 7],
          ][i]!,
        ] as const,
    ))
      set(r, c, ns);
    set(2, 0, [1, 2]);
    set(2, 7, [2, 4]);
    set(5, 7, [4, 6]);
    set(5, 0, [1, 6]);
    // Cells that see both ends of a chain, holding 1 among three marks.
    set(0, 3, [1, 4, 5]);
    set(7, 4, [1, 5, 9]);
    set(8, 0, [1, 5, 9]);
    const eliminations = [
      { r: 0, c: 3, num: 1 },
      { r: 7, c: 4, num: 1 },
    ];
    const lesson = {
      technique: "xy-chain",
      board: Array.from({ length: 9 }, () => Array<number>(9).fill(0)),
      notes,
      pattern: lessonChain,
      placement: null,
      eliminations,
      digits: [1],
      unit: null,
      move: { technique: "xy-chain", tier: 5, triggers: lessonChain, eliminations, digits: [1] },
    } satisfies Lesson;
    expect(
      instancesOf(lesson).map((i) => ({ pattern: i.pattern, eliminations: i.eliminations })),
    ).toEqual([
      { pattern: lessonChain, eliminations },
      {
        pattern: [
          { r: 2, c: 0 },
          { r: 2, c: 7 },
          { r: 5, c: 7 },
          { r: 5, c: 0 },
        ],
        eliminations: [{ r: 8, c: 0, num: 1 }],
      },
    ]);
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

describe("why not", () => {
  // Every Academy example: tap each empty non-pattern cell; most get a reason naming something
  // specific, never the bare "Not that cell" when anything more is true.
  it.each(ACADEMY_TECHNIQUES.map((t) => t.id))(
    "%s: most wrong taps get a specific reason",
    (id) => {
      const lesson = lessonFromExample(id)!;
      const isPattern = (p: CellRC) => lesson.pattern.some((q) => q.r === p.r && q.c === p.c);
      const taps = ALL.filter((p) => !lesson.board[p.r]![p.c] && !isPattern(p));
      const vague = taps.filter((p) => missReason(lesson, p).key === "lesson.miss");
      expect(vague.length / taps.length).toBeLessThan(1 / 3);
    },
  );

  it.each(ACADEMY_TECHNIQUES.map((t) => t.id).filter((id) => !lessonFromExample(id)!.placement))(
    "%s: a wrong removal says why the mark stays",
    (id) => {
      const lesson = lessonFromExample(id)!;
      const inst = instancesOf(lesson)[0]!;
      const reasons = new Set<string>();
      for (const p of ALL)
        for (const num of lesson.notes[p.r]![p.c]!) {
          if (inst.eliminations.some((e) => e.r === p.r && e.c === p.c && e.num === num)) continue;
          reasons.add(removalReason(lesson, inst, p, num).key);
        }
      expect([...reasons].some((k) => k !== "lesson.notThisCell")).toBe(true);
      // A hidden subset removes every other mark from its cells, so none of theirs is left to try.
      if (!id.startsWith("hidden-")) expect(reasons).toContain("lesson.why.inPattern");
    },
  );

  it("keeps a pattern cell's other marks for what they are: not removed, not 'the pattern'", () => {
    expect.hasAssertions();
    for (const { id } of ACADEMY_TECHNIQUES) {
      const lesson = lessonFromExample(id)!;
      if (lesson.placement) continue;
      const inst = instancesOf(lesson)[0]!;
      const removed = new Set(inst.eliminations.map((e) => e.num));
      for (const p of inst.pattern)
        for (const num of lesson.notes[p.r]![p.c]!)
          if (!removed.has(num))
            expect(removalReason(lesson, inst, p, num).key).toBe("lesson.why.onlyRemoves");
    }
  });

  it("names the far ends a skyscraper's removal has to see", () => {
    const lesson = lessonFromExample("skyscraper")!;
    const inst = instancesOf(lesson)[0]!;
    const d = lesson.digits[0]!;
    const [, f1, , f2] = lesson.pattern;
    // A cell with the digit in a far end's row, not one the move clears: it sees only that end.
    const one = ALL.find(
      (p) =>
        lesson.notes[p.r]![p.c]!.includes(d) &&
        p.r === f1!.r &&
        !lesson.pattern.some((q) => q.r === p.r && q.c === p.c) &&
        !inst.eliminations.some((e) => e.r === p.r && e.c === p.c),
    );
    if (one) {
      const why = removalReason(lesson, inst, one, d);
      expect(why.key).toMatch(/lesson\.why\.sees(One|None)/);
    }
    expect(f2).toBeDefined();
  });
});

describe("on your own (level 3)", () => {
  const same = (a: CellRC[], b: CellRC[]) =>
    a.length === b.length && a.every((p) => b.some((q) => q.r === p.r && q.c === p.c));
  // Tapping every cell of `pattern` against `instances`: the instance it completes, if any.
  const tapAll = (instances: ReturnType<typeof instancesOf>, pattern: CellRC[]) => {
    let found: CellRC[] = [];
    for (const p of pattern) {
      const res = tapPattern(instances, found, p);
      if (res.miss) return null;
      found = res.found;
      if (res.complete) return res.complete;
    }
    return null;
  };

  // Every instance level 3 counts is real, tapping it completes it, and level 1 doesn't count the
  // extra ones; a wrong tap's reason gives nothing away (no digit, unit or line).
  function expectFair(L: Lesson) {
    const id = L.technique;
    const solved = solveBoard(L.board)!;
    const all = instancesOf(L, 3);
    const guided = instancesOf(L, 1);
    expect(all[0]!.pattern).toEqual(L.pattern);
    for (const g of guided) expect(all.some((x) => same(x.pattern, g.pattern))).toBe(true);
    for (const inst of all) {
      const p = inst.move.placement;
      if (p) expect(solved[p.r]![p.c]).toBe(p.num);
      else expect(inst.eliminations.length).toBeGreaterThan(0);
      for (const e of inst.eliminations) {
        expect(solved[e.r]![e.c]).not.toBe(e.num);
        expect(L.notes[e.r]![e.c]).toContain(e.num);
      }
      expect(tapAll(all, inst.pattern)).toBe(inst);
      if (!guided.some((g) => same(g.pattern, inst.pattern)))
        expect(tapAll(guided, inst.pattern)).toBeNull();
    }
    for (const cell of ALL) {
      const why = missReason(L, cell, 3);
      expect(["lesson.why.filled", "lesson.why.manyMarks", "lesson.miss"]).toContain(why.key);
      if (why.key === "lesson.why.manyMarks") expect(id).toBe("naked-single");
    }
  }

  it.each(ACADEMY_TECHNIQUES.map((t) => t.id))("%s's example, and transposed", (id) => {
    const base = lessonFromExample(id)!;
    expect(base.technique).toBe(id);
    expectFair(base);
    expectFair(shuffleLesson(base, makeRng(5), true));
  });

  it("finds the board's other singles, pointing pairs, fish and subsets", async () => {
    for (const id of [
      "naked-single",
      "hidden-single",
      "pointing",
      "box-line",
      "jellyfish",
    ] as const)
      expect(instancesOf(lessonFromExample(id)!, 3).length).toBeGreaterThan(1);
    // Seeds whose position has more than one (checked by hand).
    const found = await Promise.all(
      (
        [
          ["naked-pair", 5],
          ["hidden-pair", 1],
          ["x-wing", 2],
        ] as const
      ).map(async ([id, seed]) =>
        lessonFromPuzzle((await generatePracticePuzzle(id, makeRng(seed))).board, id)!,
      ),
    );
    for (const L of found) {
      expectFair(L);
      expect(instancesOf(L, 3).length).toBeGreaterThan(1);
    }
  });
});

describe("the player's own position (Daily review)", () => {
  // Where a game would hint the x-wing: its board, and the removals the chain made before it.
  async function stuck() {
    const L = lessonFromPuzzle(
      (await generatePracticePuzzle("x-wing", makeRng(11))).board,
      "x-wing",
    )!;
    const cands = getGridCandidates(L.board);
    const elims = ALL.flatMap(({ r, c }) =>
      cands[r]![c]!.filter((n) => !L.notes[r]![c]!.includes(n)).map((num) => ({ r, c, num })),
    );
    return { L, p: stuckPosition(L.board, elims, "2026-11-20") };
  }

  it("replays a captured position to the same lesson", async () => {
    const { L, p } = await stuck();
    expect(p.elims.length % 3).toBe(0);
    expect(lessonFromPosition(p, "x-wing")).toEqual(L);
  });

  it("rejects a position that isn't sound, or where the technique never comes", async () => {
    const { p } = await stuck();
    const at = p.board.indexOf("0");
    const solved = solveBoard(lessonFromPosition(p, "x-wing")!.board)!;
    const answer = solved[Math.floor(at / 9)]![at % 9]!;
    const r = Math.floor(at / 9);
    const c = at % 9;
    const set = (i: number, d: string) => p.board.slice(0, i) + d + p.board.slice(i + 1);
    // Another digit of its row put in the empty cell: a clash.
    const clash = p.board.slice(r * 9, r * 9 + 9).replace(/0/g, "")[0]!;
    expect(lessonFromPosition({ ...p, board: set(at, clash) }, "x-wing")).toBeNull();
    // Its answer removed: the solver would reason from a falsehood.
    expect(lessonFromPosition({ ...p, elims: `${r}${c}${answer}` }, "x-wing")).toBeNull();
    // A removal in a filled cell.
    const filled = p.board.search(/[1-9]/);
    expect(
      lessonFromPosition(
        { ...p, elims: `${Math.floor(filled / 9)}${filled % 9}${p.board[filled] === "1" ? 2 : 1}` },
        "x-wing",
      ),
    ).toBeNull();
    // An empty board has many solutions.
    expect(lessonFromPosition({ ...p, board: "0".repeat(81), elims: "" }, "x-wing")).toBeNull();
    // A full board: nothing left to find.
    const full = solved.flat().join("");
    expect(lessonFromPosition({ ...p, board: full, elims: "" }, "x-wing")).toBeNull();
    // Not a position at all.
    expect(lessonFromPosition({ ...p, board: "12" } as never, "x-wing")).toBeNull();
  });
});
