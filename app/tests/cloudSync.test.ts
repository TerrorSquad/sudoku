import { describe, it, expect } from "vitest";

import { decide, hashData, readCloud, type CloudFile } from "../utils/cloudSync";

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
