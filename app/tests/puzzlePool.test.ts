import { afterEach, describe, expect, it, vi } from "vitest";

import { generateDailyBoard } from "../composables/useDailyPuzzle";
import { generateLesson } from "../utils/lesson";
import { generatePracticePuzzle } from "../utils/practice";
import { makeRng } from "../utils/sudokuCore";
import { featuredTechnique } from "../utils/sudokuGrader";

// A worker whose generator always throws: it posts {id, error} back, as puzzleWorker.ts does.
class FailingWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(msg: { id: number }) {
    queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, error: "Error: boom" } }));
  }
  terminate() {}
}

describe("puzzlePool when the worker's generator fails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("generates the job in place instead of waiting forever", async () => {
    vi.stubGlobal("Worker", FailingWorker);
    const { makeLesson, takePuzzle } = await import("../utils/puzzlePool");
    const { puzzle, technique } = await takePuzzle("beginner");
    expect(puzzle).toHaveLength(9);
    expect(technique).toBeNull(); // singles only
    const lesson = await makeLesson("hidden-single", 5);
    expect(lesson.technique).toBe("hidden-single");
  });
});

// The worker and the in-place fallback must deal the same board for a seed: a Daily is the same for
// everyone, and a week's practice puzzle too, whichever path a player's browser takes.
describe("puzzlePool's worker and in-place paths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("give the same Daily, practice puzzle and lesson for a seed", async () => {
    // puzzleWorker.ts's own message handler, run as the browser would.
    let posted: { result?: unknown; error?: string } = {};
    const fakeSelf = {
      onmessage: null as null | ((e: { data: unknown }) => Promise<void>),
      // Cloned, as postMessage does: a result that can't cross to the page fails here.
      postMessage: (m: typeof posted) => (posted = structuredClone(m)),
    };
    vi.stubGlobal("self", fakeSelf);
    await import("../utils/puzzleWorker");
    const inWorker = async (job: object) => {
      await fakeSelf.onmessage!({ data: { id: 0, ...job } });
      expect(posted.error).toBeUndefined();
      return posted.result;
    };
    const pool = await import("../utils/puzzlePool"); // no Worker in node: in place
    const sameDaily = async (level: "medium" | "master") => {
      const board = generateDailyBoard("2026-06-11", level);
      const daily = { puzzle: board, technique: featuredTechnique(board) };
      expect(await pool.makeDailyBoard("2026-06-11", level)).toEqual(daily);
      expect(await inWorker({ daily: "2026-06-11", level })).toEqual(daily);
      expect(await inWorker({ featured: board })).toBe(daily.technique);
      expect(await pool.featuredOf(board, "classic")).toBe(daily.technique);
    };
    await sameDaily("medium");
    await sameDaily("master");
    const practice = await generatePracticePuzzle("pointing", makeRng(7));
    expect(await pool.practicePuzzle("pointing", 7)).toEqual(practice);
    expect(await inWorker({ practice: "pointing", seed: 7 })).toEqual(practice);
    const lesson = await generateLesson("x-wing", makeRng(3), 2);
    expect(await pool.guidedLesson("x-wing", 3, 2)).toEqual(lesson);
    expect(await inWorker({ lesson: "x-wing", seed: 3, level: 2 })).toEqual(lesson);
  });
});
