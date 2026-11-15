import { describe, expect, it } from "vitest";

import {
  BASICS,
  BASICS_IDS,
  SOLUTION,
  blockedBy,
  candidatesAt,
  hatchedBy,
  mergeBasics,
  readBasics,
} from "../utils/basics";
import { solveBoard } from "../utils/sudokuCore";

const tasks = BASICS_IDS.flatMap((id) => BASICS[id].map((task) => ({ id, task })));
const empties = (board: number[][]) =>
  board.flatMap((row, r) => row.map((v, c) => ({ r, c, v }))).filter((p) => p.v === 0);

describe("basics lessons", () => {
  it("the solution is a valid solved grid", () => {
    expect(solveBoard(SOLUTION)).toEqual(SOLUTION);
  });

  it.each(tasks)(
    "$id/$task.prompt: the board is a piece of the solution, the cell empty",
    ({ task }) => {
      task.board.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) expect(v).toBe(SOLUTION[r]![c]);
        }),
      );
      expect(task.board[task.cell.r]![task.cell.c]).toBe(0);
    },
  );

  it("each rule task's unit leaves exactly its answer", () => {
    for (const task of BASICS.rule)
      expect(candidatesAt(task.board, task.cell)).toEqual([SOLUTION[task.cell.r]![task.cell.c]]);
  });

  it("the notes cell can hold 1, 5 and 9, its answer among them", () => {
    const [task] = BASICS.notes;
    expect(candidatesAt(task!.board, task!.cell)).toEqual([1, 5, 9]);
    expect(SOLUTION[task!.cell.r]![task!.cell.c]).toBe(5);
  });

  it("the single board has exactly one cell down to one candidate, the task's", () => {
    const [task] = BASICS.single;
    const singles = empties(task!.board).filter((p) => candidatesAt(task!.board, p).length === 1);
    expect(singles.map(({ r, c }) => ({ r, c }))).toEqual([task!.cell]);
    expect(candidatesAt(task!.board, task!.cell)).toEqual([SOLUTION[task!.cell.r]![task!.cell.c]]);
  });

  it("scanning leaves the 5 one cell in its box, and every other cell is ruled out by a line", () => {
    const [task] = BASICS.scan;
    const d = task!.scan!;
    const box = empties(task!.board).filter((p) => p.r < 3 && p.c < 3);
    const open = box.filter((p) => !hatchedBy(task!.board, p, d));
    expect(open.map(({ r, c }) => ({ r, c }))).toEqual([task!.cell]);
    expect(SOLUTION[task!.cell.r]![task!.cell.c]).toBe(d);
  });

  it("blockedBy names the unit already holding a digit", () => {
    const [task] = BASICS.notes;
    expect(blockedBy(task!.board, task!.cell, 4)).toBe("row");
    expect(blockedBy(task!.board, task!.cell, 1)).toBeNull();
  });
});

describe("basics progress", () => {
  it("reads known ids only, in lesson order", () => {
    expect(readBasics(["scan", "rule", "later-lesson", 3])).toEqual(["rule", "scan"]);
    expect(readBasics({ rule: true })).toEqual([]);
  });

  it("merges as a union, keeping a later version's lessons", () => {
    expect(mergeBasics(["rule"], ["notes", "later-lesson"])).toEqual([
      "rule",
      "notes",
      "later-lesson",
    ]);
    expect(mergeBasics(null, ["rule", "rule", 4])).toEqual(["rule"]);
  });
});
