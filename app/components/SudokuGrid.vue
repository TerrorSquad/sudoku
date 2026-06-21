<script setup lang="ts">
import type { Grid, NotesGrid, CellCoord } from "../types/sudoku";

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
  flashCells: CellCoord[];
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

function isFlashing(r: number, c: number): boolean {
  return props.flashCells.some((cell) => cell.r === r && cell.c === c);
}

function isSameValue(r: number, c: number): boolean {
  if (!props.selectedCell) return false;
  const selVal = props.currentBoard[props.selectedCell.r][props.selectedCell.c];
  return selVal !== 0 && props.currentBoard[r][c] === selVal;
}

function hasConflict(r: number, c: number): boolean {
  return props.conflictCells.some((cell) => cell.r === r && cell.c === c);
}
</script>

<template>
  <div
    class="grid aspect-square w-full grid-cols-9 grid-rows-9 overflow-hidden select-none lg:mx-auto lg:max-w-[calc(100vh-390px)]"
  >
    <template v-for="(row, r) in 9" :key="r">
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
        :is-flashing="isFlashing(r, c)"
        :is-hint-trigger="hintTriggers.some((h) => h.r === r && h.c === c)"
        :is-hint-elimination="hintEliminations.some((h) => h.r === r && h.c === c)"
        @click="emit('select-cell', { r, c })"
      />
    </template>
  </div>
</template>
