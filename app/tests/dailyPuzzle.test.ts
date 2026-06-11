import { describe, it, expect } from 'vitest';
import { localDateKey, generateDailyBoard, computeStreak } from '../composables/useDailyPuzzle';
import { hasUniqueSolution } from '../utils/sudokuCore';

describe('daily puzzle', () => {
  it('localDateKey uses the local calendar date', () => {
    // 00:30 local on June 11 — UTC-based keys would report a different
    // day for any zone east of UTC
    const date = new Date(2026, 5, 11, 0, 30);
    expect(localDateKey(date)).toBe('2026-06-11');
  });

  it('board is deterministic per date and differs between dates', () => {
    const a1 = generateDailyBoard('2026-06-11');
    const a2 = generateDailyBoard('2026-06-11');
    const b = generateDailyBoard('2026-06-12');
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(b);
  });

  it('daily board has a unique solution', () => {
    expect(hasUniqueSolution(generateDailyBoard('2026-06-11'))).toBe(true);
  });

  it('streak counts consecutive completed days ending today', () => {
    const done = new Set(['2026-06-11', '2026-06-10', '2026-06-09']);
    expect(computeStreak(k => done.has(k), new Date(2026, 5, 11))).toBe(3);
  });

  it('an unplayed today does not break the streak', () => {
    const done = new Set(['2026-06-10', '2026-06-09']);
    expect(computeStreak(k => done.has(k), new Date(2026, 5, 11))).toBe(2);
  });

  it('a gap breaks the streak', () => {
    const done = new Set(['2026-06-11', '2026-06-09', '2026-06-08']);
    expect(computeStreak(k => done.has(k), new Date(2026, 5, 11))).toBe(1);
  });

  it('no completions means no streak', () => {
    expect(computeStreak(() => false, new Date(2026, 5, 11))).toBe(0);
  });

  it('streak crosses month boundaries correctly', () => {
    const done = new Set(['2026-06-01', '2026-05-31', '2026-05-30']);
    expect(computeStreak(k => done.has(k), new Date(2026, 5, 1))).toBe(3);
  });
});
