import { readFileSync, writeFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import { ACHIEVEMENTS } from "../utils/achievements";
import { STAT_NAMES, flush, flushStats, scoresFor, wavedashId } from "../utils/wavedash";

const IMPORT_FILE = new URL("../../wavedash-achievements.json", import.meta.url);

/** The developer portal's Achievements → Import JSON shape, built from the rules and en strings. */
function importJson() {
  const t = en as Record<string, string>;
  const achievements = ACHIEVEMENTS.map((a) => ({
    identifier: wavedashId(a.id),
    display_name: t[`achievements.${a.id}.name`],
    description: t[`achievements.${a.id}.desc`],
    secret: !!a.hidden,
    stat_requirement: null,
  }));
  const stats = Object.entries(STAT_NAMES).map(([identifier, display_name]) => ({
    identifier,
    display_name,
  }));
  return `${JSON.stringify({ achievements, stats }, null, 2)}\n`;
}

describe("wavedash", () => {
  it("maps ids to UPPER_SNAKE", () => {
    expect(wavedashId("first-win")).toBe("FIRST_WIN");
    expect(wavedashId("streak-30")).toBe("STREAK_30");
  });

  it("flush keeps rejected writes pending and skips ones already unlocked", () => {
    const set: string[] = [];
    const { left, wrote } = flush(["first-win", "wins-10", "flawless"], {
      getAchievement: (id) => id === "WINS_10",
      setAchievement: (id) => (set.push(id), id !== "FLAWLESS"),
    });
    expect(set).toEqual(["FIRST_WIN", "FLAWLESS"]);
    expect(left).toEqual(["flawless"]);
    expect(wrote).toBe(true);
  });

  it("flush reports no write when everything is rejected", () => {
    const sdk = { getAchievement: () => false, setAchievement: () => false };
    expect(flush(["first-win"], sdk)).toEqual({ left: ["first-win"], wrote: false });
  });

  it("flushStats sends only values above Wavedash's and keeps rejected ones pending", () => {
    const set: [string, number][] = [];
    const { left, wrote } = flushStats(
      new Map([
        ["GAMES_WON", 3],
        ["LEVEL", 2],
        ["LIFETIME_SCORE", 900],
        ["TECHNIQUES_LEARNED", 1],
      ]),
      {
        getStat: (id) => ({ LEVEL: 2, TECHNIQUES_LEARNED: 3 })[id] ?? 0,
        setStat: (id, value) => (set.push([id, value]), id !== "LIFETIME_SCORE"),
      },
    );
    expect(set).toEqual([
      ["GAMES_WON", 3],
      ["LIFETIME_SCORE", 900],
    ]);
    expect([...left]).toEqual([["LIFETIME_SCORE", 900]]);
    expect(wrote).toBe(true);
  });

  it("wavedash-achievements.json matches the rules (UPDATE_WAVEDASH=1 pnpm test wavedash to regenerate)", () => {
    if (process.env.UPDATE_WAVEDASH) writeFileSync(IMPORT_FILE, importJson());
    expect(readFileSync(IMPORT_FILE, "utf8")).toBe(importJson());
  });

  const win = {
    difficulty: "hard",
    seconds: 300,
    mistakes: 1,
    hints: 0,
    daily: null,
  };

  it("a regular win posts its time to its difficulty's board", () => {
    expect(scoresFor(win)).toEqual([{ board: { name: "best-time-hard" }, score: 300 }]);
  });

  it("a Daily posts its time to that day's board instead", () => {
    expect(scoresFor({ ...win, daily: "2026-10-27" })[0]!.board.name).toBe("daily-2026-10-27");
  });

  it("custom puzzles and a zero time post nothing", () => {
    expect(scoresFor({ ...win, difficulty: "custom" })).toEqual([]);
    expect(scoresFor({ ...win, seconds: 0 })).toEqual([]);
  });
});
