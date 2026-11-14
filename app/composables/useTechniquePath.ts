import type { TechniqueId } from "../utils/sudokuGrader";

import { completesChallenge } from "../utils/progression";
import { readJSON, writeJSON } from "../utils/safeJson";

// Both under sudoku_v1_, so they back up and cloud-sync with the rest of the progress.
const PATH_KEY = "sudoku_v1_technique_path";
const WEEKLY_KEY = "sudoku_v1_weekly_done";

export function useTechniquePath() {
  /** Completed path challenges, in the order they were completed. */
  function getDone(): string[] {
    const v = readJSON<unknown>(PATH_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }

  /** Records a practice win; true when it completed the current challenge. */
  function recordWin(id: TechniqueId, kind: "puzzle" | "drill"): boolean {
    const done = getDone();
    if (!completesChallenge(id, kind, done)) return false;
    writeJSON(PATH_KEY, [...done, id]);
    return true;
  }

  /** ISO weeks (e.g. "2026-W46") whose technique-of-the-week puzzle was won. */
  function getWeeksDone(): string[] {
    const v = readJSON<unknown>(WEEKLY_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }

  /** True the first time `week`'s puzzle is won. */
  function markWeekDone(week: string): boolean {
    const weeks = getWeeksDone();
    if (weeks.includes(week)) return false;
    writeJSON(WEEKLY_KEY, [...weeks, week]);
    return true;
  }

  return { getDone, recordWin, getWeeksDone, markWeekDone };
}
