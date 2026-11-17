// Pure technique-mastery tiers over how often a hint has taught that technique, and its lesson.
// Unit-tested in tests/mastery.test.ts.

type Mastery = 0 | 1 | 2 | 3;

/**
 * 0 = never seen, 1 = familiar (1+), 2 = practised (5+), 3 = fluent (15+). A finished lesson
 * makes a technique at least familiar, a flawless (3-star) first level or a finished second one
 * practised; fluent takes real games or the third level, where nobody points at the pattern.
 * `level`: the highest lesson level finished.
 */
export function masteryFor(count: number, lessonStars = 0, level = 0): Mastery {
  const fromLesson: Mastery =
    level >= 3 ? 3 : lessonStars >= 3 || level >= 2 ? 2 : lessonStars > 0 ? 1 : 0;
  const fromHints: Mastery = count >= 15 ? 3 : count >= 5 ? 2 : count >= 1 ? 1 : 0;
  return Math.max(fromLesson, fromHints) as Mastery;
}
