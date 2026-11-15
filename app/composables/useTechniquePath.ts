import type { TechniqueId } from "../utils/sudokuGrader";

import { BASICS_KEY, mergeBasics, readBasics, type BasicsId } from "../utils/basics";
import {
  LESSON_STARS_KEY,
  completesChallenge,
  mergeStars,
  readStars,
  type Stars,
} from "../utils/progression";
import { readJSON, writeJSON } from "../utils/safeJson";

// All under sudoku_v1_, so they back up and cloud-sync with the rest of the progress.
const PATH_KEY = "sudoku_v1_technique_path";
const WEEKLY_KEY = "sudoku_v1_weekly_done";

export function useTechniquePath() {
  /** Completed path challenges, in the order they were completed. */
  function getDone(): string[] {
    const v = readJSON<unknown>(PATH_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }

  /** Records a finished lesson; true when it completed the current challenge. */
  function recordLesson(id: TechniqueId): boolean {
    const done = getDone();
    if (!completesChallenge(id, done)) return false;
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

  /** Each lesson's best stars (a cloud sync max-merges them, see cloudSync's mergedBests). */
  const getStars = () => readStars(readJSON<unknown>(LESSON_STARS_KEY, {}));

  /** Keeps the better of `stars` and the stored best; returns the best before this lesson. */
  function recordStars(id: TechniqueId, stars: Stars): Stars | undefined {
    // Merged into the raw entry, so entries this version can't read survive.
    const stored = readJSON<unknown>(LESSON_STARS_KEY, {});
    writeJSON(LESSON_STARS_KEY, mergeStars(stored, { [id]: stars }));
    return readStars(stored)[id];
  }

  /** The "How to play" lessons finished (the path's step 0). */
  const getBasics = () => readBasics(readJSON<unknown>(BASICS_KEY, []));
  function recordBasics(id: BasicsId) {
    // Merged into the raw entry, so a later version's lessons survive.
    writeJSON(BASICS_KEY, mergeBasics(readJSON<unknown>(BASICS_KEY, []), [id]));
  }

  return {
    getDone,
    recordLesson,
    getWeeksDone,
    markWeekDone,
    getStars,
    recordStars,
    getBasics,
    recordBasics,
  };
}
