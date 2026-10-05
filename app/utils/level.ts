// Pure level curve over lifetime score — no Vue, no storage. Unit-tested in tests/level.test.ts.
//
// Reaching level n takes 250·n·(n−1) lifetime points (L2 at 500, L3 at 1500, L4 at 3000, …),
// so each level asks for 500 more points than the last.

export interface LevelInfo {
  level: number;
  /** Points earned inside the current level. */
  into: number;
  /** Points the current level spans. */
  span: number;
  /** 0-1 progress to the next level. */
  progress: number;
}

const threshold = (level: number) => 250 * level * (level - 1);

export function levelFor(totalScore: number): LevelInfo {
  const total = Math.max(0, totalScore);
  let level = 1;
  while (threshold(level + 1) <= total) level++;
  const span = threshold(level + 1) - threshold(level);
  const into = total - threshold(level);
  return { level, into, span, progress: into / span };
}

/** Title band shown next to the level; keys live under level.title.<band>. */
export function levelBand(level: number): "novice" | "apprentice" | "adept" | "expert" | "master" {
  if (level < 3) return "novice";
  if (level < 5) return "apprentice";
  if (level < 8) return "adept";
  if (level < 12) return "expert";
  return "master";
}
