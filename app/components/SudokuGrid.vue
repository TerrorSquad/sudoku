<script setup lang="ts">
import type { Grid, NotesGrid, CellCoord, FlashCell } from "../types/sudoku";

import SudokuCell from "./SudokuCell.vue";

const props = defineProps<{
  currentBoard: Grid;
  initialBoard: Grid;
  solvedBoard: Grid;
  notesBoard: NotesGrid;
  selectedCell: CellCoord | null;
  activeHintCell: CellCoord | null; // Novo
  hintTriggers: CellCoord[]; // Novo
  hintEliminations: CellCoord[]; // Novo
  conflictCells: CellCoord[];
  colorMode: boolean;
  flashCells: FlashCell[];
  showErrors: boolean;
  /** Digit-first input: highlights this digit and where it can still go. */
  activeDigit?: number | null;
  /** "Nudge first" hints: any cell of the 3x3 box to point at. */
  nudgeBox?: CellCoord | null;
}>();

const emit = defineEmits<{
  (e: "select-cell", coord: CellCoord): void;
}>();

function isCellHighlighted(r: number, c: number): boolean {
  if (!props.selectedCell) return false;
  const { r: selR, c: selC } = props.selectedCell;
  const inSameBox =
    Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3);
  return r === selR || c === selC || inSameBox;
}

function flashFor(r: number, c: number): FlashCell | undefined {
  return props.flashCells.find((cell) => cell.r === r && cell.c === c);
}

function isSameValue(r: number, c: number): boolean {
  if (props.activeDigit) return props.currentBoard[r]![c] === props.activeDigit;
  if (!props.selectedCell) return false;
  const selVal = props.currentBoard[props.selectedCell.r][props.selectedCell.c];
  return selVal !== 0 && props.currentBoard[r][c] === selVal;
}

// An empty cell where the armed digit doesn't already appear in its row, column or box.
function isCandidate(r: number, c: number): boolean {
  const d = props.activeDigit;
  if (!d || props.currentBoard[r]![c] !== 0) return false;
  const b = props.currentBoard;
  for (let i = 0; i < 9; i++) if (b[r]![i] === d || b[i]![c] === d) return false;
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) if (b[br + i]![bc + j] === d) return false;
  return true;
}

function isNudged(r: number, c: number): boolean {
  const n = props.nudgeBox;
  return (
    !!n && Math.floor(n.r / 3) === Math.floor(r / 3) && Math.floor(n.c / 3) === Math.floor(c / 3)
  );
}

function hasConflict(r: number, c: number): boolean {
  return props.conflictCells.some((cell) => cell.r === r && cell.c === c);
}
</script>

<template>
  <div
    role="grid"
    :aria-label="$t('a11y.board')"
    class="grid aspect-square w-full grid-cols-9 grid-rows-9 overflow-hidden border-2 border-zinc-700 select-none lg:mx-auto lg:max-w-[calc(100vh-300px)] dark:border-zinc-400"
  >
    <!-- display: contents keeps the visual grid flat while giving screen readers real rows. -->
    <div v-for="(row, r) in 9" :key="r" role="row" class="contents">
      <SudokuCell
        v-for="(col, c) in 9"
        :key="`${r}-${c}`"
        :row="r"
        :col="c"
        :value="currentBoard[r][c]"
        :is-initial="initialBoard[r][c] !== 0"
        :is-correct="currentBoard[r][c] === solvedBoard[r][c]"
        :has-conflict="hasConflict(r, c)"
        :is-selected="
          (selectedCell?.r === r && selectedCell?.c === c) ||
          (activeHintCell?.r === r && activeHintCell?.c === c)
        "
        :is-highlighted="isCellHighlighted(r, c)"
        :is-same-value="isSameValue(r, c)"
        :notes="notesBoard[r][c]"
        :color-mode="colorMode"
        :is-flashing="!!flashFor(r, c)"
        :flash-delay="flashFor(r, c)?.delay ?? 0"
        :show-errors="showErrors"
        :is-candidate="isCandidate(r, c)"
        :is-nudged="isNudged(r, c)"
        :tab-stop="selectedCell ? selectedCell.r === r && selectedCell.c === c : r === 0 && c === 0"
        :is-hint-trigger="hintTriggers.some((h) => h.r === r && h.c === c)"
        :is-hint-elimination="hintEliminations.some((h) => h.r === r && h.c === c)"
        @click="emit('select-cell', { r, c })"
      />
    </div>
  </div>
</template>
