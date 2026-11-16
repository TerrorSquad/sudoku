import type { Grid, NotesGrid, Difficulty, Variant } from "../types/sudoku";
import type { Placement } from "../utils/stuckMoments";

import { saveSlotOf } from "../utils/progressBackup";
import { readJSON, removeJSON, writeJSON } from "../utils/safeJson";

/**
 * One slot per difficulty, plus one per level's Daily (it must not overwrite that level's game):
 * "daily" for Medium's, as it always was, daily_<level> for the rest; x_<level> for X-Sudoku.
 */
export type SaveSlot = Difficulty | "daily" | `daily_${Difficulty}` | `x_${Difficulty}`;
const saveKey = (slot: SaveSlot) => `sudoku_v1_save_${slot}`;
export const dailySlot = (level: Difficulty) =>
  saveSlotOf({ daily: true, difficulty: level }) as SaveSlot;
/** A new game's slot: the level's, or its X-Sudoku one. */
export const gameSlot = (level: Difficulty, variant: Variant) =>
  saveSlotOf({ difficulty: level, variant }) as SaveSlot;

export interface GameSave {
  currentBoard: Grid;
  initialBoard: Grid;
  solvedBoard: Grid;
  notesBoard: NotesGrid;
  difficulty: Difficulty;
  timerSeconds: number;
  mistakes: number;
  /** Optional: saves from before hints were persisted restore as 0. */
  hintsUsed?: number;
  /** Zen game: no timer, mistake limit or score. Older saves restore as false. */
  zen?: boolean;
  /** Set on a Daily: the local date (YYYY-MM-DD) of its puzzle. */
  daily?: string;
  /** "x" for X-Sudoku; older saves and classic games have none. */
  variant?: Variant;
  /** Correct digits with the clock, for "Where you got stuck". Older saves restore as none. */
  placements?: Placement[];
  savedAt: number;
}

export function useGameSave() {
  function save(state: Omit<GameSave, "savedAt">): void {
    writeJSON(saveKey(saveSlotOf(state) as SaveSlot), { ...state, savedAt: Date.now() });
  }

  function loadDifficulty(d: SaveSlot): GameSave | null {
    return readJSON<GameSave | null>(saveKey(d), null);
  }

  function clearDifficulty(d: SaveSlot): void {
    removeJSON(saveKey(d));
  }

  return { save, loadDifficulty, clearDifficulty };
}
