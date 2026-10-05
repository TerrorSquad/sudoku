// Export / import of everything the game stores locally (sudoku_v1_*): scores, achievements,
// saves, Daily history and preferences. Pure over a Storage-like object; unit-tested in
// tests/progressBackup.test.ts.

export const BACKUP_PREFIX = "sudoku_v1_";
const MAX_BYTES = 5_000_000;

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

const isJson = (s: string) => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

/** Validates a backup file's text. Anything not under our prefix, or not valid JSON, rejects it. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BYTES) return { ok: false, error: "tooLarge" };
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
    if (!key.startsWith(BACKUP_PREFIX) || typeof value !== "string" || !isJson(value)) {
      return { ok: false, error: "invalid" };
    }
  }
  return { ok: true, backup: b as Backup, items: entries.length };
}

/** Replaces all game data with the backup's. Returns how many keys were written. */
export function applyBackup(store: Store, backup: Backup): number {
  const existing: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(BACKUP_PREFIX)) existing.push(key);
  }
  for (const key of existing) store.removeItem(key);
  const entries = Object.entries(backup.data);
  for (const [key, value] of entries) store.setItem(key, value);
  return entries.length;
}
