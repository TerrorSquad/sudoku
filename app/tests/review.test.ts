import { describe, expect, it } from "vitest";

import {
  addDays,
  dueToday,
  lessonCard,
  mergeReview,
  nextReviewDay,
  readReview,
  reviewCard,
  reviewPassed,
  withLearned,
} from "../utils/review";

describe("addDays", () => {
  it("crosses month and year ends, and DST weekends, by whole days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29"); // EU clocks go forward on the 29th
    expect(addDays("2026-10-24", 7)).toBe("2026-10-31"); // and back on the 25th
    expect(addDays("2026-11-15", 30)).toBe("2026-12-15");
  });
});

describe("schedule transitions", () => {
  const today = "2026-11-15";
  it("a finished lesson starts in box 1, due tomorrow, and never resets a scheduled card", () => {
    expect(lessonCard(undefined, today)).toEqual({ box: 1, next: "2026-11-16" });
    const card = { box: 3, next: "2026-11-20" };
    expect(lessonCard(card, today)).toBe(card);
  });

  it("a pass moves up a box (to 5 at most), a miss drops to box 1", () => {
    expect(reviewCard({ box: 1, next: today }, true, today)).toEqual({
      box: 2,
      next: "2026-11-18",
    });
    expect(reviewCard({ box: 4, next: today }, true, today)).toEqual({
      box: 5,
      next: "2026-12-15",
    });
    expect(reviewCard({ box: 5, next: today }, true, today)).toEqual({
      box: 5,
      next: "2026-12-15",
    });
    expect(reviewCard({ box: 4, next: today }, false, today)).toEqual({
      box: 1,
      next: "2026-11-16",
    });
    expect(reviewCard(undefined, true, today)).toEqual({ box: 2, next: "2026-11-18" });
  });

  it("passing allows one wrong tap, not two, and never a skip", () => {
    expect(reviewPassed(0, false)).toBe(true);
    expect(reviewPassed(1, false)).toBe(true);
    expect(reviewPassed(2, false)).toBe(false);
    expect(reviewPassed(0, true)).toBe(false);
  });
});

describe("due", () => {
  const schedule = readReview({
    "x-wing": { box: 2, next: "2026-11-15" },
    "naked-pair": { box: 1, next: "2026-11-10" },
    "hidden-pair": { box: 3, next: "2026-11-15" },
    swordfish: { box: 1, next: "2026-11-15" },
    pointing: { box: 4, next: "2026-12-01" },
  });

  it("lists what's due, longest overdue first, then the lower box", () => {
    expect(dueToday(schedule, "2026-11-15")).toEqual([
      "naked-pair",
      "swordfish",
      "x-wing",
      "hidden-pair",
    ]);
    expect(dueToday(schedule, "2026-11-09")).toEqual([]);
  });

  it("the next review day after today, null when nothing is scheduled", () => {
    expect(nextReviewDay(schedule, "2026-11-15")).toBe("2026-12-01");
    expect(nextReviewDay({}, "2026-11-15")).toBeNull();
  });

  it("lessons finished before review existed come in as due, without overriding a card", () => {
    const s = withLearned(schedule, ["box-line", "x-wing", "no-such-technique"], "2026-11-15");
    expect(s["box-line"]).toEqual({ box: 1, next: "2026-11-15" });
    expect(s["x-wing"]).toEqual({ box: 2, next: "2026-11-15" });
    expect(Object.keys(s)).not.toContain("no-such-technique");
  });
});

describe("readReview and mergeReview", () => {
  it("reads only known techniques with well-formed cards", () => {
    expect(
      readReview({
        "x-wing": { box: 2, next: "2026-11-15" },
        "naked-pair": { box: 0, next: "2026-11-15" },
        "hidden-pair": { box: 2, next: "soon" },
        "future-technique": { box: 1, next: "2026-11-15" },
        swordfish: { box: 9, next: "2026-11-15" },
      }),
    ).toEqual({
      "x-wing": { box: 2, next: "2026-11-15" },
      swordfish: { box: 5, next: "2026-11-15" },
    });
    expect(readReview([])).toEqual({});
    expect(readReview(null)).toEqual({});
  });

  // Each card is set on its due date less its box's interval: box 1 → 1 day, 2 → 3, 3 → 7, 4 → 14.
  it("a miss after an older pass wins, though it's due sooner", () => {
    const pass = { box: 4, next: "2026-11-24" }; // passed on Nov 10 (14 days)
    const miss = { box: 1, next: "2026-11-16" }; // missed on Nov 15
    expect(mergeReview({ "x-wing": pass }, { "x-wing": miss })).toEqual({ "x-wing": miss });
    expect(mergeReview({ "x-wing": miss }, { "x-wing": pass })).toEqual({ "x-wing": miss });
  });

  it("a pass after an older miss wins", () => {
    const miss = { box: 1, next: "2026-11-11" }; // missed on Nov 10
    const pass = { box: 2, next: "2026-11-18" }; // passed on Nov 15
    expect(mergeReview({ "x-wing": miss }, { "x-wing": pass })).toEqual({ "x-wing": pass });
    expect(mergeReview({ "x-wing": pass }, { "x-wing": miss })).toEqual({ "x-wing": pass });
  });

  it("on the same day a miss beats a pass, either way round", () => {
    const pass = { box: 2, next: "2026-11-18" }; // both set on Nov 15
    const miss = { box: 1, next: "2026-11-16" };
    expect(mergeReview({ "x-wing": pass }, { "x-wing": miss })).toEqual({ "x-wing": miss });
    expect(mergeReview({ "x-wing": miss }, { "x-wing": pass })).toEqual({ "x-wing": miss });
  });

  it("keeps techniques from either side, including a later version's, and drops junk", () => {
    const merged = mergeReview(
      {
        pointing: { box: 3, next: "2026-11-20" },
        "future-technique": { box: 2, next: "2026-11-30" },
      },
      { swordfish: { box: 1, next: "2026-11-16" }, broken: { box: "two" } },
    );
    expect(merged).toEqual({
      pointing: { box: 3, next: "2026-11-20" },
      "future-technique": { box: 2, next: "2026-11-30" },
      swordfish: { box: 1, next: "2026-11-16" },
    });
    expect(mergeReview(null, "junk")).toEqual({});
  });
});
