// The only code that touches the Wavedash SDK (https://docs.wavedash.com/sdk). On Wavedash the
// platform injects `Wavedash` before the app starts; everywhere else (Vercel, the PWA, dev) it is
// absent and every export here is a no-op. Design: docs/specs/2026-10-27-wavedash-platform-design.md.

import {
  CLOUD_FILE,
  META_KEY,
  SYNC_BACKUP_KEY,
  decide,
  hashData,
  readCloud,
  type CloudFile,
  type CloudRead,
  type SyncMeta,
} from "./cloudSync";
import { applyBackup, createBackup } from "./progressBackup";
import { readJSON, writeJSON } from "./safeJson";

type Response<T> = { success: true; data: T } | { success: false; data: null; message: string };

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  globalRank: number;
}

interface WavedashSDK {
  init(config?: { debug?: boolean }): boolean;
  requestStats(): Promise<{ success: boolean }>;
  getAchievement(id: string): boolean;
  setAchievement(id: string, storeNow?: boolean): boolean;
  storeStats(): boolean;
  getOrCreateLeaderboard(
    name: string,
    sortOrder: 0 | 1,
    displayType: 0 | 1,
  ): Promise<Response<{ id: string }>>;
  uploadLeaderboardScore(
    id: string,
    score: number,
    keepBest: boolean,
    ugcId?: string,
    metadata?: Record<string, number | string | boolean>,
  ): Promise<Response<unknown>>;
  listLeaderboardEntries(
    id: string,
    offset: number,
    limit: number,
    friendsOnly?: boolean,
  ): Promise<Response<LeaderboardEntry[]>>;
  getMyLeaderboardEntries(id: string): Promise<Response<LeaderboardEntry[]>>;
  writeLocalFile(path: string, data: Uint8Array): Promise<boolean>;
  readLocalFile(path: string): Promise<Uint8Array | null>;
  uploadRemoteFile(path: string): Promise<Response<string>>;
  downloadRemoteFile(path: string): Promise<Response<string>>;
  remoteFileExists(path: string): Promise<Response<boolean>>;
}

const sdk = () => (globalThis as { Wavedash?: WavedashSDK }).Wavedash;

/** Our ids are kebab-case; Wavedash identifiers are UPPER_SNAKE (`first-win` → `FIRST_WIN`). */
export const wavedashId = (id: string) => id.toUpperCase().replaceAll("-", "_");

/**
 * Sends each pending achievement; returns the ones still pending. A write returns false (and is
 * dropped) until both halves of the stats load have arrived, or for an id the portal lacks.
 */
export function flush(
  pending: Iterable<string>,
  wd: Pick<WavedashSDK, "getAchievement" | "setAchievement">,
): { left: string[]; wrote: boolean } {
  const left: string[] = [];
  let wrote = false;
  for (const id of pending) {
    const wid = wavedashId(id);
    if (wd.getAchievement(wid)) continue;
    if (wd.setAchievement(wid, false)) wrote = true;
    else left.push(id);
  }
  return { left, wrote };
}

const RETRY_MS = 1000;
// ponytail: fixed 60 retries; an id still rejected after that is probably missing from the portal,
// and the next boot's back-fill tries it again.
const MAX_TRIES = 60;
const pending = new Set<string>();
let ready = false;
let tries = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function send() {
  const wd = sdk();
  if (!wd || !ready) return;
  clearTimeout(timer);
  const { left, wrote } = flush(pending, wd);
  // Stats auto-save about once a second and nothing flushes on exit, so store right away.
  if (wrote) wd.storeStats();
  pending.clear();
  for (const id of left) pending.add(id);
  if (pending.size && ++tries < MAX_TRIES) timer = setTimeout(send, RETRY_MS);
}

/** Hides the platform loader and back-fills achievements unlocked before (or off) Wavedash. */
export function initWavedash(unlocked: string[]) {
  const wd = sdk();
  if (!wd) return;
  wd.init();
  for (const id of unlocked) pending.add(id);
  // A failed load still starts the retries: rejected writes stay pending either way.
  const start = () => {
    ready = true;
    send();
  };
  void wd.requestStats().then(start, start);
}

