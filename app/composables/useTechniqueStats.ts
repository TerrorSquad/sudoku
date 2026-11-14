import type { TechniqueId } from "../utils/sudokuGrader";

import { readJSON, writeJSON } from "../utils/safeJson";

const KEY = "sudoku_v1_technique_stats";

// Counts used to be keyed by the hint title in the player's language at the time, so switching
// language split them. These are the titles that were ever stored (frozen: new counts use ids).
const LEGACY_TITLES: Record<string, TechniqueId> = {
  "Naked Single": "naked-single",
  "Goli singl": "naked-single",
  "Hidden Single": "hidden-single",
  "Skriveni singl": "hidden-single",
  "Pointing Pair": "pointing",
  "Pokazujući par": "pointing",
  "Box-Line Reduction": "box-line",
  "Redukcija kvadrat-linija": "box-line",
  "Naked Pair": "naked-pair",
  "Goli par": "naked-pair",
  "Hidden Pair": "hidden-pair",
  "Skriveni par": "hidden-pair",
  "Naked Triple": "naked-triple",
  "Goli tripl": "naked-triple",
  "Hidden Triple": "hidden-triple",
  "Skriveni tripl": "hidden-triple",
  "Naked Quad": "naked-quad",
  "Goli kvadrupl": "naked-quad",
  "Hidden Quad": "hidden-quad",
  "Skriveni kvadrupl": "hidden-quad",
  "X-Wing": "x-wing",
  Swordfish: "swordfish",
  Jellyfish: "jellyfish",
  "XY-Wing": "xy-wing",
  "XYZ-Wing": "xyz-wing",
  Skyscraper: "skyscraper",
  "2-String Kite": "two-string-kite",
  "Unique Rectangle": "unique-rectangle",
  "Jedinstveni pravougaonik": "unique-rectangle",
  "Simple Coloring": "simple-coloring",
  "Jednostavno bojenje": "simple-coloring",
};

/** Re-keys title-keyed counts by technique id, summing languages; unknown keys are kept as-is. */
export function migrateTechniqueStats(stats: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(stats)) {
    const id = Object.hasOwn(LEGACY_TITLES, key) ? LEGACY_TITLES[key]! : key;
    out[id] = (out[id] ?? 0) + n;
  }
  return out;
}

export function useTechniqueStats() {
  function getAll(): Record<string, number> {
    const stored = readJSON<Record<string, number>>(KEY, {});
    if (!Object.keys(stored).some((k) => Object.hasOwn(LEGACY_TITLES, k))) return stored;
    const migrated = migrateTechniqueStats(stored);
    writeJSON(KEY, migrated);
    return migrated;
  }

  function record(id: TechniqueId): void {
    const stats = getAll();
    stats[id] = (stats[id] ?? 0) + 1;
    writeJSON(KEY, stats);
  }

  function getCount(id: TechniqueId): number {
    return getAll()[id] ?? 0;
  }

  return { record, getCount, getAll };
}
