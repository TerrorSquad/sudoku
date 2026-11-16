import { describe, it, expect } from "vitest";

import {
  ACADEMY_TECHNIQUES,
  BUILDS_ON,
  MAP_COLUMN,
  RARE_IN_PUZZLES,
  WEEKLY_TECHNIQUES,
  completesChallenge,
  lockOf,
  lockedLevels,
  mergeStars,
  nextChallenge,
  nextLesson,
  readStars,
  lessonStarsFor,
  weekOf,
  withZenWins,
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

  it("treats a best score with no recorded wins (pre-wins saves) as a beaten level", () => {
    const legacy = { expert: { wins: 0, best: 900 } };
    expect(lockOf("expert", legacy)).toBeNull();
    expect(lockOf("hard", legacy)).toBeNull();
    expect(lockOf("master", legacy)).toEqual({ at: "expert", have: 1, need: 2 });
  });

  it("lists what is locked, counting saves as open", () => {
    expect(lockedLevels({}, () => false)).toEqual(["hard", "expert", "master"]);
    expect(lockedLevels({}, (d) => d === "expert")).toEqual(["hard", "master"]);
  });

  it("adds Zen wins, which score nothing, and ignores malformed Zen data", () => {
    const merged = withZenWins(w({ medium: 1 }), { medium: 1, hard: 2 });
    expect(merged.medium?.wins).toBe(2);
    expect(lockOf("hard", merged)).toBeNull();
    expect(lockOf("expert", merged)).toBeNull();
    expect(withZenWins(w({ medium: 1 }), "junk")).toEqual(w({ medium: 1 }));
    expect(withZenWins({}, { hard: "2", easy: -1 })).toEqual({});
  });
});

describe("technique path", () => {
  it("walks the Academy order", () => {
    expect(ACADEMY_TECHNIQUES).toHaveLength(24);
    expect(nextChallenge([])).toBe("naked-single");
    expect(nextChallenge(["naked-single"])).toBe("hidden-single");
    expect(nextChallenge(ACADEMY_TECHNIQUES.map((t) => t.id))).toBeNull();
  });

  it("a lesson completes only the current challenge", () => {
    expect(completesChallenge("naked-single", [])).toBe(true);
    expect(completesChallenge("hidden-single", [])).toBe(false);
    expect(completesChallenge("hidden-single", ["naked-single"])).toBe(true);
    expect(completesChallenge("naked-single", ["naked-single"])).toBe(false);
  });
});

describe("lesson flow", () => {
  const all = ACADEMY_TECHNIQUES.map((t) => t.id);

  it("leads to the path's next step after the step itself, else the next in order", () => {
    expect(nextLesson("naked-single", ["naked-single"], true)).toBe("hidden-single");
    // A lesson off the path (ahead of it, or done before): the next technique in order.
    expect(nextLesson("pointing", ["naked-single"], false)).toBe("box-line");
    expect(nextLesson("x-wing", ["naked-single"], false)).toBe("swordfish");
    expect(nextLesson("hidden-single", ["naked-single", "hidden-single"], true)).toBe("pointing");
    expect(nextLesson("xy-chain", all, true)).toBeNull();
    expect(nextLesson("xy-chain", [], false)).toBeNull();
  });

  it("gives 3 stars for no slips, 2 for one, else 1", () => {
    expect([0, 1, 2, 7].map(lessonStarsFor)).toEqual([3, 2, 1, 1]);
  });

  it("reads only known techniques with 1–3 stars, and merges to each one's best", () => {
    expect(readStars({ "x-wing": 2, bogus: 3, pointing: 4, xyz: "3" })).toEqual({ "x-wing": 2 });
    expect(readStars(null)).toEqual({});
    expect(readStars([1, 2])).toEqual({});
    expect(mergeStars({ "x-wing": 2, pointing: 3 }, { "x-wing": 3, pointing: 1 })).toEqual({
      "x-wing": 3,
      pointing: 3,
    });
    // A later version's entries pass through (numbers only), so syncing here never strips them.
    expect(
      mergeStars({ "new-technique": 2, odd: "x" }, { "new-technique": 4, pointing: 1 }),
    ).toEqual({ "new-technique": 4, pointing: 1 });
  });
});

describe("technique of the week", () => {
  const key = (y: number, m: number, d: number) => weekOf(new Date(y, m, d)).key;

  it("keys ISO weeks, Monday-first, with the ISO year at the edges", () => {
    expect(key(2026, 10, 14)).toBe("2026-W46"); // Saturday
    expect(key(2026, 10, 9)).toBe("2026-W46"); // Monday
    expect(key(2026, 10, 8)).toBe("2026-W45"); // Sunday
    expect(key(2027, 0, 1)).toBe("2026-W53");
    expect(key(2024, 11, 30)).toBe("2025-W01");
  });

  it("pins one week's technique and seed, so a rotation change shows up here", () => {
    expect(weekOf(new Date(2026, 10, 14))).toEqual({
      key: "2026-W46",
      technique: "naked-triple",
      seed: "2026-W46:naked-triple",
    });
  });

  it("is the same all week and rotates through every searchable technique", () => {
    expect(weekOf(new Date(2026, 10, 9))).toEqual(weekOf(new Date(2026, 10, 15)));
    const seen = new Set<string>();
    for (let i = 0; i < WEEKLY_TECHNIQUES.length; i++)
      seen.add(weekOf(new Date(2026, 0, 5 + 7 * i)).technique);
    expect(seen.size).toBe(WEEKLY_TECHNIQUES.length);
    expect(WEEKLY_TECHNIQUES.some((id) => RARE_IN_PUZZLES.has(id))).toBe(false);
    expect([...RARE_IN_PUZZLES].toSorted()).toEqual([
      "hidden-quad",
      "jellyfish",
      "naked-quad",
      "simple-coloring",
    ]);
  });
});

describe("BUILDS_ON (the technique map)", () => {
  const ids = ACADEMY_TECHNIQUES.map((t) => t.id);
  it("links every technique but the first to earlier Academy techniques", () => {
    for (const id of ids.slice(1)) expect(BUILDS_ON[id]?.length).toBeGreaterThan(0);
    for (const [id, pre] of Object.entries(BUILDS_ON)) {
      expect(ids).toContain(id);
      // Always earlier on the path: so the graph is acyclic and its lines never point back.
      for (const p of pre) expect(ids.indexOf(p)).toBeLessThan(ids.indexOf(id as never));
    }
  });

  it("places every technique in its own map cell", () => {
    const cells = ACADEMY_TECHNIQUES.map((t) => `${t.tier}:${MAP_COLUMN[t.id]}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});
