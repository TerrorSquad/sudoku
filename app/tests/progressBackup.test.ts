import { describe, it, expect } from "vitest";

import {
  applyBackup,
  backupFilename,
  createBackup,
  parseBackup,
  type Backup,
} from "../utils/progressBackup";

class MemoryStore {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const NOW = new Date("2026-03-04T10:00:00Z");

const wrap = (data: Record<string, string>) =>
  JSON.stringify({ app: "sudoku-pro", version: 1, exportedAt: "x", data });

function seeded() {
  const s = new MemoryStore();
  s.setItem("sudoku_v1_score", JSON.stringify({ total: 900 }));
  s.setItem("sudoku_v1_pref_sound", "false");
  s.setItem("somebody_elses_key", "secret");
  return s;
}

describe("progress backup", () => {
  it("exports only sudoku_v1_* keys", () => {
    const b = createBackup(seeded(), NOW);
    expect(Object.keys(b.data).toSorted()).toEqual(["sudoku_v1_pref_sound", "sudoku_v1_score"]);
    expect(b).toMatchObject({ app: "sudoku-pro", version: 1, exportedAt: NOW.toISOString() });
  });

  it("round-trips through text and replaces existing data, leaving other keys alone", () => {
    const text = JSON.stringify(createBackup(seeded(), NOW));
    const target = new MemoryStore();
    target.setItem("sudoku_v1_score", JSON.stringify({ total: 1 }));
    target.setItem("sudoku_v1_stale_key", "1"); // not in the backup → must be removed
    target.setItem("somebody_elses_key", "keep me");

    const parsed = parseBackup(text);
    expect(parsed).toMatchObject({ ok: true, items: 2 });
    if (!parsed.ok) return;
    expect(applyBackup(target, parsed.backup)).toBe(2);

    expect(target.getItem("sudoku_v1_score")).toBe(JSON.stringify({ total: 900 }));
    expect(target.getItem("sudoku_v1_stale_key")).toBeNull();
    expect(target.getItem("somebody_elses_key")).toBe("keep me");
  });

  it.each([
    ["not JSON", "{oops", "invalid"],
    [
      "wrong app",
      JSON.stringify({ app: "other", version: 1, exportedAt: "x", data: {} }),
      "invalid",
    ],
    [
      "future version",
      JSON.stringify({
        app: "sudoku-pro",
        version: 2,
        exportedAt: "x",
        data: { sudoku_v1_a: "1" },
      }),
      "invalid",
    ],
    [
      "foreign key",
      JSON.stringify({ app: "sudoku-pro", version: 1, exportedAt: "x", data: { evil: "1" } }),
      "invalid",
    ],
    [
      "non-JSON value",
      JSON.stringify({
        app: "sudoku-pro",
        version: 1,
        exportedAt: "x",
        data: { sudoku_v1_a: "{bad" },
      }),
      "invalid",
    ],
    [
      "non-string value",
      JSON.stringify({ app: "sudoku-pro", version: 1, exportedAt: "x", data: { sudoku_v1_a: 1 } }),
      "invalid",
    ],
    [
      "empty data",
      JSON.stringify({ app: "sudoku-pro", version: 1, exportedAt: "x", data: {} }),
      "empty",
    ],
    ["too large", "x".repeat(5_000_001), "tooLarge"],
  ])("rejects %s", (_name, text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });

  it("restores the previous data when a write fails part-way", () => {
    const store = seeded();
    const before = createBackup(store, NOW).data;
    // A store whose quota runs out on the second key written.
    let writes = 0;
    const flaky = {
      get length() {
        return store.length;
      },
      key: (i: number) => store.key(i),
      getItem: (k: string) => store.getItem(k),
      removeItem: (k: string) => store.removeItem(k),
      setItem: (k: string, v: string) => {
        if (++writes === 2) throw new Error("QuotaExceededError");
        store.setItem(k, v);
      },
    };
    const incoming: Backup = {
      app: "sudoku-pro",
      version: 1,
      exportedAt: "x",
      data: { sudoku_v1_a: "1", sudoku_v1_b: "2", sudoku_v1_c: "3" },
    };
    expect(() => applyBackup(flaky, incoming)).toThrow("QuotaExceeded");
    expect(createBackup(store, NOW).data).toEqual(before);
  });

  it("rejects entries whose shape would crash or mislead the app", () => {
    const bad = (key: string, value: unknown) =>
      parseBackup(wrap({ [key]: JSON.stringify(value) }));
    expect(bad("sudoku_v1_save_hard", {})).toEqual({ ok: false, error: "invalid" });
    expect(bad("sudoku_v1_pref_mistake_limit", 7)).toEqual({ ok: false, error: "invalid" });
    expect(bad("sudoku_v1_pref_hint_style", "x")).toEqual({ ok: false, error: "invalid" });
    expect(bad("sudoku_v1_pref_sound", "yes")).toEqual({ ok: false, error: "invalid" });
    expect(bad("sudoku_v1_score", 5)).toEqual({ ok: false, error: "invalid" });
    expect(bad("sudoku_v1_pref_mistake_limit", 5)).toMatchObject({ ok: true });
    const grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(
      bad("sudoku_v1_save_hard", {
        currentBoard: grid,
        initialBoard: grid,
        solvedBoard: grid,
        notesBoard: [],
      }),
    ).toMatchObject({ ok: true });
  });

  it("names the file by date", () => {
    expect(backupFilename(NOW)).toBe("sudoku-pro-backup-2026-03-04.json");
  });

  it("accepts a minimal valid backup", () => {
    const b: Backup = {
      app: "sudoku-pro",
      version: 1,
      exportedAt: "x",
      data: { sudoku_v1_a: "1" },
    };
    expect(parseBackup(JSON.stringify(b))).toMatchObject({ ok: true, items: 1 });
  });
});
