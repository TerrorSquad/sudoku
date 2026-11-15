// Which way a Wavedash cloud sync goes, decided on boot. Pure; unit-tested in
// tests/cloudSync.test.ts. The SDK calls live in utils/wavedash.ts. Design:
// docs/specs/2026-10-27-wavedash-platform-design.md, phase 3.

import { BACKUP_PREFIX, parseBackup, validEntry, type Backup } from "./progressBackup";

/** The one cloud file: a progressBackup export plus when it was uploaded. */
export const CLOUD_FILE = "progress.json";
// Both keys sit outside the sudoku_v1_ prefix, so they are never exported, imported or synced.
/** The cloud copy this device last uploaded or restored: its `updatedAt` and a hash of its data. */
export const META_KEY = "sudoku_cloud_meta";
/** Whichever copy a sync replaced, kept so a bad restore or conflict can be undone by hand. */
export const SYNC_BACKUP_KEY = "sudoku_sync_backup";

// The Daily's save stays on this device: v1.2.0 rejects a whole cloud file that holds it (it
// expects every save slot to be named after a difficulty), and it only resumes the same day anyway.
// Display size is per device (a TV and a phone want different ones), and older versions reject
// any preference that isn't a boolean.
const LOCAL_ONLY = new Set(["sudoku_v1_save_daily", "sudoku_v1_pref_ui_scale"]);

/** The local data as it is synced: everything but the LOCAL_ONLY keys. */
export function cloudData(local: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(local).filter(([k]) => !LOCAL_ONLY.has(k)));
}

/** A cloud copy to restore, carrying over this device's LOCAL_ONLY entries. */
export function withLocalOnly(file: CloudFile, local: Record<string, string>): CloudFile {
  const kept = Object.entries(local).filter(([k]) => LOCAL_ONLY.has(k));
  return { ...file, data: { ...file.data, ...Object.fromEntries(kept) } };
}

export interface CloudFile extends Backup {
  updatedAt: number;
}

export interface SyncMeta {
  syncedAt: number;
  syncedHash: string;
}

export type CloudRead =
  | { kind: "missing" }
  | { kind: "ok"; file: CloudFile }
  /** Written by a later version of the game: leave it alone. */
  | { kind: "newer" }
  | { kind: "corrupt" };

export type Decision =
  | { action: "none" }
  /** Local and cloud already hold the same data; just remember that. */
  | { action: "in-sync"; file: CloudFile }
  | { action: "restore"; file: CloudFile }
  /** `replaced` is the cloud copy a conflict upload overwrites, to keep locally first. */
  | { action: "upload"; replaced?: CloudFile }
  /** Don't upload this session. */
  | { action: "hold" };

/** Order-independent fingerprint of the game data (FNV-1a over the sorted entries). */
export function hashData(data: Record<string, string>): string {
  const text = JSON.stringify(
    Object.keys(data)
      .toSorted()
      .map((k) => [k, data[k]]),
  );
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}:${text.length}`;
}

/**
 * A well-formed v1 file whose only rejected entries are preferences: a later version added a
 * setting or a value this one doesn't know. Calling it corrupt would upload over it with no undo.
 */
function newerPrefsOnly(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const entries = Object.entries(data);
  if (!entries.every(([k, v]) => k.startsWith(BACKUP_PREFIX) && typeof v === "string"))
    return false;
  const rejected = entries.filter(([k, v]) => !validEntry(k, v as string));
  return (
    rejected.length > 0 &&
    rejected.every(([k, v]) => k.startsWith("sudoku_v1_pref_") && isJson(v as string))
  );
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function readCloud(text: string): CloudRead {
  const parsed = parseBackup(text);
  if (parsed.ok) {
    const updatedAt = (parsed.backup as Partial<CloudFile>).updatedAt;
    if (typeof updatedAt === "number") return { kind: "ok", file: { ...parsed.backup, updatedAt } };
  }
  try {
    const raw = JSON.parse(text) as { app?: unknown; version?: unknown; data?: unknown };
    if (raw?.app === "sudoku-pro" && typeof raw.version === "number" && raw.version > 1) {
      return { kind: "newer" };
    }
    if (raw?.app === "sudoku-pro" && raw.version === 1 && newerPrefsOnly(raw.data)) {
      return { kind: "newer" };
    }
  } catch {
    /* corrupt */
  }
  return { kind: "corrupt" };
}

const scoreTotal = (data: Record<string, string>) => {
  try {
    const total = (JSON.parse(data.sudoku_v1_score ?? "null") as { total?: unknown } | null)?.total;
    return typeof total === "number" ? total : 0;
  } catch {
    return 0;
  }
};

/**
 * Compares local data with the cloud copy and what this device last synced. "Changed" is judged
 * against the last sync (the cloud's own `updatedAt`, never this device's clock), so devices with
 * skewed clocks can't overwrite each other. Empty or unreadable data never replaces real data.
 */
export function decide(
  local: Record<string, string>,
  cloud: CloudRead,
  meta: SyncMeta | null,
): Decision {
  const localEmpty = Object.keys(local).length === 0;
  if (cloud.kind === "newer") return { action: "hold" };
  if (cloud.kind !== "ok") return localEmpty ? { action: "none" } : { action: "upload" };

  const localHash = hashData(local);
  if (localHash === hashData(cloud.file.data)) return { action: "in-sync", file: cloud.file };
  const localChanged = !localEmpty && localHash !== meta?.syncedHash;
  const cloudChanged = cloud.file.updatedAt !== meta?.syncedAt;
  if (!cloudChanged) return localChanged ? { action: "upload" } : { action: "none" };
  if (!localChanged) return { action: "restore", file: cloud.file };
  // Both moved on since the last sync (or this device never synced): keep the copy with more
  // progress, measured by the lifetime score, which only ever grows. A tie goes to the cloud.
  return scoreTotal(local) > scoreTotal(cloud.file.data)
    ? { action: "upload", replaced: cloud.file }
    : { action: "restore", file: cloud.file };
}
