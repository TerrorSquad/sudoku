import type { Difficulty, Grid } from "../types/sudoku";
import type { NewRecord, Snapshot } from "../utils/records";
import type { ScoreBreakdown } from "../utils/score";
import type { TechniqueId } from "../utils/sudokuGrader";

import { levelFor } from "../utils/level";
import { lockOf, nextChallenge } from "../utils/progression";
import { brokenRecords } from "../utils/records";
import { computeScore } from "../utils/score";
import { localDateKey } from "../utils/streak";
import { stuckMoments, type Placement, type StuckMoment } from "../utils/stuckMoments";
import { neededTechniques } from "../utils/sudokuGrader";
import { saveToCloud, submitWin } from "../utils/wavedash";
import { useAchievements } from "./useAchievements";
import { useDailyPuzzle } from "./useDailyPuzzle";
import { useRecords } from "./useRecords";
import { statsKey, useScore, winsAt } from "./useScore";
import { useTechniquePath } from "./useTechniquePath";
import { useTechniqueStats } from "./useTechniqueStats";
import { formatTime } from "./useTimer";

// Recording a won game: score, Daily, unlocks, achievements, records and the cloud copy. The
// modal, sounds and confetti stay with the game (app.vue).

/** The game as it was won. */
export interface WinGame {
  difficulty: Difficulty;
  daily: boolean;
  dailyDate: string; // the Daily's own day: a game started before midnight can end after it
  zen: boolean;
  practice: TechniqueId | null; // the drilled technique
  week: string | null; // the ISO week, when the practice game is the technique of the week
  seconds: number;
  mistakes: number;
  hints: number;
  colorMode: boolean;
  challengeTarget: number; // a friend's time on a custom board, 0 for none
  initialBoard: Grid;
  placements: Placement[];
  lockedBefore: Difficulty[]; // read before the game's save was cleared
}

