import type { TechniqueId } from "../utils/sudokuGrader";

import { readJSON, writeJSON } from "../utils/safeJson";

const KEY = "sudoku_v1_technique_stats";

// Counts used to be keyed by the hint title in the player's language at the time, so switching
// language split them. Every title ever stored (per git history) is one of these base names, in
// any case, optionally followed by " — <unit or type>" ("Hidden Single — Row", "Goli Triplet —
// Red 3", "Unique Rectangle — Type 1"). Frozen: new counts use ids. Titles of techniques the
// solver no longer has (XY-Chain, Sue de Coq…) have no id and are kept as they are.
const LEGACY_TITLES: Record<string, TechniqueId> = {
  "naked single": "naked-single",
  "goli singl": "naked-single",
  "hidden single": "hidden-single",
  "skriveni singl": "hidden-single",
  "pointing pair": "pointing",
  "pokazujući par": "pointing",
  "box-line reduction": "box-line",
  "redukcija kvadrat-linija": "box-line",
  "redukcija kvadrant-linija": "box-line",
  "naked pair": "naked-pair",
  "goli par": "naked-pair",
  "hidden pair": "hidden-pair",
  "skriveni par": "hidden-pair",
  "naked triple": "naked-triple",
  "goli tripl": "naked-triple",
  "goli triplet": "naked-triple",
  "hidden triple": "hidden-triple",
  "skriveni tripl": "hidden-triple",
  "skriveni triplet": "hidden-triple",
  "naked quad": "naked-quad",
  "goli kvadrupl": "naked-quad",
  "hidden quad": "hidden-quad",
  "skriveni kvadrupl": "hidden-quad",
  "x-wing": "x-wing",
  swordfish: "swordfish",
  sabljarka: "swordfish",
  jellyfish: "jellyfish",
  meduza: "jellyfish",
  "xy-wing": "xy-wing",
  "xyz-wing": "xyz-wing",
  skyscraper: "skyscraper",
  neboder: "skyscraper",
  "2-string kite": "two-string-kite",
  "two-string kite": "two-string-kite",
  "zmaj sa dva konca": "two-string-kite",
  "unique rectangle": "unique-rectangle",
  "jedinstveni pravougaonik": "unique-rectangle",
  "simple coloring": "simple-coloring",
  "jednostavno bojenje": "simple-coloring",
  "finned x-wing": "finned-x-wing",
  "x-wing sa perajem": "finned-x-wing",
  "w-wing": "w-wing",
  "bug+1": "bug-plus-one",
  "empty rectangle": "empty-rectangle",
  "prazan pravougaonik": "empty-rectangle",
};

/** The id a stored key stands for: itself unless it's a legacy title. */
function idOf(key: string): string {
  const base = key.split(" — ")[0]!.toLowerCase();
  return Object.hasOwn(LEGACY_TITLES, base) ? LEGACY_TITLES[base]! : key;
}

/** Re-keys title-keyed counts by technique id, summing languages; unknown keys are kept as-is. */
export function migrateTechniqueStats(stats: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(stats)) {
    const id = idOf(key);
    out[id] = (out[id] ?? 0) + n;
  }
  return out;
}

export function useTechniqueStats() {
  function getAll(): Record<string, number> {
    const stored = readJSON<Record<string, number>>(KEY, {});
    if (Object.keys(stored).every((k) => idOf(k) === k)) return stored;
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
