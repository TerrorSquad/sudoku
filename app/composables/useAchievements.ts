import type { WinSummary } from "../utils/achievements";

import { newlyUnlocked } from "../utils/achievements";
import { readJSON, writeJSON } from "../utils/safeJson";

const KEY = "sudoku_v1_achievements";

/** id -> unlock timestamp (ms). */
export type UnlockedMap = Record<string, number>;

export function useAchievements() {
  function getUnlocked(): UnlockedMap {
    return readJSON<UnlockedMap>(KEY, {});
  }

  /** Evaluate a won game, persist any new unlocks and return their ids. */
  function evaluate(summary: WinSummary, now: number = Date.now()): string[] {
    const unlocked = getUnlocked();
    const fresh = newlyUnlocked(unlocked, summary);
    if (fresh.length) {
      for (const id of fresh) unlocked[id] = now;
      writeJSON(KEY, unlocked);
    }
    return fresh;
  }

  return { getUnlocked, evaluate };
}
