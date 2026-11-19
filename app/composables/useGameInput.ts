import { ref, watch, type Ref } from "vue";

import type { CellCoord, Grid } from "../types/sudoku";

import { focusCell, stepCell } from "../utils/gridNav";

// The player's input on the game screen: the numpad, cell taps and the keyboard (a controller's
// buttons arrive as keys). What a digit does to the board is the game's (`input`).
export function useGameInput({
  digitFirst,
  noteTap,
  selectedCell,
  initialBoard,
  currentBoard,
  numberCounts,
  notesMode,
  inGame,
  hasKeys,
  paused,
  finishing,
  act,
}: {
  digitFirst: Ref<boolean>;
  noteTap: Ref<boolean>;
  selectedCell: Ref<CellCoord | null>;
  initialBoard: Ref<Grid>;
  currentBoard: Ref<Grid>;
  numberCounts: Ref<number[]>;
  notesMode: Ref<boolean>;
  /** Still in the game, its detours (a lesson, the Academy) included. */
  inGame: Ref<boolean>;
  /** The game screen has the keys: no modal, sheet, tour or loading lesson over it. */
  hasKeys: () => boolean;
  paused: () => boolean;
  finishing: () => boolean;
  act: {
    input: (num: number) => void;
    erase: () => void;
    undo: () => void;
    redo: () => void;
    hint: () => void;
    autoNotes: () => void;
    history: () => void;
    pause: () => void;
    shortcuts: () => void;
  };
}) {
  // Digit-first input: the numpad arms a digit, and tapping a cell places it. Tapping a given
  // does nothing but select; tapping a cell that already holds the armed digit removes it.
  const activeDigit = ref<number | null>(null);
  // A digit lit up everywhere, its pencil marks too: picked by tapping a pencil mark, or on the
  // numpad or keys outside digit-first. Selecting a cell any other way drops it.
  const pickedDigit = ref<number | null>(null);

  function handleNumpad(num: number) {
    if (digitFirst.value) {
      activeDigit.value = activeDigit.value === num ? null : num;
      pickedDigit.value = null;
      return;
    }
    pickedDigit.value = num;
    act.input(num);
  }

  function handleSelectCell(coord: CellCoord, note?: number) {
    selectedCell.value = coord;
    pickedDigit.value = (noteTap.value && note) || null;
    if (!digitFirst.value || !activeDigit.value || initialBoard.value[coord.r]![coord.c] !== 0)
      return;
    // Only into an empty cell, or onto the armed digit to take it back out: a stray tap on a
    // different entry must not silently replace it (and cost a mistake).
    const held = currentBoard.value[coord.r]![coord.c];
    if (held === 0 || held === activeDigit.value) act.input(activeDigit.value);
  }

  // An armed digit is meaningless once the player leaves the game, turns the mode off, or has
  // placed all nine of it.
  watch([inGame, digitFirst], () => {
    if (!inGame.value || !digitFirst.value) activeDigit.value = null;
    if (!inGame.value) pickedDigit.value = null;
  });
  watch(numberCounts, (counts) => {
    if (activeDigit.value && counts[activeDigit.value]! >= 9) activeDigit.value = null;
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (!hasKeys()) return;
    if (e.key === "?") {
      act.shortcuts();
      return;
    }
    if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey && !finishing()) {
      act.pause();
      return;
    }
    if (paused() || finishing()) return;
    // Browser/OS shortcuts (Cmd+R, Ctrl+A, Cmd+N…) must not trigger game actions; only
    // undo/redo are claimed: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y.
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) act.undo();
      else if ((k === "z" && e.shiftKey) || k === "y") act.redo();
      else return;
      e.preventDefault();
      return;
    }
    if (e.key === "Escape" && (activeDigit.value || pickedDigit.value)) {
      activeDigit.value = pickedDigit.value = null;
      return;
    }
    // Arrows and WASD walk the grid (so auto-fill notes lives on F, not A).
    const to = stepCell(selectedCell.value, e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (to) {
      e.preventDefault();
      focusCell((selectedCell.value = to)); // not handleSelectCell: arrows must never place an armed digit
      pickedDigit.value = null;
      return;
    }
    if (e.key >= "1" && e.key <= "9") {
      if (!digitFirst.value) pickedDigit.value = parseInt(e.key);
      act.input(parseInt(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      act.erase();
    } else if (e.key.toLowerCase() === "n") {
      notesMode.value = !notesMode.value;
    } else if (e.key.toLowerCase() === "h") {
      act.hint();
    } else if (e.key.toLowerCase() === "f") {
      act.autoNotes();
    } else if (e.shiftKey && e.key.toLowerCase() === "z") {
      act.history();
    }
  }

  return { activeDigit, pickedDigit, handleNumpad, handleSelectCell, handleKeyDown };
}
