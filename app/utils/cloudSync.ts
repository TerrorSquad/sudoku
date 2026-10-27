// Which way a Wavedash cloud sync goes, decided on boot. Pure; unit-tested in
// tests/cloudSync.test.ts. The SDK calls live in utils/wavedash.ts. Design:
// docs/specs/2026-10-27-wavedash-platform-design.md, phase 3.

import { parseBackup, type Backup } from "./progressBackup";

/** The one cloud file: a progressBackup export plus when it was uploaded. */
export const CLOUD_FILE = "progress.json";
// Both keys sit outside the sudoku_v1_ prefix, so they are never exported, imported or synced.
/** The cloud copy this device last uploaded or restored: its `updatedAt` and a hash of its data. */
export const META_KEY = "sudoku_cloud_meta";
/** Whichever copy a sync replaced, kept so a bad restore or conflict can be undone by hand. */
export const SYNC_BACKUP_KEY = "sudoku_sync_backup";

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
