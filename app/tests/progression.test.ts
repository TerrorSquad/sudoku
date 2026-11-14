import { describe, it, expect } from "vitest";

import {
  ACADEMY_TECHNIQUES,
  DRILL_COUNTS,
  WEEKLY_TECHNIQUES,
  completesChallenge,
  isoWeekKey,
  lockOf,
  levelsOpenedBy,
  nextChallenge,
  techniqueOfWeek,
} from "../utils/progression";

const w = (wins: Record<string, number>) =>
  Object.fromEntries(Object.entries(wins).map(([d, n]) => [d, { wins: n }]));

describe("difficulty unlocks", () => {
  it("opens Beginner to Medium and custom on a fresh profile, and nothing harder", () => {
    for (const d of ["beginner", "easy", "medium", "custom"] as const)
      expect(lockOf(d, {})).toBeNull();
    expect(lockOf("hard", {})).toEqual({ at: "medium", have: 0, need: 2 });
    expect(lockOf("expert", {})).toEqual({ at: "hard", have: 0, need: 2 });
    expect(lockOf("master", {})).toEqual({ at: "expert", have: 0, need: 2 });
  });

  it("opens the next level after two wins at the level below", () => {
    expect(lockOf("hard", w({ medium: 1 }))).toEqual({ at: "medium", have: 1, need: 2 });
    expect(lockOf("hard", w({ medium: 2 }))).toBeNull();
    expect(lockOf("expert", w({ medium: 9 }))).toEqual({ at: "hard", have: 0, need: 2 });
  });

  it("counts wins at harder levels too, and keeps every beaten level open", () => {
    // One Expert win: Hard and Expert stay open; Master still needs a second.
    const one = w({ expert: 1 });
    expect(lockOf("hard", one)).toBeNull();
    expect(lockOf("expert", one)).toBeNull();
    expect(lockOf("master", one)).toEqual({ at: "expert", have: 1, need: 2 });
    expect(lockOf("hard", w({ medium: 1, master: 1 }))).toBeNull();
  });

  it("keeps a level with a game in progress open", () => {
    expect(lockOf("master", {}, true)).toBeNull();
  });

  it("reports what a win just opened", () => {
    expect(levelsOpenedBy(w({ medium: 1 }), w({ medium: 2 }))).toEqual(["hard"]);
    expect(levelsOpenedBy(w({ medium: 2 }), w({ medium: 3 }))).toEqual([]);
    expect(levelsOpenedBy(w({ hard: 1 }), w({ hard: 2 }))).toEqual(["expert"]);
  });
});

describe("technique path", () => {
  it("walks the Academy order", () => {
    expect(ACADEMY_TECHNIQUES).toHaveLength(22);
    expect(nextChallenge([])).toBe("naked-single");
    expect(nextChallenge(["naked-single"])).toBe("hidden-single");
    expect(nextChallenge(ACADEMY_TECHNIQUES.map((t) => t.id))).toBeNull();
  });

  it("completes only the current challenge, and a drill only where the search can't find puzzles", () => {
    expect(completesChallenge("naked-single", "puzzle", [])).toBe(true);
    expect(completesChallenge("hidden-single", "puzzle", [])).toBe(false);
    expect(completesChallenge("naked-single", "drill", [])).toBe(false);
    const upToQuads = ACADEMY_TECHNIQUES.slice(0, 9).map((t) => t.id);
    expect(nextChallenge(upToQuads.slice(0, 8))).toBe("naked-quad");
    expect(completesChallenge("naked-quad", "drill", upToQuads.slice(0, 8))).toBe(true);
    expect([...DRILL_COUNTS].toSorted()).toEqual(["hidden-quad", "jellyfish", "naked-quad"]);
  });
});

describe("technique of the week", () => {
  it("keys ISO weeks, Monday-first, with the ISO year at the edges", () => {
    expect(isoWeekKey(new Date(2026, 10, 14))).toBe("2026-W46"); // Saturday
    expect(isoWeekKey(new Date(2026, 10, 9))).toBe("2026-W46"); // Monday
    expect(isoWeekKey(new Date(2026, 10, 8))).toBe("2026-W45"); // Sunday
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe("2026-W53");
    expect(isoWeekKey(new Date(2024, 11, 30))).toBe("2025-W01");
  });

  it("is the same all week and rotates through every searchable technique", () => {
    expect(techniqueOfWeek(new Date(2026, 10, 9))).toBe(techniqueOfWeek(new Date(2026, 10, 15)));
    const seen = new Set<string>();
    for (let i = 0; i < WEEKLY_TECHNIQUES.length; i++)
      seen.add(techniqueOfWeek(new Date(2026, 0, 5 + 7 * i)));
    expect(seen.size).toBe(WEEKLY_TECHNIQUES.length);
    expect(WEEKLY_TECHNIQUES.some((id) => DRILL_COUNTS.has(id))).toBe(false);
  });
});
