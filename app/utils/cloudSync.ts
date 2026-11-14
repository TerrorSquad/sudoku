// Which way a Wavedash cloud sync goes, decided on boot. Pure; unit-tested in
// tests/cloudSync.test.ts. The SDK calls live in utils/wavedash.ts. Design:
// docs/specs/2026-10-27-wavedash-platform-design.md, phase 3.

import { parseBackup, type Backup } from "./progressBackup";
import { mergeRecords, readRecords } from "./records";

/** The one cloud file: a progressBackup export plus when it was uploaded. */
export const CLOUD_FILE = "progress.json";
// Both keys sit outside the sudoku_v1_ prefix, so they are never exported, imported or synced.
/** The cloud copy this device last uploaded or restored: its `updatedAt` and a hash of its data. */
export const META_KEY = "sudoku_cloud_meta";
/** Whichever copy a sync replaced, kept so a bad restore or conflict can be undone by hand. */
export const SYNC_BACKUP_KEY = "sudoku_sync_backup";

// The Daily's save stays on this device: v1.2.0 rejects a whole cloud file that holds it (it
// expects every save slot to be named after a difficulty), and it only resumes the same day anyway.
const LOCAL_ONLY = new Set(["sudoku_v1_save_daily"]);

/** The local data as it is synced: everything but the LOCAL_ONLY keys. */
export function cloudData(local: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(local).filter(([k]) => !LOCAL_ONLY.has(k)));
}

const RECORDS_KEY = "sudoku_v1_records";
const parseJson = (text: string | undefined): unknown => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null;
  }
};

/**
 * A cloud copy to restore, carrying over this device's LOCAL_ONLY entries, and its personal records
 * where they beat the cloud's (a restore after a conflict must not cost a record set here).
 */
export function withLocalOnly(file: CloudFile, local: Record<string, string>): CloudFile {
  const kept = Object.entries(local).filter(([k]) => LOCAL_ONLY.has(k));
  const data = { ...file.data, ...Object.fromEntries(kept) };
  if (local[RECORDS_KEY]) {
    const merged = mergeRecords(
      readRecords(parseJson(local[RECORDS_KEY])),
      readRecords(parseJson(file.data[RECORDS_KEY])),
    );
    data[RECORDS_KEY] = JSON.stringify(merged);
  }
  return { ...file, data };
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

export function readCloud(text: string): CloudRead {
  const parsed = parseBackup(text);
  if (parsed.ok) {
    const updatedAt = (parsed.backup as Partial<CloudFile>).updatedAt;
    if (typeof updatedAt === "number") return { kind: "ok", file: { ...parsed.backup, updatedAt } };
  }
  try {
    const raw = JSON.parse(text) as { app?: unknown; version?: unknown };
    if (raw?.app === "sudoku-pro" && typeof raw.version === "number" && raw.version > 1) {
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
