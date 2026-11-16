import { afterEach, describe, expect, it, vi } from "vitest";

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
    const { puzzle } = await takePuzzle("beginner");
    expect(puzzle).toHaveLength(9);
    const lesson = await makeLesson("hidden-single", 5);
    expect(lesson.technique).toBe("hidden-single");
  });
});
