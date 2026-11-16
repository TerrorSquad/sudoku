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
    DAILIES_WON: score.perDifficulty.daily?.wins ?? 0,
    LONGEST_DAILY_STREAK: useDailyPuzzle().getLongestStreak(),
    LIFETIME_SCORE: score.total,
    LEVEL: levelFor(score.total).level,
    TECHNIQUES_LEARNED: useTechniquePath().getDone().length,
    ACHIEVEMENTS_UNLOCKED: Object.keys(useAchievements().getUnlocked()).length,
  };
}
