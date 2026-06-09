import { ref, readonly } from 'vue';
import type { Grid, NotesGrid, Difficulty } from '../types/sudoku';

const SAVE_KEY = 'sudoku_v1_save';

export interface GameSave {
  currentBoard: Grid;
  initialBoard: Grid;
  solvedBoard: Grid;
  notesBoard: NotesGrid;
  difficulty: Difficulty;
  timerSeconds: number;
  mistakes: number;
}

// Module-level ref so hasSave is reactive across the whole app
const _hasSave = ref(typeof window !== 'undefined' && !!localStorage.getItem(SAVE_KEY));

export function useGameSave() {
  function save(state: GameSave): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      _hasSave.value = true;
    } catch {
      // localStorage quota exceeded or unavailable — silently ignore
    }
  }

  function load(): GameSave | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as GameSave;
    } catch {
      return null;
    }
  }

  function clear(): void {
    localStorage.removeItem(SAVE_KEY);
    _hasSave.value = false;
  }

  return { save, load, clear, hasSave: readonly(_hasSave) };
}