/** What the win modal shows. */
export interface WinResult {
  score: ScoreBreakdown | null; // null for Zen and practice wins
  isNewBest: boolean;
  lifetimeTotal: number;
  reachedLevel: number | null; // set when the win crossed a level threshold
  notes: { text: string; ok: boolean }[]; // progress the win made (ok), or why it made none
  records: NewRecord[]; // personal records broken: at most two lines
  neededTechs: TechniqueId[]; // what the givens required (not what the player used)
  stuck: StuckMoment[]; // "Where you got stuck"
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

export function useWinResult(t: Translate) {
  const score = useScore();
  const records = useRecords();
  const dailyPuzzle = useDailyPuzzle();
  const achievements = useAchievements();
  const techStats = useTechniqueStats();
  const techniquePath = useTechniquePath();

  /**
   * Records the win and says what it earned: the modal's result, achievement toasts, the first
   * level it opened, and whether it deserves the unlock cue.
   */
  function recordWin(game: WinGame) {
    const { difficulty, daily, zen, practice: practised, seconds, mistakes, hints } = game;
    const key = statsKey(difficulty, daily);
    // A few ms even for Master (measured), so no worker: the modal fades in after the win wave.
    // The save is already cleared, so a grader failure must cost this list, not the win.
    let needed: ReturnType<typeof neededTechniques> = [];
    try {
      needed = neededTechniques(game.initialBoard);
    } catch {
      needed = [];
    }
    const result: WinResult = {
      score: null,
      isNewBest: false,
      lifetimeTotal: 0,
      reachedLevel: null,
      notes: [],
      records: [],
      // A drill's pre-filled notes are invisible to the grader, so lead with what was practised.
      neededTechs: practised ? [practised, ...needed.filter((id) => id !== practised)] : needed,
      stuck: [],
    };
    const notes = result.notes;
    let toasts: string[] = [];
    let opened: Difficulty | null = null;
    let unlock = false;

    // What a win can break, read before and after recording it. A Daily's time is compared with
    // earlier Dailies (its own score row), like its "New best" chip.
    const snapshot = (): Snapshot => ({
      ...records.get(),
      fastest: score.getStats().perDifficulty[key]?.bestTime ?? 0,
      streak: dailyPuzzle.getLongestStreak(),
    });
    // Levels that were locked before this win (counting saves) and are open now.
    const announceUnlocks = () => {
      const wins = score.unlockWins();
      for (const level of game.lockedBefore.filter((d) => !lockOf(d, wins))) {
        opened ??= level;
        notes.push({
          text: t("difficulty.unlocked", { level: t(`difficulty.${level}`) }),
          ok: true,
        });
      }
    };

    if (difficulty === "custom" && game.challengeTarget > 0 && !practised) {
      const diff = game.challengeTarget - seconds;
      notes.push({
        text: t(diff > 0 ? "challenge.won" : diff === 0 ? "challenge.tie" : "challenge.lost", {
          time: formatTime(Math.abs(diff)),
        }),
        ok: diff >= 0,
      });
    }
    // Practice and custom boards don't count: a one-blank custom board could be won over and over.
    const recordsBefore = !practised && difficulty !== "custom" ? snapshot() : null;
    if (practised) {
      // A practice win can complete the week's puzzle. The path's challenges are its lessons.
      const name = t(`hint.move.${practised}.name`);
      if (!game.week && nextChallenge(techniquePath.getDone()) === practised)
        notes.push({ text: t("path.lessonCounts"), ok: false });
      if (game.week && techniquePath.markWeekDone(game.week))
        notes.push({ text: t("weekly.won", { name }), ok: true });
      if (notes.some((n) => n.ok)) {
        unlock = true;
        saveToCloud();
      }
    } else if (zen) {
      score.recordZenWin(difficulty);
      announceUnlocks();
      unlock = notes.length > 0;
    } else {
      if (daily) {
        const earnedBefore = dailyPuzzle.getStreakState().earned;
        dailyPuzzle.markComplete(seconds, mistakes, game.dailyDate);
        if (dailyPuzzle.getStreakState().earned > earnedBefore)
          notes.push({ text: t("streak.freezeEarned"), ok: true });
      }
      const breakdown = computeScore({
        difficulty,
        timeSeconds: seconds,
        mistakes,
        hintsUsed: hints,
      });
      const recorded = score.record(key, breakdown.total, seconds);
      submitWin({ difficulty, seconds, mistakes, hints, daily: daily ? game.dailyDate : null });
      result.score = breakdown;
      result.isNewBest = recorded.isNewBest;
      result.lifetimeTotal = recorded.stats.total;
      const before = levelFor(recorded.previousTotal).level;
      const after = levelFor(recorded.stats.total).level;
      result.reachedLevel = after > before ? after : null;
      announceUnlocks();
      toasts = achievements.evaluate({
        difficulty,
        timeSeconds: seconds,
        mistakes,
        hintsUsed: hints,
        isDaily: daily,
        colorMode: game.colorMode,
        hour: new Date().getHours(),
        gamesWon: recorded.stats.gamesWon,
        winsAtDifficulty: winsAt(recorded.stats.perDifficulty, key),
        dailyStreak: daily ? dailyPuzzle.getStreak() : 0,
        distinctTechniques: Object.keys(techStats.getAll()).length,
      });
      unlock = toasts.length > 0 || notes.some((n) => n.ok);
    }
    if (recordsBefore) {
      records.recordWin({ day: localDateKey(), difficulty, mistakes, hints });
      result.records = brokenRecords(recordsBefore, snapshot()).slice(0, 2);
    }
    if (!practised) saveToCloud();
    // After the score is safe: a damaged log must cost the stuck moments, not the win.
    try {
      if (!zen) result.stuck = stuckMoments(game.initialBoard, game.placements);
    } catch {
      result.stuck = [];
    }
    return { result, toasts, opened, unlock };
  }

  return { recordWin };
}
