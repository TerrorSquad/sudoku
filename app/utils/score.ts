// Pure scoring — no Vue, no storage. Unit-tested in tests/score.test.ts.
//
// score = base(difficulty)
//       + speed bonus (faster than par → up to +50% of base, none if slower)
//       + flawless bonus (no mistakes AND no hints → +25% of base)
//       - mistake penalty (10% of base each)
//       - hint penalty (5% of base each)
// floored at 10% of base so a win is always worth something.

export interface ScoreInput {
  difficulty: string;
  timeSeconds: number;
  mistakes: number;
  hintsUsed: number;
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  flawlessBonus: number;
  mistakePenalty: number;
  hintPenalty: number;
  total: number;
}

// Base reward scales with the technique ceiling of each difficulty.
const BASE: Record<string, number> = {
  beginner: 100,
  easy: 200,
  medium: 400,
  hard: 700,
  expert: 1100,
  master: 1600,
  custom: 300,
};

// Par time (seconds) — beating it earns the speed bonus, missing it costs nothing.
const PAR: Record<string, number> = {
  beginner: 240,
  easy: 360,
  medium: 600,
  hard: 900,
  expert: 1200,
  master: 1500,
  custom: 600,
};

export function baseScore(difficulty: string): number {
  return BASE[difficulty] ?? BASE.custom!;
}

export function computeScore({
  difficulty,
  timeSeconds,
  mistakes,
  hintsUsed,
}: ScoreInput): ScoreBreakdown {
  const base = baseScore(difficulty);
  const par = PAR[difficulty] ?? PAR.custom!;

  const t = Math.max(0, timeSeconds);
  const speedBonus = t < par ? Math.round(((par - t) / par) * base * 0.5) : 0;
  const flawlessBonus = mistakes === 0 && hintsUsed === 0 ? Math.round(base * 0.25) : 0;
  const mistakePenalty = Math.round(Math.max(0, mistakes) * base * 0.1);
  const hintPenalty = Math.round(Math.max(0, hintsUsed) * base * 0.05);

  const raw = base + speedBonus + flawlessBonus - mistakePenalty - hintPenalty;
  const total = Math.max(Math.round(base * 0.1), raw);

  return { base, speedBonus, flawlessBonus, mistakePenalty, hintPenalty, total };
}
