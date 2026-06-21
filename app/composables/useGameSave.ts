import type { Grid, NotesGrid, Difficulty } from "../types/sudoku";

import { readJSON, writeJSON } from "../utils/safeJson";

const saveKey = (d: Difficulty) => `sudoku_v1_save_${d}`;

export interface GameSave {
  currentBoard: Grid;
  initialBoard: Grid;
  solvedBoard: Grid;
  notesBoard: NotesGrid;
  difficulty: Difficulty;
  timerSeconds: number;
  mistakes: number;
  savedAt: number;
}

export function useGameSave() {
  function save(state: Omit<GameSave, "savedAt">): void {
    writeJSON(saveKey(state.difficulty), { ...state, savedAt: Date.now() });
  }

  function loadDifficulty(d: Difficulty): GameSave | null {
    return readJSON<GameSave | null>(saveKey(d), null);
  }

  function clearDifficulty(d: Difficulty): void {
    localStorage.removeItem(saveKey(d));
  }

  return { save, loadDifficulty, clearDifficulty };
}
