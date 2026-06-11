const KEY = 'sudoku_v1_score';

export interface ScoreStats {
  total: number;                    // lifetime points
  gamesWon: number;
  best: Record<string, number>;     // best single-game score per difficulty
}

function empty(): ScoreStats {
  return { total: 0, gamesWon: 0, best: {} };
}

export interface RecordResult {
  stats: ScoreStats;
  isNewBest: boolean;
  previousBest: number;
}

export function useScore() {
  function getStats(): ScoreStats {
    if (typeof window === 'undefined') return empty();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<ScoreStats>;
      return { total: parsed.total ?? 0, gamesWon: parsed.gamesWon ?? 0, best: parsed.best ?? {} };
    } catch {
      return empty();
    }
  }

  function record(difficulty: string, points: number): RecordResult {
    const stats = getStats();
    const previousBest = stats.best[difficulty] ?? 0;
    const isNewBest = points > previousBest;

    stats.total += points;
    stats.gamesWon += 1;
    if (isNewBest) stats.best[difficulty] = points;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(KEY, JSON.stringify(stats));
      } catch { /* storage full / unavailable — score is non-critical */ }
    }
    return { stats, isNewBest, previousBest };
  }

  return { getStats, record };
}
