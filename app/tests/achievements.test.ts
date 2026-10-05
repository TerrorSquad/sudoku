import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import rs from "../../i18n/locales/rs.json";
import { ACHIEVEMENTS, newlyUnlocked, type WinSummary } from "../utils/achievements";

const base: WinSummary = {
  difficulty: "medium",
  timeSeconds: 900,
  mistakes: 1,
  hintsUsed: 1,
  isDaily: false,
  colorMode: false,
  hour: 15,
  gamesWon: 1,
  winsAtDifficulty: 1,
  dailyStreak: 0,
  distinctTechniques: 0,
};
const win = (o: Partial<WinSummary> = {}) => ({ ...base, ...o });
const ids = (o: Partial<WinSummary>, have: Record<string, number> = {}) =>
  newlyUnlocked(have, win(o));

describe("achievement rules", () => {
  it("has unique ids and a name + description in both locales", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const { id } of ACHIEVEMENTS) {
      for (const locale of [en, rs] as Record<string, string>[]) {
        expect(locale[`achievements.${id}.name`]).toBeTruthy();
        expect(locale[`achievements.${id}.desc`]).toBeTruthy();
      }
    }
  });

  it("a plain first win unlocks only first-win", () => {
    expect(ids({})).toEqual(["first-win"]);
  });

  it("never re-awards what is already unlocked", () => {
    expect(ids({}, { "first-win": 1 })).toEqual([]);
  });

  it("flawless / self-reliant / purist", () => {
    expect(ids({ mistakes: 0 })).toContain("flawless");
    expect(ids({ hintsUsed: 0 })).toContain("self-reliant");
    const pure = { mistakes: 0, hintsUsed: 0 };
    expect(ids({ ...pure, difficulty: "hard" })).toContain("purist");
    expect(ids({ ...pure, difficulty: "easy" })).not.toContain("purist");
  });

  it("lightning needs 60% of par and ignores custom puzzles", () => {
    // medium par is 600s
    expect(ids({ timeSeconds: 360 })).toContain("lightning");
    expect(ids({ timeSeconds: 361 })).not.toContain("lightning");
    expect(ids({ difficulty: "custom", timeSeconds: 1 })).not.toContain("lightning");
  });

  it("daily streak tiers require a daily win", () => {
    expect(ids({ isDaily: true, dailyStreak: 7 })).toEqual(
      expect.arrayContaining(["daily-first", "streak-3", "streak-7"]),
    );
    expect(ids({ isDaily: false, dailyStreak: 7 })).not.toContain("streak-3");
    expect(ids({ isDaily: true, dailyStreak: 29 })).not.toContain("streak-30");
  });

  it("milestone wins", () => {
    expect(ids({ gamesWon: 10 })).toContain("wins-10");
    expect(ids({ gamesWon: 9 })).not.toContain("wins-10");
    expect(ids({ gamesWon: 100 })).toEqual(expect.arrayContaining(["wins-50", "wins-100"]));
  });

  it("hidden ones: comeback and night owl", () => {
    expect(ids({ mistakes: 2 })).toContain("comeback");
    expect(ids({ mistakes: 3 })).not.toContain("comeback");
    expect(ids({ hour: 0 })).toContain("night-owl");
    expect(ids({ hour: 4 })).toContain("night-owl");
    expect(ids({ hour: 5 })).not.toContain("night-owl");
  });

  it("misc: colour mode, scholar, specialist, tier wins", () => {
    expect(ids({ colorMode: true })).toContain("colourful");
    expect(ids({ distinctTechniques: 5 })).toContain("scholar");
    expect(ids({ winsAtDifficulty: 10 })).toContain("specialist");
    expect(ids({ difficulty: "expert" })).toContain("expert-win");
    expect(ids({ difficulty: "master" })).toContain("master-win");
  });
});
