// Export / import of everything the game stores locally (sudoku_v1_*): scores, achievements,
// saves, Daily history and preferences. Pure over a Storage-like object; unit-tested in
// tests/progressBackup.test.ts.

export const BACKUP_PREFIX = "sudoku_v1_";
export const MAX_BACKUP_BYTES = 5_000_000;

export interface Backup {
  app: "sudoku-pro";
  version: 1;
  exportedAt: string;
  /** localStorage key → raw stored string. */
  data: Record<string, string>;
}

type Store = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

export function createBackup(store: Store, now: Date = new Date()): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(BACKUP_PREFIX)) data[key] = store.getItem(key) ?? "";
  }
  return { app: "sudoku-pro", version: 1, exportedAt: now.toISOString(), data };
}

export function backupFilename(now: Date = new Date()): string {
  return `sudoku-pro-backup-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseResult =
  | { ok: true; backup: Backup; items: number }
  | { ok: false; error: "invalid" | "tooLarge" | "empty" };

const isGrid = (v: unknown) =>
  Array.isArray(v) && v.length === 9 && v.every((row) => Array.isArray(row) && row.length === 9);

/** Parses a stored value and checks the few keys whose shape would crash or mislead the app. */
function validEntry(key: string, value: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (key.startsWith("sudoku_v1_save_")) {
    const save = parsed as Record<string, unknown> | null;
    return (
      !!save &&
      isGrid(save.currentBoard) &&
      isGrid(save.initialBoard) &&
      isGrid(save.solvedBoard) &&
      Array.isArray(save.notesBoard) &&
      save.notesBoard.length === 9 &&
      save.difficulty === key.slice("sudoku_v1_save_".length)
    );
  }
  if (key === "sudoku_v1_pref_mistake_limit") return [0, 3, 5].includes(parsed as number);
  if (key === "sudoku_v1_pref_hint_style") return parsed === "full" || parsed === "nudge";
  if (key.startsWith("sudoku_v1_pref_")) return typeof parsed === "boolean";
  if (key === "sudoku_v1_score") {
    return (
      !!parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { total?: unknown }).total === "number"
    );
  }
  return true;
}

/** Validates a backup file's text. Anything not under our prefix, or not valid JSON, rejects it. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "tooLarge" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid" };
  }
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== "object" || b.app !== "sudoku-pro" || b.version !== 1) {
    return { ok: false, error: "invalid" };
  }
  if (!b.data || typeof b.data !== "object" || typeof b.exportedAt !== "string") {
    return { ok: false, error: "invalid" };
  }
  const entries = Object.entries(b.data);
  if (entries.length === 0) return { ok: false, error: "empty" };
  for (const [key, value] of entries) {
    if (!key.startsWith(BACKUP_PREFIX) || typeof value !== "string" || !validEntry(key, value)) {
      return { ok: false, error: "invalid" };
    }
  }
  return { ok: true, backup: b as Backup, items: entries.length };
}

function snapshot(store: Store): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(BACKUP_PREFIX)) out.push([key, store.getItem(key) ?? ""]);
  }
  return out;
}

function write(store: Store, entries: [string, string][]) {
  for (const [key] of snapshot(store)) store.removeItem(key);
  for (const [key, value] of entries) store.setItem(key, value);
}

/**
 * Replaces all game data with the backup's and returns how many keys were written. If a write
 * fails part-way (quota, private mode), the previous data is restored and the error rethrown, so
 * a failed import never leaves the player with nothing.
 */
export function applyBackup(store: Store, backup: Backup): number {
  const previous = snapshot(store);
  const entries = Object.entries(backup.data);
  try {
    write(store, entries);
  } catch (error) {
    try {
      write(store, previous);
    } catch {
      /* nothing more we can do */
    }
    throw error;
  }
  return entries.length;
}
