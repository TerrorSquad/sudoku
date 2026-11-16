import { describe, it, expect } from "vitest";

import type { Difficulty } from "../types/sudoku";

import {
  completedDays,
  dailyKey,
  fastestDaily,
  generateDailyBoard,
  parseDailyKey,
} from "../composables/useDailyPuzzle";
import { localDateKey, streakState } from "../utils/streak";
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

  it("every level has its own Daily, stable per date; Medium's is the original", () => {
    const levels = ["beginner", "easy", "medium", "hard", "expert", "master"] as const;
    const boards = levels.map((l) => generateDailyBoard("2026-06-11", l).flat().join(""));
    expect(new Set(boards).size).toBe(6);
    expect(boards[2]).toBe(generateDailyBoard("2026-06-11").flat().join(""));
    expect(generateDailyBoard("2026-06-11", "hard")).toEqual(
      generateDailyBoard("2026-06-11", "hard"),
    );
    expect(generateDailyBoard("2026-06-12", "hard")).not.toEqual(
      generateDailyBoard("2026-06-11", "hard"),
    );
    for (const l of levels)
      expect(hasUniqueSolution(generateDailyBoard("2026-06-11", l))).toBe(true);
    // Pinned like Medium's: a grader or generator change mustn't reshuffle a day's Dailies (and
    // their leaderboards) for players mid-day.
    expect(Object.fromEntries(levels.map((l, i) => [l, boards[i]]))).toMatchInlineSnapshot(`
      {
        "beginner": "100654708007010450480002130000000020300825640706400000098043071240506089503901260",
        "easy": "804000002210749600000082710060000280340205900000000005009508007700460000425190863",
        "expert": "000590600080000050000810090900000001070030000820907000058060700000000420400000306",
        "hard": "870003490006000100050000700080005900700000000065102000030040800400507600600000003",
        "master": "470000090050010040000020000500009070013004080000050600000000700091030000000508009",
        "medium": "109500000260310974080026053076002000851073269023000500090001000300200690000000030",
      }
    `);
  });

  it("Medium keeps the original key; the other levels add theirs", () => {
    expect(dailyKey("2026-06-11")).toBe("sudoku_v1_daily_2026-06-11");
    expect(dailyKey("2026-06-11", "medium")).toBe("sudoku_v1_daily_2026-06-11");
    expect(dailyKey("2026-06-11", "hard")).toBe("sudoku_v1_daily_hard_2026-06-11");
    expect(parseDailyKey("sudoku_v1_daily_2026-06-11")).toEqual({
      level: "medium",
      date: "2026-06-11",
    });
    expect(parseDailyKey("sudoku_v1_daily_master_2026-06-11")).toEqual({
      level: "master",
      date: "2026-06-11",
    });
    expect(parseDailyKey("sudoku_v1_daily_medium_2026-06-11")).toBeNull();
    expect(parseDailyKey("sudoku_v1_save_daily")).toBeNull();
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

  it("fastestDaily counts only the level asked for", () => {
    const keys = ["sudoku_v1_daily_2026-06-01", "sudoku_v1_daily_hard_2026-06-01"];
    const read = (_d: string, level: string) => ({
      completed: true,
      time: level === "hard" ? 600 : 300,
      mistakes: 0,
    });
    expect(fastestDaily(keys, read)).toBe(300);
    expect(fastestDaily(keys, read, "hard")).toBe(600);
    expect(fastestDaily(keys, read, "easy")).toBe(0);
  });

  it("the streak counts a day when any Daily was done, and is unchanged for Medium-only play", () => {
    const done = new Set([
      "sudoku_v1_daily_2026-06-01",
      "sudoku_v1_daily_2026-06-02",
      "sudoku_v1_daily_hard_2026-06-03",
      "sudoku_v1_daily_easy_2026-06-04",
      "sudoku_v1_daily_2026-06-04",
    ]);
    const read = (d: string, level: Difficulty) =>
      done.has(dailyKey(d, level)) ? { completed: true, time: 1, mistakes: 0 } : null;
    const keys = [...done, "sudoku_v1_score"];
    const mediumOnly = keys.filter((k) => parseDailyKey(k)?.level === "medium");
    expect(streakState(completedDays(mediumOnly, read), "2026-06-04")).toEqual(
      streakState(["2026-06-01", "2026-06-02", "2026-06-04"], "2026-06-04"),
    );
    expect(streakState(completedDays(keys, read), "2026-06-04").current).toBe(4);
  });

  it("fastestDaily is 0 with no completed Daily", () => {
    expect(fastestDaily(["sudoku_v1_score"], () => null)).toBe(0);
    expect(fastestDaily([], () => null)).toBe(0);
  });
});
