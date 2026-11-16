import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateDailyBoard, useDailyPuzzle } from "../composables/useDailyPuzzle";
import { useRecords } from "../composables/useRecords";
import { useScore } from "../composables/useScore";
import { useWinResult, type WinGame } from "../composables/useWinResult";
import { readJSON } from "../utils/safeJson";

// The key and its params, so a test can see which line a note is.
const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key} ${JSON.stringify(named)}` : key;

const game = (over: Partial<WinGame> = {}): WinGame => ({
  difficulty: "easy",
  daily: false,
  dailyDate: "",
  zen: false,
  practice: null,
  week: null,
  seconds: 300,
  mistakes: 0,
  hints: 0,
  colorMode: false,
  challengeTarget: 0,
  initialBoard: generateDailyBoard("2026-11-16"),
  placements: [],
  lockedBefore: [],
  ...over,
});

describe("useWinResult: recording a win", () => {
  beforeEach(() => {
    // Methods non-enumerable, so Object.keys(localStorage) lists only the stored keys (the Daily
    // history reads it).
    const store: Record<string, string> = {};
    Object.defineProperties(store, {
      getItem: { value: (k: string) => store[k] ?? null },
      setItem: { value: (k: string, v: string) => (store[k] = String(v)) },
      removeItem: { value: (k: string) => delete store[k] },
    });
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", store);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a scored win records the score, the records and the achievements", () => {
    const { result, toasts, unlock } = useWinResult(t).recordWin(game());
    expect(result.score?.total).toBeGreaterThan(0);
    expect(result.lifetimeTotal).toBe(result.score?.total);
    expect(result.isNewBest).toBe(true);
    expect(useScore().getStats().gamesWon).toBe(1);
    expect(useRecords().get().dayWins).toBe(1);
    expect(toasts).toContain("first-win");
    expect(unlock).toBe(true);
  });

  it("a Zen win records only the Zen win and the levels it opens", () => {
    const { recordWin } = useWinResult(t);
    recordWin(game({ difficulty: "medium", zen: true }));
    const { result, toasts, opened, unlock } = recordWin(
      game({ difficulty: "medium", zen: true, lockedBefore: ["hard", "expert"] }),
    );
    expect(result.score).toBeNull();
    expect(toasts).toEqual([]);
    expect(useScore().getStats().gamesWon).toBe(0);
    expect(readJSON("sudoku_v1_achievements", {})).toEqual({});
    // Two Medium wins open Hard; Expert stays locked.
    expect(opened).toBe("hard");
    expect(result.notes).toEqual([
      { text: `difficulty.unlocked ${JSON.stringify({ level: "difficulty.hard" })}`, ok: true },
    ]);
    expect(unlock).toBe(true);
  });

  it("a practice win scores nothing and marks the technique of the week", () => {
    const { result, toasts, unlock } = useWinResult(t).recordWin(
      game({ practice: "naked-single", week: "2026-W47" }),
    );
    expect(result.score).toBeNull();
    expect(result.neededTechs[0]).toBe("naked-single"); // what was practised leads
    expect(result.notes.map((n) => n.ok)).toEqual([true]);
    expect(result.notes[0]!.text).toMatch(/^weekly\.won/);
    expect(toasts).toEqual([]);
    expect(unlock).toBe(true);
    expect(useScore().getStats().gamesWon).toBe(0);
    expect(useRecords().get().dayWins).toBe(0); // practice never counts for records
  });

  it("a Daily win marks its day and scores on the Daily's own row", () => {
    const { toasts } = useWinResult(t).recordWin(
      game({ difficulty: "medium", daily: true, dailyDate: "2026-11-16", seconds: 420 }),
    );
    expect(useDailyPuzzle().getRecordFor("2026-11-16")).toEqual({
      completed: true,
      time: 420,
      mistakes: 0,
    });
    expect(useScore().getStats().perDifficulty.daily?.bestTime).toBe(420);
    expect(toasts).toContain("daily-first");
  });

  it("a custom board against a friend's time gets the challenge note, and no records", () => {
    const { result } = useWinResult(t).recordWin(
      game({ difficulty: "custom", challengeTarget: 100, seconds: 90 }),
    );
    expect(result.notes[0]).toEqual({
      text: `challenge.won ${JSON.stringify({ time: "00:10" })}`,
      ok: true,
    });
    expect(useRecords().get().dayWins).toBe(0);
  });
});
