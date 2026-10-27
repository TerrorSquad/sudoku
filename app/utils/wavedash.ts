// The only code that touches the Wavedash SDK (https://docs.wavedash.com/sdk). On Wavedash the
// platform injects `Wavedash` before the app starts; everywhere else (Vercel, the PWA, dev) it is
// absent and every export here is a no-op. Design: docs/specs/2026-10-27-wavedash-platform-design.md.

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
