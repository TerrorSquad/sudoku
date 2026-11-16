import { describe, it, expect } from "vitest";

import {
  breakCleanRun,
  addWin,
  brokenRecords,
  mergeRecords,
  readRecords,
  type Snapshot,
} from "../utils/records";

const win = (over: Partial<Parameters<typeof addWin>[1]> = {}) => ({
  day: "2026-11-15",
  difficulty: "medium" as const,
  mistakes: 0,
  hints: 0,
  ...over,
});

const NO_RECORDS = readRecords(null);

describe("readRecords", () => {
  it("reads nothing or garbage as no records", () => {
    expect(NO_RECORDS).toEqual({
      day: "",
      dayWins: 0,
      mostInDay: 0,
      cleanRun: 0,
      bestCleanRun: 0,
      hardestNoHint: null,
    });
    expect(readRecords("x")).toEqual(NO_RECORDS);
    expect(readRecords({ mostInDay: -3, bestCleanRun: 1.5, hardestNoHint: "custom" })).toEqual(
      NO_RECORDS,
    );
  });
  it("keeps valid fields", () => {
    const r = { ...NO_RECORDS, day: "2026-11-15", dayWins: 2, mostInDay: 4 };
    expect(readRecords(r)).toEqual(r);
  });
});

describe("addWin", () => {
  it("counts wins per day and keeps the most", () => {
    let r = addWin(NO_RECORDS, win());
    r = addWin(r, win());
    r = addWin(r, win());
    expect(r).toMatchObject({ dayWins: 3, mostInDay: 3 });
    r = addWin(r, win({ day: "2026-11-16" }));
    expect(r).toMatchObject({ day: "2026-11-16", dayWins: 1, mostInDay: 3 });
  });
  it("runs clean wins until a mistaken win or a mistake in a game", () => {
    let r = addWin(addWin(NO_RECORDS, win()), win({ hints: 4 })); // hints don't break it
    expect(r).toMatchObject({ cleanRun: 2, bestCleanRun: 2 });
    r = addWin(r, win({ mistakes: 1 }));
    expect(r).toMatchObject({ cleanRun: 0, bestCleanRun: 2 });
    r = breakCleanRun(addWin(r, win()));
    expect(r).toMatchObject({ cleanRun: 0, bestCleanRun: 2 });
  });
  it("keeps the hardest level won without a hint", () => {
    let r = addWin(NO_RECORDS, win({ difficulty: "hard" }));
    r = addWin(r, win({ difficulty: "easy" }));
    r = addWin(r, win({ difficulty: "master", hints: 1 }));
    r = addWin(r, win({ difficulty: "custom" }));
    expect(r.hardestNoHint).toBe("hard");
  });
});

describe("mergeRecords", () => {
  it("keeps the better best from either side, the running counts from incoming", () => {
    const local = {
      ...NO_RECORDS,
      mostInDay: 5,
      bestCleanRun: 1,
      hardestNoHint: "expert" as const,
    };
    const cloud = { ...NO_RECORDS, day: "d", dayWins: 1, cleanRun: 3, bestCleanRun: 3 };
    expect(mergeRecords(local, cloud)).toEqual({
      day: "d",
      dayWins: 1,
      mostInDay: 5,
      cleanRun: 3,
      bestCleanRun: 3,
      hardestNoHint: "expert",
    });
  });
});

describe("brokenRecords", () => {
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
    ...NO_RECORDS,
    fastest: 0,
    streak: 0,
    ...over,
  });
  it("reports only records beaten, not first ones", () => {
    expect(
      brokenRecords(snap(), snap({ fastest: 300, mostInDay: 1, hardestNoHint: "easy" })),
    ).toEqual([]);
    expect(brokenRecords(snap({ fastest: 300 }), snap({ fastest: 300 }))).toEqual([]);
  });
  it("lists what was beaten, most notable first", () => {
    const before = snap({
      fastest: 460,
      hardestNoHint: "medium",
      streak: 3,
      bestCleanRun: 2,
      mostInDay: 2,
    });
    const after = snap({
      fastest: 372,
      hardestNoHint: "hard",
      streak: 4,
      bestCleanRun: 3,
      mostInDay: 3,
    });
    expect(brokenRecords(before, after)).toEqual([
      { kind: "fastest", value: 372, was: 460 },
      { kind: "noHint", value: "hard", was: "medium" },
      { kind: "streak", value: 4, was: 3 },
      { kind: "cleanRun", value: 3, was: 2 },
      { kind: "mostInDay", value: 3, was: 2 },
    ]);
  });
});
