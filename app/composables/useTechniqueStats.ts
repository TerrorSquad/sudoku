import { readJSON, writeJSON } from "../utils/safeJson";

const KEY = "sudoku_v1_technique_stats";

export function useTechniqueStats() {
  function getAll(): Record<string, number> {
    return readJSON<Record<string, number>>(KEY, {});
  }

  function record(name: string): void {
    const stats = getAll();
    stats[name] = (stats[name] ?? 0) + 1;
    writeJSON(KEY, stats);
  }

  function getCount(name: string): number {
    return getAll()[name] ?? 0;
  }

  return { record, getCount, getAll };
}
