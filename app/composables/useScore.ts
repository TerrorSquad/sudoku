import { withZenWins, type WinsByDifficulty } from "../utils/progression";
import { readJSON, writeJSON } from "../utils/safeJson";

const KEY = "sudoku_v1_score";
/** Zen wins per difficulty: no score, but they open harder levels like any win. */
const ZEN_KEY = "sudoku_v1_zen_wins";

export interface DifficultyStat {
  best: number; // best single-game score
  wins: number; // games won at this difficulty
  bestTime: number; // fastest win in seconds (0 = none yet)
}

export interface ScoreStats {
  total: number; // lifetime points
  gamesWon: number;
  best: Record<string, number>; // best score per difficulty (kept for the win modal)
  perDifficulty: Record<string, DifficultyStat>;
}

export interface RecordResult {
  stats: ScoreStats;
  isNewBest: boolean;
  previousBest: number;
  /** Lifetime total before this win was added. */
  previousTotal: number;
}

/**
 * The stats row a win is recorded under. The Daily is a Medium board, but its best time and score
 * are its own: a quick Daily mustn't become the time to beat in an ordinary Medium game.
 */
export function statsKey(difficulty: string, daily: boolean): string {
  return daily ? "daily" : difficulty;
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
    const wins: WinsByDifficulty = { ...getStats().perDifficulty };
    // A Daily is a Medium board with its own stats row (statsKey); it still opens Hard.
    const daily = wins.daily?.wins ?? 0;
    if (daily) wins.medium = { ...wins.medium, wins: (wins.medium?.wins ?? 0) + daily };
    return withZenWins(wins, readJSON<unknown>(ZEN_KEY, {}));
  }

  return { getStats, record, recordZenWin, unlockWins };
}
