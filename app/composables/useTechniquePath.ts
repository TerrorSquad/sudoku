import type { TechniqueId } from "../utils/sudokuGrader";

import { BASICS_KEY, mergeBasics, readBasics, type BasicsId } from "../utils/basics";
import {
  ACADEMY_TECHNIQUES,
  LESSON_STARS_KEYS,
  completesChallenge,
  mergeStars,
  readStars,
  type Level,
  type Stars,
} from "../utils/progression";
import {
  REVIEW_KEY,
  lessonCard,
  readReview,
  reviewCard,
  withLearned,
  type Card,
} from "../utils/review";
import { readJSON, writeJSON } from "../utils/safeJson";
import { localDateKey } from "../utils/streak";

// All under sudoku_v1_, so they back up and cloud-sync with the rest of the progress.
const PATH_KEY = "sudoku_v1_technique_path";
const WEEKLY_KEY = "sudoku_v1_weekly_done";

export function useTechniquePath() {
  /** Completed path challenges, in the order they were completed. */
  function getDone(): string[] {
    const v = readJSON<unknown>(PATH_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }

  /** How many of the path's techniques are done. */
  function pathDone(): number {
    const done = getDone();
    return ACADEMY_TECHNIQUES.filter((tech) => done.includes(tech.id)).length;
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

  /** Each lesson's best stars at `level` (a cloud sync max-merges them, see cloudSync's mergedBests). */
  const getStars = (level: Level = 1) => readStars(readJSON<unknown>(LESSON_STARS_KEYS[level], {}));

  /** Keeps the better of `stars` and the stored best; returns the best before this lesson. */
  function recordStars(id: TechniqueId, stars: Stars, level: Level = 1): Stars | undefined {
    // Merged into the raw entry, so entries this version can't read survive.
    const key = LESSON_STARS_KEYS[level];
    const stored = readJSON<unknown>(key, {});
    writeJSON(key, mergeStars(stored, { [id]: stars }));
    return readStars(stored)[id];
  }

  /** The level a lesson opens at: the first not finished yet, else on your own. */
  const lessonLevel = (id: TechniqueId): Level =>
    ([1, 2] as const).find((n) => !getStars(n)[id]) ?? 3;

  /** The "How to play" lessons finished (the path's step 0). */
  const getBasics = () => readBasics(readJSON<unknown>(BASICS_KEY, []));
  function recordBasics(id: BasicsId) {
    // Merged into the raw entry, so a later version's lessons survive.
    writeJSON(BASICS_KEY, mergeBasics(readJSON<unknown>(BASICS_KEY, []), [id]));
  }

  /**
   * The review schedule, with every technique whose lesson was finished (the path's, or any with
   * stars) on it: one finished before review existed is due today.
   */
  function getReview() {
    const learned = [...getDone(), ...Object.keys(getStars())];
    return withLearned(readReview(readJSON<unknown>(REVIEW_KEY, {})), learned, localDateKey());
  }
  /** Writes one card into the raw entry, so a later version's cards survive. */
  function writeCard(id: TechniqueId, card: Card) {
    const raw = readJSON<unknown>(REVIEW_KEY, {});
    const rest = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    writeJSON(REVIEW_KEY, { ...rest, [id]: card });
  }
  /** A finished lesson: its technique comes up for review tomorrow (if not scheduled already). */
  function scheduleReview(id: TechniqueId) {
    if (!readReview(readJSON<unknown>(REVIEW_KEY, {}))[id])
      writeCard(id, lessonCard(undefined, localDateKey()));
  }
  /** A review's outcome; returns the card after it. */
  function recordReview(id: TechniqueId, passed: boolean): Card {
    const after = reviewCard(getReview()[id], passed, localDateKey());
    writeCard(id, after);
    return after;
  }

  return {
    getReview,
    scheduleReview,
    recordReview,
    getDone,
    pathDone,
    recordLesson,
    getWeeksDone,
    markWeekDone,
    getStars,
    recordStars,
    lessonLevel,
    getBasics,
    recordBasics,
  };
}
