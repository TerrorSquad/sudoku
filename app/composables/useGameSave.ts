import { ref, readonly } from "vue";

import type { Grid, NotesGrid, Difficulty } from "../types/sudoku";

import { readJSON, writeJSON } from "../utils/safeJson";

const DIFFICULTIES = ["beginner", "easy", "medium", "hard", "expert", "master"] as const;
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
  _hasSave.value = DIFFICULTIES.some((d) => !!localStorage.getItem(saveKey(d)));
}

if (typeof window !== "undefined") recheck();

export function useGameSave() {
  function save(state: Omit<GameSave, "savedAt">): void {
    const full: GameSave = { ...state, savedAt: Date.now() };
    if (writeJSON(saveKey(state.difficulty), full)) _hasSave.value = true;
  }

  function loadMostRecent(): GameSave | null {
    const saves = DIFFICULTIES.map((d) => readJSON<GameSave | null>(saveKey(d), null)).filter(
      Boolean,
    ) as GameSave[];

    if (!saves.length) return null;
    return saves.sort((a, b) => b.savedAt - a.savedAt)[0]!;
  }

  function clearDifficulty(d: Difficulty): void {
    localStorage.removeItem(saveKey(d));
    recheck();
  }

  return { save, loadMostRecent, clearDifficulty, hasSave: readonly(_hasSave) };
}
