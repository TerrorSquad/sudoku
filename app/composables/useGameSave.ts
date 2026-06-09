import { ref, readonly } from 'vue';
import type { Grid, NotesGrid, Difficulty } from '../types/sudoku';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
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

const _hasSave = ref(false);

function recheck(): void {
  _hasSave.value = DIFFICULTIES.some(d => !!localStorage.getItem(saveKey(d)));
}

if (typeof window !== 'undefined') recheck();

export function useGameSave() {
  function save(state: Omit<GameSave, 'savedAt'>): void {
    try {
      const full: GameSave = { ...state, savedAt: Date.now() };
      localStorage.setItem(saveKey(state.difficulty), JSON.stringify(full));
      _hasSave.value = true;
    } catch {
      // quota exceeded — silently ignore
    }
  }

  function loadMostRecent(): GameSave | null {
    const saves = DIFFICULTIES.map(d => {
      const raw = localStorage.getItem(saveKey(d));
      if (!raw) return null;
      try { return JSON.parse(raw) as GameSave; } catch { return null; }
    }).filter(Boolean) as GameSave[];

    if (!saves.length) return null;
    return saves.sort((a, b) => b.savedAt - a.savedAt)[0]!;
  }

  function clearDifficulty(d: Difficulty): void {
    localStorage.removeItem(saveKey(d));
    recheck();
  }

  return { save, loadMostRecent, clearDifficulty, hasSave: readonly(_hasSave) };
}
