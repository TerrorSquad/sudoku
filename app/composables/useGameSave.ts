import type { Grid, NotesGrid, Difficulty } from "../types/sudoku";

import { readJSON, writeJSON } from "../utils/safeJson";

/** One slot per difficulty, plus the Daily's own (it plays as medium but must not overwrite it). */
export type SaveSlot = Difficulty | "daily";
const saveKey = (slot: SaveSlot) => `sudoku_v1_save_${slot}`;

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
  savedAt: number;
}

export function useGameSave() {
  function save(state: Omit<GameSave, "savedAt">): void {
    writeJSON(saveKey(state.daily ? "daily" : state.difficulty), { ...state, savedAt: Date.now() });
  }

  function loadDifficulty(d: SaveSlot): GameSave | null {
    return readJSON<GameSave | null>(saveKey(d), null);
  }

  function clearDifficulty(d: SaveSlot): void {
    localStorage.removeItem(saveKey(d));
  }

  return { save, loadDifficulty, clearDifficulty };
}
