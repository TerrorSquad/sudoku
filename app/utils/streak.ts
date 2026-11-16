// Daily streaks with freezes. Pure; unit-tested in tests/streak.test.ts.
//
// Every FREEZE_EVERY Dailies completed earn a freeze (at most MAX_FREEZES held). A missed day while
// a streak is alive spends one, and the streak carries on (the frozen day doesn't add to it). It is
// all derived from the completed dates, so there's nothing new to store or to merge on cloud sync.

export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

interface StreakState {
  /** Ending today, or yesterday while today is still unplayed. */
  current: number;
  longest: number;
  /** Freezes held now. */
  freezes: number;
  /** Freezes ever earned (what a win compares, as spending and refunds move `freezes`). */
  earned: number;
  /** Missed days a freeze covered, as YYYY-MM-DD. */
  frozen: string[];
}

/** Local calendar date (YYYY-MM-DD) — the daily rolls over at local midnight, not UTC. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY = 86_400_000;
const dayOf = (key: string) =>
  Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8)) / DAY;
const keyOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

export function streakState(completed: string[], todayKey: string): StreakState {
  const today = dayOf(todayKey);
  const done = new Set(
    completed
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .map(dayOf)
      .filter((d) => d <= today),
  );
  const state: StreakState = { current: 0, longest: 0, freezes: 0, earned: 0, frozen: [] };
  if (!done.size) return state;
  let count = 0;
  let streak = 0;
  // ponytail: walks every day since the first Daily (a few thousand at most), no index needed.
  for (let d = Math.min(...done); d <= today; d++) {
    if (done.has(d)) {
      streak++;
      if (++count % FREEZE_EVERY === 0) {
        state.earned++;
        state.freezes = Math.min(MAX_FREEZES, state.freezes + 1);
      }
    } else if (d === today) {
      break; // today isn't over: it can't break or freeze anything yet
    } else if (streak > 0 && state.freezes > 0) {
      state.freezes--;
      state.frozen.push(keyOf(d));
    } else {
      streak = 0;
    }
    state.longest = Math.max(state.longest, streak);
  }
  state.current = streak;
  return state;
}
