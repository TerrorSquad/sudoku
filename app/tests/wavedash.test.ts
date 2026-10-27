import { readFileSync, writeFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import { ACHIEVEMENTS } from "../utils/achievements";
import { flush, wavedashId } from "../utils/wavedash";

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
  return `${JSON.stringify({ achievements, stats: [] }, null, 2)}\n`;
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

  it("wavedash-achievements.json matches the rules (UPDATE_WAVEDASH=1 pnpm test wavedash to regenerate)", () => {
    if (process.env.UPDATE_WAVEDASH) writeFileSync(IMPORT_FILE, importJson());
    expect(readFileSync(IMPORT_FILE, "utf8")).toBe(importJson());
  });
});