export function reportAchievements(ids: string[]) {
  if (!sdk() || !ids.length) return;
  for (const id of ids) pending.add(id);
  tries = 0;
  send();
}

/** True on Wavedash, where the SDK is injected; the leaderboard UI shows only then. */
export const hasWavedash = () => !!sdk();

// Leaderboards: every board is a time, sorted ascending and shown as m:ss. There is no lifetime
// score board, since custom puzzles count towards that total and would make it trivial to farm.
export interface Board {
  name: string;
}
export const DIFFICULTIES = ["beginner", "easy", "medium", "hard", "expert", "master"] as const;
export const dailyBoard = (dateKey: string): Board => ({ name: `daily-${dateKey}` });
export const timeBoard = (difficulty: string): Board => ({ name: `best-time-${difficulty}` });

export interface Win {
  difficulty: string;
  seconds: number;
  mistakes: number;
  hints: number;
  /** The Daily's date key (`localDateKey`), or null for a regular game. */
  daily: string | null;
}

/**
 * The scores a win posts: its time on the Daily's board, or else on its difficulty's. Custom
 * puzzles (and anything outside the six difficulties) post nothing.
 */
export function scoresFor(win: Win): { board: Board; score: number }[] {
  if (!(DIFFICULTIES as readonly string[]).includes(win.difficulty)) return [];
  const timed = win.daily ? dailyBoard(win.daily) : timeBoard(win.difficulty);
  return win.seconds > 0 ? [{ board: timed, score: win.seconds }] : [];
}

const boardIds = new Map<string, Promise<string | null>>();

/** A board's id, created on first use (game-created boards may start hidden on the game page). */
function boardId(wd: WavedashSDK, board: Board): Promise<string | null> {
  let id = boardIds.get(board.name);
  if (!id) {
    // 0 = ascending, 1 = time in seconds.
    id = wd.getOrCreateLeaderboard(board.name, 0, 1).then(
      (r) => (r.success ? r.data.id : null),
      () => null,
    );
    // A failed lookup isn't cached, so the next call tries again.
    void id.then((v) => v ?? boardIds.delete(board.name));
    boardIds.set(board.name, id);
  }
  return id;
}

/** Posts a win's scores, keeping each player's best. Fire-and-forget: failures only log. */
export function submitWin(win: Win) {
  const wd = sdk();
  if (!wd) return;
  const metadata = { mistakes: win.mistakes, hints: win.hints };
  for (const { board, score } of scoresFor(win)) {
    void boardId(wd, board)
      .then((id) => (id ? wd.uploadLeaderboardScore(id, score, true, undefined, metadata) : null))
      .then(
        (r) => r && !r.success && console.warn(`Wavedash ${board.name}:`, r.message),
        (e) => console.warn(`Wavedash ${board.name}:`, e),
      );
  }
}

export interface BoardView {
  top: LeaderboardEntry[];
  /** The player's own entry, or null if they haven't posted to this board. */
  me: LeaderboardEntry | null;
}

/** The top ten (or top ten friends) and the player's own standing; throws when the SDK fails. */
export async function loadBoard(board: Board, friendsOnly: boolean): Promise<BoardView> {
  const wd = sdk();
  if (!wd) throw new Error("Wavedash is not available");
  const id = await boardId(wd, board);
  if (!id) throw new Error(`No leaderboard ${board.name}`);
  const [top, mine] = await Promise.all([
    wd.listLeaderboardEntries(id, 0, 10, friendsOnly),
    wd.getMyLeaderboardEntries(id),
  ]);
  if (!top.success) throw new Error(top.message);
  return { top: top.data, me: mine.success ? (mine.data[0] ?? null) : null };
}

// Cloud saves: one file holding every sudoku_v1_* key (the Settings export). Pure decisions in
// utils/cloudSync.ts.

