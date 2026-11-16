// Pure achievement rules — no Vue, no storage. Unit-tested in tests/achievements.test.ts.
// Each achievement is checked against the summary of the game that was just won;
// persistence of what is already unlocked lives in useAchievements.

import { parSeconds } from "./score";

export type AchievementTier = "common" | "rare" | "epic";

/** Everything a rule may look at, gathered once when a game is won. */
export interface WinSummary {
  difficulty: string;
  timeSeconds: number;
  mistakes: number;
  hintsUsed: number;
  isDaily: boolean;
  colorMode: boolean;
  /** Local hour of day, 0-23. */
  hour: number;
  /** Lifetime wins, including this one. */
  gamesWon: number;
  /** Wins at this difficulty, including this one. */
  winsAtDifficulty: number;
  /** Daily streak after this win (0 when not a daily). */
  dailyStreak: number;
  /** Distinct techniques the player has ever been shown via hints. */
  distinctTechniques: number;
}

/** The Academy's progress, read whenever it may have changed (a lesson, a drill, a course). */
export interface AcademySummary {
  /** Technique-path lessons completed, and how many there are. */
  lessons: number;
  pathTotal: number;
  /** Lessons with a 3-star best. */
  threeStars: number;
  /** How to play lessons completed, and how many there are. */
  basics: number;
  basicsTotal: number;
  /** Best Spot it round per tier, in seconds. */
  spotBest: Partial<Record<string, number>>;
}

/** Earned by a won game (`check`) or by Academy progress (`academy`). */
export interface Achievement {
  id: string;
  tier: AchievementTier;
  /** Shown as "???" until unlocked. */
  hidden?: boolean;
  check?: (s: WinSummary) => boolean;
  academy?: (a: AcademySummary) => boolean;
}

/** An Advanced or Expert Spot it round at or under this many seconds earns Eagle eye. */
export const EAGLE_EYE_SECONDS = 240;

const HARD_PLUS = new Set(["hard", "expert", "master"]);

// Order is display order in the trophy case.
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-win", tier: "common", check: (s) => s.gamesWon >= 1 },
  { id: "wins-10", tier: "common", check: (s) => s.gamesWon >= 10 },
  { id: "wins-50", tier: "rare", check: (s) => s.gamesWon >= 50 },
  { id: "wins-100", tier: "epic", check: (s) => s.gamesWon >= 100 },
  { id: "flawless", tier: "common", check: (s) => s.mistakes === 0 },
  { id: "self-reliant", tier: "common", check: (s) => s.hintsUsed === 0 },
  {
    id: "purist",
    tier: "rare",
    check: (s) => s.mistakes === 0 && s.hintsUsed === 0 && HARD_PLUS.has(s.difficulty),
  },
  {
    id: "lightning",
    tier: "rare",
    // Custom puzzles have no meaningful par, so they never count.
    check: (s) => s.difficulty !== "custom" && s.timeSeconds <= parSeconds(s.difficulty) * 0.6,
  },
  { id: "expert-win", tier: "rare", check: (s) => s.difficulty === "expert" },
  { id: "master-win", tier: "epic", check: (s) => s.difficulty === "master" },
  { id: "daily-first", tier: "common", check: (s) => s.isDaily },
  { id: "streak-3", tier: "common", check: (s) => s.isDaily && s.dailyStreak >= 3 },
  { id: "streak-7", tier: "rare", check: (s) => s.isDaily && s.dailyStreak >= 7 },
  { id: "streak-30", tier: "epic", check: (s) => s.isDaily && s.dailyStreak >= 30 },
  { id: "comeback", tier: "rare", hidden: true, check: (s) => s.mistakes === 2 },
  { id: "night-owl", tier: "common", hidden: true, check: (s) => s.hour >= 0 && s.hour < 5 },
  { id: "colourful", tier: "common", check: (s) => s.colorMode },
  { id: "scholar", tier: "rare", check: (s) => s.distinctTechniques >= 5 },
  { id: "specialist", tier: "common", check: (s) => s.winsAtDifficulty >= 10 },
  { id: "basics-done", tier: "common", academy: (a) => a.basics >= a.basicsTotal },
  { id: "first-lesson", tier: "common", academy: (a) => a.lessons >= 1 },
  { id: "half-path", tier: "rare", academy: (a) => a.lessons * 2 >= a.pathTotal },
  { id: "graduate", tier: "epic", academy: (a) => a.lessons >= a.pathTotal },
  { id: "star-pupil", tier: "rare", academy: (a) => a.threeStars >= 10 },
  {
    id: "eagle-eye",
    tier: "rare",
    academy: (a) =>
      ["Advanced", "Expert"].some((tier) => (a.spotBest[tier] ?? Infinity) <= EAGLE_EYE_SECONDS),
  },
];

/** Ids that this win unlocks and that were not already unlocked. */
export function newlyUnlocked(unlocked: Record<string, number>, s: WinSummary): string[] {
  return ACHIEVEMENTS.filter((a) => !(a.id in unlocked) && a.check?.(s)).map((a) => a.id);
}

/** Ids the Academy's progress unlocks that were not already unlocked. */
export function newlyUnlockedAcademy(
  unlocked: Record<string, number>,
  a: AcademySummary,
): string[] {
  return ACHIEVEMENTS.filter((x) => !(x.id in unlocked) && x.academy?.(a)).map((x) => x.id);
}
