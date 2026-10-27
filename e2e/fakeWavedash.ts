import type { Page } from "@playwright/test";

/** What the fake saw. */
export interface WavedashLog {
  inits: number;
  stores: number;
  unlocked: string[];
  /** Each upload as [board name, score, keepBest, metadata]. */
  uploads: [string, number, boolean, unknown][];
  /** The cloud's files, path → text. */
  remote: Record<string, string>;
  fileUploads: number;
}

// A fake of the SDK Wavedash injects. Like the real one, it rejects the first write to each
// achievement, standing in for the second half of the stats load not having arrived yet. Every
// leaderboard lists the same entries: three players globally, one with friendsOnly. `remote`
// seeds the cloud's files (path → text); downloads copy into the SDK's local store, as the real
// one does.
export async function fakeWavedash(
  page: Page,
  { remote = {} }: { remote?: Record<string, string> } = {},
) {
  await page.addInitScript((seed) => {
    const unlocked = new Set<string>();
    const tried = new Set<string>();
    const boards: string[] = [];
    const files = new Map<string, Uint8Array>();
    const log = {
      inits: 0,
      stores: 0,
      unlocked,
      uploads: [] as unknown[],
      remote: { ...seed },
      fileUploads: 0,
    };
    const entry = (userId: string, username: string, score: number, globalRank: number) => ({
      userId,
      username,
      score,
      globalRank,
      timestamp: 0,
    });
    const me = entry("me", "You", 1500, 2);
    const ok = <T>(data: T) => Promise.resolve({ success: true, data });
    Object.assign(window, {
      wdLog: log,
      Wavedash: {
        init: () => (log.inits++, true),
        requestStats: async () => ({ success: true, data: true }),
        getAchievement: (id: string) => unlocked.has(id),
        setAchievement: (id: string) => {
          if (!tried.has(id)) return (tried.add(id), false);
          unlocked.add(id);
          return true;
        },
        storeStats: () => (log.stores++, true),
        getOrCreateLeaderboard: (name: string) => {
          if (!boards.includes(name)) boards.push(name);
          return ok({ id: `lb${boards.indexOf(name)}`, name, totalEntries: 3 });
        },
        uploadLeaderboardScore: (
          id: string,
          score: number,
          keepBest: boolean,
          _u: unknown,
          meta: unknown,
        ) => {
          log.uploads.push([boards[Number(id.slice(2))], score, keepBest, meta]);
          return ok({ score, globalRank: 1 });
        },
        listLeaderboardEntries: (_id: string, _o: number, _l: number, friendsOnly?: boolean) =>
          ok(
            friendsOnly
              ? [entry("f1", "Friendly Fox", 1800, 1), me]
              : [entry("a", "Ada", 1800, 1), me, entry("b", "Bo", 1200, 3)],
          ),
        getMyLeaderboardEntries: () => ok([me]),
        writeLocalFile: async (path: string, data: Uint8Array) => (files.set(path, data), true),
        readLocalFile: async (path: string) => files.get(path) ?? null,
        remoteFileExists: (path: string) => ok(path in log.remote),
        downloadRemoteFile: (path: string) => {
          files.set(path, new TextEncoder().encode(log.remote[path]));
          return ok(path);
        },
        uploadRemoteFile: (path: string) => {
          log.remote[path] = new TextDecoder().decode(files.get(path));
          log.fileUploads++;
          return ok(path);
        },
      },
    });
  }, remote);
}

export const sdkLog = (page: Page) =>
  page.evaluate((): WavedashLog => {
    const log = (window as unknown as { wdLog: WavedashLog & { unlocked: Set<string> } }).wdLog;
    return { ...log, unlocked: [...log.unlocked].toSorted() };
  });
