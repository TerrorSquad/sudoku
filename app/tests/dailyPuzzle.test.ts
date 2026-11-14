import { describe, it, expect } from "vitest";

import {
  localDateKey,
  generateDailyBoard,
  computeStreak,
  fastestDaily,
} from "../composables/useDailyPuzzle";
import { hasUniqueSolution } from "../utils/sudokuCore";

describe("daily puzzle", () => {
  it("localDateKey uses the local calendar date", () => {
    // 00:30 local on June 11 — UTC-based keys would report a different
    // day for any zone east of UTC
    const date = new Date(2026, 5, 11, 0, 30);
    expect(localDateKey(date)).toBe("2026-06-11");
  });

  it("board is deterministic per date and differs between dates", () => {
    const a1 = generateDailyBoard("2026-06-11");
    const a2 = generateDailyBoard("2026-06-11");
    const b = generateDailyBoard("2026-06-12");
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(b);
  });

  it("a day's board never changes, so everyone keeps the same daily across releases", () => {
    // A generator change that alters the board reshuffles today's daily for players mid-day.
    expect(generateDailyBoard("2026-06-11").flat().join("")).toMatchInlineSnapshot(
      `"109500000260310974080026053076002000851073269023000500090001000300200690000000030"`,
    );
  });

  it("daily board has a unique solution", () => {
    expect(hasUniqueSolution(generateDailyBoard("2026-06-11"))).toBe(true);
  });

  it("streak counts consecutive completed days ending today", () => {
    const done = new Set(["2026-06-11", "2026-06-10", "2026-06-09"]);
    expect(computeStreak((k) => done.has(k), new Date(2026, 5, 11))).toBe(3);
  });

  it("an unplayed today does not break the streak", () => {
    const done = new Set(["2026-06-10", "2026-06-09"]);
    expect(computeStreak((k) => done.has(k), new Date(2026, 5, 11))).toBe(2);
  });

  it("a gap breaks the streak", () => {
    const done = new Set(["2026-06-11", "2026-06-09", "2026-06-08"]);
    expect(computeStreak((k) => done.has(k), new Date(2026, 5, 11))).toBe(1);
  });

  it("no completions means no streak", () => {
    expect(computeStreak(() => false, new Date(2026, 5, 11))).toBe(0);
  });

  it("streak crosses month boundaries correctly", () => {
    const done = new Set(["2026-06-01", "2026-05-31", "2026-05-30"]);
    expect(computeStreak((k) => done.has(k), new Date(2026, 5, 1))).toBe(3);
  });

  it("fastestDaily is the quickest completed Daily, ignoring other keys", () => {
    const records: Record<string, { completed: boolean; time: number; mistakes: number }> = {
      "2026-06-01": { completed: true, time: 412, mistakes: 0 },
      "2026-06-02": { completed: true, time: 305, mistakes: 2 },
      "2026-06-03": { completed: false, time: 100, mistakes: 0 },
    };
    const keys = [
      ...Object.keys(records).map((d) => `sudoku_v1_daily_${d}`),
      "sudoku_v1_score",
      "sudoku_v1_save_medium",
    ];
    expect(fastestDaily(keys, (d) => records[d] ?? null)).toBe(305);
  });

  it("fastestDaily is 0 with no completed Daily", () => {
    expect(fastestDaily(["sudoku_v1_score"], () => null)).toBe(0);
    expect(fastestDaily([], () => null)).toBe(0);
  });
});
