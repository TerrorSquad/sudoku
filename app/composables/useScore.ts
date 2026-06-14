const KEY = "sudoku_v1_score";

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

function empty(): ScoreStats {
  return { total: 0, gamesWon: 0, best: {}, perDifficulty: {} };
}

export interface RecordResult {
  stats: ScoreStats;
  isNewBest: boolean;
  previousBest: number;
}

export function useScore() {
  function getStats(): ScoreStats {
    if (typeof window === "undefined") return empty();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<ScoreStats>;
      const best = parsed.best ?? {};
      // Migrate older saves (no perDifficulty) from the flat best map.
      const perDifficulty: Record<string, DifficultyStat> = { ...(parsed.perDifficulty ?? {}) };
      for (const [diff, score] of Object.entries(best)) {
        if (!perDifficulty[diff]) perDifficulty[diff] = { best: score, wins: 0, bestTime: 0 };
      }
      return {
        total: parsed.total ?? 0,
        gamesWon: parsed.gamesWon ?? 0,
        best,
        perDifficulty,
      };
    } catch {
      return empty();
    }
  }

  function record(difficulty: string, points: number, timeSeconds = 0): RecordResult {
    const stats = getStats();
    const previousBest = stats.best[difficulty] ?? 0;
    const isNewBest = points > previousBest;

    stats.total += points;
    stats.gamesWon += 1;
    if (isNewBest) stats.best[difficulty] = points;

    const d = stats.perDifficulty[difficulty] ?? { best: 0, wins: 0, bestTime: 0 };
    d.wins += 1;
    d.best = Math.max(d.best, points);
    if (timeSeconds > 0)
      d.bestTime = d.bestTime === 0 ? timeSeconds : Math.min(d.bestTime, timeSeconds);
    stats.perDifficulty[difficulty] = d;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(KEY, JSON.stringify(stats));
      } catch {
        /* storage full / unavailable — score is non-critical */
      }
    }
    return { stats, isNewBest, previousBest };
  }

  return { getStats, record };
}
