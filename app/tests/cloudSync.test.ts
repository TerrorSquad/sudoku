import { describe, it, expect } from "vitest";

import {
  cloudData,
  decide,
  hashData,
  mergedBests,
  mergedRecords,
  readCloud,
  withLocalOnly,
  type CloudFile,
} from "../utils/cloudSync";

const score = (total: number) => JSON.stringify({ total });
const file = (data: Record<string, string>, updatedAt: number): CloudFile => ({
  app: "sudoku-pro",
  version: 1,
  exportedAt: "2026-10-27T00:00:00.000Z",
  data,
  updatedAt,
});
const synced = (data: Record<string, string>, at: number) => ({
  syncedAt: at,
  syncedHash: hashData(data),
});

const A = { sudoku_v1_score: score(100) };
const B = { sudoku_v1_score: score(250) };

describe("hashData", () => {
  it("ignores key order and sees any value change", () => {
    expect(hashData({ a: "1", b: "2" })).toBe(hashData({ b: "2", a: "1" }));
    expect(hashData({ a: "1" })).not.toBe(hashData({ a: "2" }));
  });
});

describe("readCloud", () => {
  it("accepts a valid export with updatedAt", () => {
    expect(readCloud(JSON.stringify(file(A, 5)))).toEqual({ kind: "ok", file: file(A, 5) });
  });

  it("treats garbage, an empty export or a missing updatedAt as corrupt", () => {
    expect(readCloud("{not json").kind).toBe("corrupt");
    expect(readCloud(JSON.stringify(file({}, 5))).kind).toBe("corrupt");
    const { updatedAt: _, ...noTime } = file(A, 5);
    expect(readCloud(JSON.stringify(noTime)).kind).toBe("corrupt");
  });

  it("recognises a file from a later version", () => {
    expect(readCloud(JSON.stringify({ ...file(A, 5), version: 2 })).kind).toBe("newer");
  });

  it("holds a v1 file whose only unknown entries are preferences from a later version", () => {
    const newPref = { ...A, sudoku_v1_pref_ui_scale: "3", sudoku_v1_pref_future: '"x"' };
    expect(readCloud(JSON.stringify(file(newPref, 5))).kind).toBe("newer");
    // A broken score or a non-JSON value is still corruption, not a newer version.
    const broken = { ...newPref, sudoku_v1_score: "5" };
    expect(readCloud(JSON.stringify(file(broken, 5))).kind).toBe("corrupt");
    expect(readCloud(JSON.stringify(file({ ...A, sudoku_v1_pref_x: "{" }, 5))).kind).toBe(
      "corrupt",
    );
  });
});

describe("decide", () => {
  it("restores the cloud on a fresh device", () => {
    expect(decide({}, { kind: "ok", file: file(A, 5) }, null)).toEqual({
      action: "restore",
      file: file(A, 5),
    });
  });

  it("uploads local data when the cloud is missing or corrupt, but never empty data", () => {
    expect(decide(A, { kind: "missing" }, null)).toEqual({ action: "upload" });
    expect(decide(A, { kind: "corrupt" }, synced(A, 5))).toEqual({ action: "upload" });
    expect(decide({}, { kind: "missing" }, null)).toEqual({ action: "none" });
    expect(decide({}, { kind: "corrupt" }, null)).toEqual({ action: "none" });
  });

  it("leaves a later version's file alone", () => {
    expect(decide(A, { kind: "newer" }, null)).toEqual({ action: "hold" });
  });

  it("only records the sync when both sides already match", () => {
    expect(decide(A, { kind: "ok", file: file(A, 9) }, null)).toEqual({
      action: "in-sync",
      file: file(A, 9),
    });
  });

  it("uploads local changes made since the last sync", () => {
    expect(decide(B, { kind: "ok", file: file(A, 5) }, synced(A, 5))).toEqual({ action: "upload" });
  });

  it("restores cloud changes made elsewhere since the last sync", () => {
    expect(decide(A, { kind: "ok", file: file(B, 7) }, synced(A, 5))).toEqual({
      action: "restore",
      file: file(B, 7),
    });
  });

  it("judges cloud changes by the cloud's own timestamp, not by which clock is ahead", () => {
    // Another device with a slow clock uploaded "earlier" than our last sync: still a change.
    expect(decide(A, { kind: "ok", file: file(B, 3) }, synced(A, 5)).action).toBe("restore");
  });

  it("does nothing when local data was cleared after the last sync", () => {
    expect(decide({}, { kind: "ok", file: file(A, 5) }, synced(A, 5))).toEqual({ action: "none" });
  });

  it("in a conflict keeps the side with the higher lifetime score; a tie goes to the cloud", () => {
    const meta = synced({ sudoku_v1_score: score(50) }, 5);
    expect(decide(B, { kind: "ok", file: file(A, 7) }, meta)).toEqual({
      action: "upload",
      replaced: file(A, 7),
    });
    expect(decide(A, { kind: "ok", file: file(B, 7) }, meta).action).toBe("restore");
    const sameScore = { ...A, sudoku_v1_pref_sound: "true" };
    expect(decide(sameScore, { kind: "ok", file: file(A, 7) }, meta).action).toBe("restore");
  });

  it("treats a device that never synced, with its own progress, as a conflict", () => {
    expect(decide(B, { kind: "ok", file: file(A, 7) }, null)).toEqual({
      action: "upload",
      replaced: file(A, 7),
    });
  });
});

