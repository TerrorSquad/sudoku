// Pure technique-mastery tiers over how often a hint has taught that technique.
// Unit-tested in tests/mastery.test.ts.

export type Mastery = 0 | 1 | 2 | 3;

/** 0 = never seen, 1 = familiar (1+), 2 = practised (5+), 3 = fluent (15+). */
export function masteryFor(count: number): Mastery {
  if (count >= 15) return 3;
  if (count >= 5) return 2;
  return count >= 1 ? 1 : 0;
}
