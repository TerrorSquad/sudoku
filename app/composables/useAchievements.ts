import type { AcademySummary, WinSummary } from "../utils/achievements";

import { newlyUnlocked, newlyUnlockedAcademy } from "../utils/achievements";
import { readJSON, writeJSON } from "../utils/safeJson";
import { reportAchievements } from "../utils/wavedash";

const KEY = "sudoku_v1_achievements";

/** id -> unlock timestamp (ms). */
type UnlockedMap = Record<string, number>;

export function useAchievements() {
  function getUnlocked(): UnlockedMap {
    return readJSON<UnlockedMap>(KEY, {});
  }

  function unlock(fresh: string[], now: number): string[] {
    if (!fresh.length) return fresh;
    const unlocked = getUnlocked();
    for (const id of fresh) unlocked[id] = now;
    writeJSON(KEY, unlocked);
    reportAchievements(fresh);
    return fresh;
  }

  /** Evaluate a won game, persist any new unlocks and return their ids. */
  function evaluate(summary: WinSummary, now: number = Date.now()): string[] {
    return unlock(newlyUnlocked(getUnlocked(), summary), now);
  }

  /** The same for the Academy's progress (lessons, stars, How to play, Spot it). */
  function evaluateAcademy(summary: AcademySummary, now: number = Date.now()): string[] {
    return unlock(newlyUnlockedAcademy(getUnlocked(), summary), now);
  }

  return { getUnlocked, evaluate, evaluateAcademy };
}
