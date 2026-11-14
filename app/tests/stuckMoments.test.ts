import { describe, it, expect } from "vitest";

import { onBoard, restorePlacements, stuckMoments, type Placement } from "../utils/stuckMoments";
import { techniquesRequired } from "../utils/sudokuGrader";

const toGrid = (rows: string[]) => rows.map((r) => [...r].map((c) => (c === "." ? 0 : Number(c))));

// The expert board pinned in needed-techniques.spec.ts: it needs an XY-Wing, a Hidden Pair and a
// Pointing Pair.
const PUZZLE = toGrid([
  ".7.....5.",
  "...85.2..",
  "...6..8.3",
  "4....9..7",
  "..13.....",
  "..9..53.6",
  "......642",
  "15.4.....",
  "2........",
]);
const SOLUTION = toGrid([
  "678923451",
  "314857269",
  "925614873",
  "432169587",
  "561378924",
  "789245316",
  "897531642",
  "156492738",
  "243786195",
]);

// Every empty cell filled in reading order, `times[k]` on the clock for the k-th one.
function logAt(times: number[]): Placement[] {
  const empties: [number, number][] = [];
  PUZZLE.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));
  return times.map((t, k) => {
    const [r, c] = empties[k]!;
    return { r, c, num: SOLUTION[r]![c]!, t };
  });
}

describe("stuckMoments", () => {
  it("keeps only waits of at least the threshold", () => {
    expect(stuckMoments(PUZZLE, logAt([5, 20, 50, 70]))).toEqual([]);
    expect(stuckMoments(PUZZLE, logAt([5, 45])).map((m) => [m.at, m.gap])).toEqual([[5, 40]]);
  });

  it("counts the wait before the first placement from the start", () => {
    expect(stuckMoments(PUZZLE, logAt([61, 70])).map((m) => [m.at, m.gap])).toEqual([[0, 61]]);
  });

  it("picks the longest few and lists them in game order", () => {
    // Waits: 50, 100, 10, 70, 45, 200.
    const log = logAt([50, 150, 160, 230, 275, 475]);
    expect(stuckMoments(PUZZLE, log).map((m) => [m.at, m.gap])).toEqual([
      [50, 100],
      [160, 70],
      [275, 200],
    ]);
    expect(stuckMoments(PUZZLE, log, 40, 1).map((m) => m.gap)).toEqual([200]);
  });

  it("names what the solver needed on the board as it stood", () => {
    const [first] = stuckMoments(PUZZLE, logAt([90]));
    expect(techniquesRequired(PUZZLE)).toContain(first!.technique);

    // One cell left: a Naked Single, whatever came before.
    const log = logAt([...Array(PUZZLE.flat().filter((v) => !v).length).keys()]);
    log.at(-1)!.t += 300;
    expect(stuckMoments(PUZZLE, log)).toEqual([
      { at: log.at(-2)!.t, gap: 301, technique: "naked-single" },
    ]);
  });
});

describe("restorePlacements", () => {
  // Halfway through: the first 20 empty cells played, one wrong digit sitting in the 21st.
  const empties: [number, number][] = [];
  PUZZLE.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));
  const currentBoard = PUZZLE.map((row) => [...row]);
  for (const [r, c] of empties.slice(0, 20)) currentBoard[r]![c] = SOLUTION[r]![c]!;
  const [wr, wc] = empties[20]!;
  currentBoard[wr]![wc] = (SOLUTION[wr]![wc]! % 9) + 1;
  const save = { initialBoard: PUZZLE, currentBoard, solvedBoard: SOLUTION, timerSeconds: 600 };

  it("rebuilds an older save's log from the board, with no invented wait", () => {
    const log = restorePlacements(save);
    expect(log).toHaveLength(20); // the wrong digit is left out
    expect(log.every((p) => p.t === 600 && p.restored)).toBe(true);
    expect(stuckMoments(PUZZLE, log)).toEqual([]);
    // A wait after resuming still counts, from the save's clock.
    const [r, c] = empties[21]!;
    expect(stuckMoments(PUZZLE, [...log, { r, c, num: SOLUTION[r]![c]!, t: 700 }])).toMatchObject([
      { at: 600, gap: 100 },
    ]);
  });

  it("rebuilds a malformed log instead of trusting it", () => {
    for (const placements of [
      "nope",
      [{ r: 9, c: 0, num: 1, t: 1 }],
      [{ r: 0, c: 0, num: 0, t: 1 }],
      [{ r: 0, c: 0, num: 5, t: Number.NaN }],
      [{ r: 0.5, c: 0, num: 5, t: 1 }],
      [null],
    ])
      expect(restorePlacements({ ...save, placements })).toHaveLength(20);
  });

  it("keeps a well-formed log, minus digits no longer on the board", () => {
    const [r, c] = empties[0]!;
    const [r2, c2] = empties[30]!;
    const placements = [
      { r, c, num: SOLUTION[r]![c]!, t: 5 },
      { r: r2, c: c2, num: SOLUTION[r2]![c2]!, t: 9 }, // since undone
    ];
    expect(restorePlacements({ ...save, placements })).toEqual([placements[0]]);
    expect(onBoard(placements, currentBoard)).toEqual([placements[0]]);
  });
});
