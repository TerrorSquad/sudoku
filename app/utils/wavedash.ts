// The only code that touches the Wavedash SDK (https://docs.wavedash.com/sdk). On Wavedash the
// platform injects `Wavedash` before the app starts; everywhere else (Vercel, the PWA, dev) it is
// absent and every export here is a no-op. Design: docs/specs/2026-10-27-wavedash-platform-design.md.

interface WavedashSDK {
  init(config?: { debug?: boolean }): boolean;
  requestStats(): Promise<{ success: boolean }>;
  getAchievement(id: string): boolean;
  setAchievement(id: string, storeNow?: boolean): boolean;
  storeStats(): boolean;
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