/** The cloud copy, or null when we can't tell (offline, SDK error, timeout). */
async function readCloudFile(wd: WavedashSDK): Promise<CloudRead | null> {
  const exists = await wd.remoteFileExists(CLOUD_FILE);
  if (!exists.success) return null;
  if (!exists.data) return { kind: "missing" };
  if (!(await wd.downloadRemoteFile(CLOUD_FILE)).success) return null;
  // Downloads land in the SDK's local store; its listings use absolute keys, so try both.
  const bytes = (await wd.readLocalFile(CLOUD_FILE)) ?? (await wd.readLocalFile(`/${CLOUD_FILE}`));
  return bytes ? readCloud(new TextDecoder().decode(bytes)) : null;
}

/** Uploads only start once the boot sync has seen the cloud copy, so they can't overwrite it blind. */
let canUpload = false;
let lastUpload = 0;
let uploadTimer: ReturnType<typeof setTimeout> | undefined;

const keep = (reason: string, backup: unknown) =>
  writeJSON(SYNC_BACKUP_KEY, { reason, savedAt: Date.now(), backup });

/**
 * Runs before the app mounts (every composable reads localStorage on setup): restores a newer
 * cloud copy, or uploads newer local data. Whatever a sync replaces is kept under
 * SYNC_BACKUP_KEY first; if that can't be written, the sync stops.
 */
export async function syncFromCloud(timeoutMs = 5000) {
  const wd = sdk();
  if (!wd) return;
  try {
    const cloud = await Promise.race([
      readCloudFile(wd),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!cloud) return;
    const local = createBackup(localStorage);
    const decision = decide(local.data, cloud, readJSON<SyncMeta | null>(META_KEY, null));
    switch (decision.action) {
      case "hold":
        return;
      case "in-sync":
        markSynced(decision.file);
        break;
      case "restore":
        if (Object.keys(local.data).length && !keep("restore", local)) return;
        applyBackup(localStorage, decision.file);
        markSynced(decision.file);
        break;
      case "upload":
        if (decision.replaced && !keep("conflict", decision.replaced)) return;
        canUpload = true;
        // A missing or corrupt cloud file needs the upload even if local matches the last sync.
        await upload(wd, cloud.kind !== "ok");
        return;
    }
    canUpload = true;
  } catch (e) {
    console.warn("Wavedash cloud sync:", e);
  }
}

const markSynced = (file: CloudFile) =>
  writeJSON(META_KEY, { syncedAt: file.updatedAt, syncedHash: hashData(file.data) });

async function upload(wd: WavedashSDK, force = false) {
  const backup = createBackup(localStorage);
  if (!Object.keys(backup.data).length) return;
  const unchanged = hashData(backup.data) === readJSON<SyncMeta | null>(META_KEY, null)?.syncedHash;
  if (unchanged && !force) return;
  const file: CloudFile = { ...backup, updatedAt: Date.now() };
  lastUpload = Date.now();
  const bytes = new TextEncoder().encode(JSON.stringify(file));
  const ok =
    (await wd.writeLocalFile(CLOUD_FILE, bytes)) && (await wd.uploadRemoteFile(CLOUD_FILE)).success;
  // Over the rate limit the SDK fails fast until its wait passes: no retry, the next checkpoint
  // (at least FAIL_GAP_MS later) tries again.
  if (ok) markSynced(file);
  else lastUpload += FAIL_GAP_MS;
}

// The limit is 30 uploads a minute; checkpoints stay far below it.
const MIN_GAP_MS = 30_000;
const HIDDEN_GAP_MS = 5_000;
const FAIL_GAP_MS = 60_000;

/**
 * A checkpoint (a win, the tab hiding): uploads if the data changed since the last sync, at most
 * once per MIN_GAP_MS, with a trailing upload for changes inside the gap. `hidden` uses a shorter
 * gap, since a hidden tab may never run the trailing timer.
 */
export function saveToCloud(hidden = false) {
  const wd = sdk();
  if (!wd || !canUpload) return;
  clearTimeout(uploadTimer);
  const run = () => void upload(wd).catch((e) => console.warn("Wavedash cloud save:", e));
  const wait = lastUpload + (hidden ? HIDDEN_GAP_MS : MIN_GAP_MS) - Date.now();
  if (wait > 0) uploadTimer = setTimeout(run, wait);
  else run();
}
