import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { statsKey, useScore } from "../composables/useScore";

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
  });
});
