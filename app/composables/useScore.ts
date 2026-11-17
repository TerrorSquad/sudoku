import type { Variant } from "../types/sudoku";

import { saveSlotOf } from "../utils/progressBackup";
import { LADDER, withZenWins, type WinsByDifficulty } from "../utils/progression";
import { readJSON, writeJSON } from "../utils/safeJson";

const KEY = "sudoku_v1_score";
/** Zen wins per difficulty: no score, but they open harder levels like any win. */
const ZEN_KEY = "sudoku_v1_zen_wins";

interface DifficultyStat {
  best: number; // best single-game score
  wins: number; // games won at this difficulty
  bestTime: number; // fastest win in seconds (0 = none yet)
}

interface ScoreStats {
  total: number; // lifetime points
  gamesWon: number;
  best: Record<string, number>; // best score per difficulty (kept for the win modal)
  perDifficulty: Record<string, DifficultyStat>;
}

interface RecordResult {
  stats: ScoreStats;
  isNewBest: boolean;
  previousBest: number;
  /** Lifetime total before this win was added. */
  previousTotal: number;
}

/**
 * The stats row a win is recorded under. A Daily's best time and score are its own: a quick Daily
 * mustn't become the time to beat in an ordinary game. Medium's Daily (the original one) keeps
 * the plain "daily" row; the other levels' are daily_<level>. X-Sudoku's are x_<level>.
 */
export function statsKey(difficulty: string, daily: boolean, variant?: Variant): string {
  return saveSlotOf({ daily, difficulty, variant }); // named like the game's save slot
}

/**
 * Wins at a level, for anything that counts games rather than times (Specialist, unlocks): a
 * level's Daily and X-Sudoku games are boards of that level, so their wins count with the level's.
 * `key` is a level or one of its other rows.
 */
export function winsAt(perDifficulty: Record<string, { wins: number } | undefined>, key: string) {
  const wins = (k: string) => perDifficulty[k]?.wins ?? 0;
  const level = key === "daily" ? "medium" : key.replace(/^(daily|x)_/, "");
  return wins(level) + wins(statsKey(level, true)) + wins(statsKey(level, false, "x"));
}

export function useScore() {
  function getStats(): ScoreStats {
    const parsed = readJSON<Partial<ScoreStats>>(KEY, {});
    const best = parsed.best ?? {};
    // Migrate older saves (no perDifficulty) from the flat best map.
    const perDifficulty: Record<string, DifficultyStat> = { ...parsed.perDifficulty };
    for (const [diff, score] of Object.entries(best)) {
      if (!perDifficulty[diff]) perDifficulty[diff] = { best: score, wins: 0, bestTime: 0 };
    }
    return {
      total: parsed.total ?? 0,
      gamesWon: parsed.gamesWon ?? 0,
      best,
      perDifficulty,
    };
  }

  function record(difficulty: string, points: number, timeSeconds = 0): RecordResult {
    const stats = getStats();
    const previousBest = stats.best[difficulty] ?? 0;
    const isNewBest = points > previousBest;

    const previousTotal = stats.total;
    stats.total += points;
    stats.gamesWon += 1;
    if (isNewBest) stats.best[difficulty] = points;

    const d = stats.perDifficulty[difficulty] ?? { best: 0, wins: 0, bestTime: 0 };
    d.wins += 1;
    d.best = Math.max(d.best, points);
    if (timeSeconds > 0)
      d.bestTime = d.bestTime === 0 ? timeSeconds : Math.min(d.bestTime, timeSeconds);
    stats.perDifficulty[difficulty] = d;

    writeJSON(KEY, stats);
    return { stats, isNewBest, previousBest, previousTotal };
  }

  function recordZenWin(difficulty: string): void {
    const raw = readJSON<unknown>(ZEN_KEY, {});
    const zen = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
      string,
      number
    >;
    zen[difficulty] = (typeof zen[difficulty] === "number" ? zen[difficulty] : 0) + 1;
    writeJSON(ZEN_KEY, zen);
  }

  /** Every win that counts toward opening difficulties: scored ones plus Zen ones. */
  function unlockWins(): WinsByDifficulty {
    const per = getStats().perDifficulty;
    // A Daily or X game has its own stats row (statsKey); it still opens the next level.
    const wins: WinsByDifficulty = { ...per };
    for (const d of LADDER)
      if (per[statsKey(d, true)] || per[statsKey(d, false, "x")])
        wins[d] = { ...per[d], wins: winsAt(per, d) };
    return withZenWins(wins, readJSON<unknown>(ZEN_KEY, {}));
  }

  return { getStats, record, recordZenWin, unlockWins };
}
