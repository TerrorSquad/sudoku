import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { statsKey, useScore, winsAt } from "../composables/useScore";

describe("useScore: the Daily keeps its own row", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a Daily win never touches Medium's best time or score", () => {
    const score = useScore();
    score.record(statsKey("medium", false), 500, 600);
    const daily = score.record(statsKey("medium", true), 900, 300);

    expect(daily.isNewBest).toBe(true); // measured against earlier Dailies, not Medium
    const { perDifficulty, total, gamesWon } = score.getStats();
    expect(perDifficulty.medium).toEqual({ best: 500, wins: 1, bestTime: 600 });
    expect(perDifficulty.daily).toEqual({ best: 900, wins: 1, bestTime: 300 });
    // Both still count toward the lifetime totals.
    expect(total).toBe(1400);
    expect(gamesWon).toBe(2);
    // ...and a Daily still counts as a Medium win toward opening Hard.
    expect(score.unlockWins().medium?.wins).toBe(2);
    // A Hard Daily: its own row, a Hard win toward opening Expert.
    score.record(statsKey("hard", true), 700, 500);
    expect(score.getStats().perDifficulty.hard).toBeUndefined();
    expect(score.unlockWins().hard?.wins).toBe(1);
  });
});

describe("winsAt (Specialist and unlocks count games, not rows)", () => {
  const per = { medium: { wins: 6 }, daily: { wins: 4 }, hard: { wins: 3 } };

  it("counts Medium and Daily wins together, from either side", () => {
    expect(winsAt(per, "medium")).toBe(10);
    expect(winsAt(per, "daily")).toBe(10);
  });

  it("counts any other level on its own", () => {
    expect(winsAt(per, "hard")).toBe(3);
    expect(winsAt(per, "expert")).toBe(0);
  });

  it("counts every level's Daily with its level", () => {
    const withHard = { ...per, daily_hard: { wins: 2 } };
    expect(winsAt(withHard, "hard")).toBe(5);
    expect(winsAt(withHard, "daily_hard")).toBe(5);
    expect(winsAt(withHard, "medium")).toBe(10);
  });
});

describe("statsKey", () => {
  it("names Medium's Daily row daily and the other levels' daily_<level>", () => {
    expect(statsKey("medium", true)).toBe("daily");
    expect(statsKey("hard", true)).toBe("daily_hard");
    expect(statsKey("hard", false)).toBe("hard");
  });
});
