import type { TechniqueId } from "./sudokuGrader";

import { ACADEMY_TECHNIQUES } from "./progression";

/** The techniques a game's hints applied, with how many times each (kept in its save). */
export type Hinted = Partial<Record<TechniqueId, number>>;

export interface RecapRow {
  id: TechniqueId;
  n: number;
  /** Its lesson was finished before: "Replay its lesson" rather than "Learn it". */
  learned: boolean;
}

// Easiest first, as the Academy path runs.
const ORDER: TechniqueId[] = ACADEMY_TECHNIQUES.map((t) => t.id);

/** The win modal's "what you needed help with": hardest first, at most `max` rows. */
export function hintRecap(hinted: Hinted, learned: readonly string[], max = 3): RecapRow[] {
  return (Object.entries(hinted) as [TechniqueId, number][])
    .filter(([id, n]) => ORDER.includes(id) && n > 0) // a save is stored data: skip what isn't ours
    .toSorted(([a, x], [b, y]) => ORDER.indexOf(b) - ORDER.indexOf(a) || y - x)
    .slice(0, max)
    .map(([id, n]) => ({ id, n, learned: learned.includes(id) }));
}
