import type { PlayerStats } from "../utils/wavedash";

import { levelFor } from "../utils/level";
import { useAchievements } from "./useAchievements";
import { useDailyPuzzle } from "./useDailyPuzzle";
import { useScore } from "./useScore";
import { useTechniquePath } from "./useTechniquePath";

/** The stats mirrored to Wavedash, read from local progress (so a back-fill needs nothing stored). */
export function readPlayerStats(): PlayerStats {
  const score = useScore().getStats();
  return {
    GAMES_WON: score.gamesWon,
    // Every level's Daily: Medium's "daily" row and the daily_<level> ones (statsKey).
    DAILIES_WON: Object.entries(score.perDifficulty)
      .filter(([k]) => k === "daily" || k.startsWith("daily_"))
      .reduce((n, [, row]) => n + row.wins, 0),
    LONGEST_DAILY_STREAK: useDailyPuzzle().getLongestStreak(),
    LIFETIME_SCORE: score.total,
    LEVEL: levelFor(score.total).level,
    TECHNIQUES_LEARNED: useTechniquePath().getDone().length,
    ACHIEVEMENTS_UNLOCKED: Object.keys(useAchievements().getUnlocked()).length,
  };
}