describe("the Daily's save and the display size stay on the device", () => {
  const daily = { sudoku_v1_save_daily: "{}", sudoku_v1_pref_ui_scale: "1.5" };

  it("is left out of what syncs (v1.2.0 would call the whole file corrupt)", () => {
    expect(cloudData({ ...A, ...daily })).toEqual(A);
  });

  it("survives restoring a cloud copy", () => {
    expect(withLocalOnly(file(B, 5), { ...A, ...daily }).data).toEqual({ ...B, ...daily });
  });
});

describe("personal records on restore", () => {
  const rec = (r: object) => JSON.stringify(r);

  it("keeps a better local best and takes the cloud's running counts", () => {
    const local = { ...A, sudoku_v1_records: rec({ mostInDay: 6, cleanRun: 1, bestCleanRun: 2 }) };
    const cloud = { ...B, sudoku_v1_records: rec({ mostInDay: 2, cleanRun: 4, bestCleanRun: 4 }) };
    const restored = JSON.parse(withLocalOnly(file(cloud, 5), local).data.sudoku_v1_records!);
    expect(restored).toMatchObject({ mostInDay: 6, cleanRun: 4, bestCleanRun: 4 });
  });

  it("keeps the cloud's better best when a conflict uploads local", () => {
    const local = { sudoku_v1_records: rec({ day: "d2", dayWins: 1, mostInDay: 2, cleanRun: 1 }) };
    const cloud = { sudoku_v1_records: rec({ mostInDay: 7, bestCleanRun: 9, cleanRun: 9 }) };
    expect(mergedRecords(local, cloud)).toMatchObject({
      day: "d2",
      dayWins: 1,
      mostInDay: 7,
      cleanRun: 1,
      bestCleanRun: 9,
    });
  });

  it("max-merges lesson stars both ways: on restore and when a conflict uploads", () => {
    const local = { ...A, sudoku_v1_lesson_stars: rec({ "x-wing": 3, pointing: 1 }) };
    const cloud = { ...B, sudoku_v1_lesson_stars: rec({ pointing: 2, "xy-wing": 1 }) };
    const best = { "x-wing": 3, pointing: 2, "xy-wing": 1 };
    expect(JSON.parse(withLocalOnly(file(cloud, 5), local).data.sudoku_v1_lesson_stars!)).toEqual(
      best,
    );
    expect(JSON.parse(mergedBests(local, cloud).sudoku_v1_lesson_stars!)).toEqual(best);
    // Nothing to bring in from a copy without stars.
    expect(mergedBests(local, B)).toEqual({});
  });

  it("keeps local records the cloud copy doesn't have yet", () => {
    const local = { ...A, sudoku_v1_records: rec({ mostInDay: 3, hardestNoHint: "hard" }) };
    const restored = JSON.parse(withLocalOnly(file(B, 5), local).data.sudoku_v1_records!);
    expect(restored).toMatchObject({ mostInDay: 3, hardestNoHint: "hard" });
  });
});
