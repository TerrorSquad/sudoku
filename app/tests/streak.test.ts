import { describe, expect, it } from "vitest";

import { streakState } from "../utils/streak";

// `n` consecutive days from `start`, as YYYY-MM-DD.
function run(start: string, n: number): string[] {
  const d = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(d.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

describe("streakState", () => {
  it("is empty with no Dailies", () => {
    expect(streakState([], "2026-11-15")).toEqual({
      current: 0,
      longest: 0,
      freezes: 0,
      frozen: [],
    });
  });

  it("an unplayed today doesn't break the streak", () => {
    expect(streakState(run("2026-11-12", 3), "2026-11-15").current).toBe(3);
  });

  it("without a freeze, a missed day ends the streak", () => {
    const s = streakState(run("2026-11-10", 3), "2026-11-15"); // 10–12, missed 13 and 14
    expect(s.current).toBe(0);
    expect(s.longest).toBe(3);
  });

  it("seven Dailies earn a freeze, which covers one missed day", () => {
    const days = [...run("2026-11-01", 7), ...run("2026-11-09", 6)]; // missed the 8th
    const s = streakState(days, "2026-11-15");
    expect(s.frozen).toEqual(["2026-11-08"]);
    expect(s.current).toBe(13);
    expect(s.longest).toBe(13);
    expect(s.freezes).toBe(0);
  });

  it("holds at most two freezes, and a long gap spends them and then breaks", () => {
    const s = streakState(run("2026-10-01", 28), "2026-11-15"); // 4 earned, 2 kept
    expect(s.frozen).toEqual(["2026-10-29", "2026-10-30"]);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(28);
  });

  it("ignores dates after today and malformed keys", () => {
    const s = streakState(["2026-11-14", "2026-11-20", "garbage"], "2026-11-15");
    expect(s.current).toBe(1);
  });
});

describe("streakState longest", () => {
  it("counts across a month end, unsorted, with duplicates and junk", () => {
    const s = streakState(
      [
        "2026-03-30",
        "2026-03-28",
        "2026-03-29",
        "2026-03-31",
        "2026-04-01",
        "2026-03-29",
        "nope",
        "2026-02-01",
        "2026-02-02",
      ],
      "2026-04-01",
    );
    expect(s.longest).toBe(5);
    expect(s.current).toBe(5);
  });
});
