<script setup lang="ts">
import SudokuCell from './SudokuCell.vue';
import type { Grid, NotesGrid, CellCoord } from '../types/sudoku';

const props = defineProps<{
  currentBoard: Grid;
  initialBoard: Grid;
  solvedBoard: Grid;
  notesBoard: NotesGrid;
  selectedCell: CellCoord | null;
  activeHintCell: CellCoord | null; // Novo
  hintTriggers: CellCoord[];         // Novo
  hintEliminations: CellCoord[];     // Novo
  conflictCells: CellCoord[];
  showAllCandidates: boolean;
  dynamicCandidates: number[][][];
}>();

const emit = defineEmits<{
  (e: 'select-cell', coord: CellCoord): void;
}>();

function isCellHighlighted(r: number, c: number): boolean {
  if (!props.selectedCell) return false;
  const { r: selR, c: selC } = props.selectedCell;
  const inSameBox = Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3);
  return r === selR || c === selC || inSameBox;
}

function isSameValue(r: number, c: number): boolean {
  if (!props.selectedCell) return false;
  const selVal = props.currentBoard[props.selectedCell.r][props.selectedCell.c];
  return selVal !== 0 && props.currentBoard[r][c] === selVal;
}

function hasConflict(r: number, c: number): boolean {
  return props.conflictCells.some(cell => cell.r === r && cell.c === c);
}
</script>

<template>
  <div class="relative w-full max-w-[calc(100vh-340px)] aspect-square mx-auto dark:bg-zinc-950 dark:border-zinc-600 bg-zinc-300 border-zinc-400 p-2 border-2 overflow-hidden no-select">
    <div class="grid grid-cols-9 grid-rows-9 h-full w-full gap-[1.5px] dark:bg-zinc-700 bg-zinc-300 overflow-hidden">
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
          :is-selected="selectedCell?.r === r && selectedCell?.c === c || activeHintCell?.r === r && activeHintCell?.c === c"
          :is-highlighted="isCellHighlighted(r, c)"
          :is-same-value="isSameValue(r, c)"
          :notes="notesBoard[r][c]"
          :show-all-candidates="showAllCandidates"
          :dynamic-candidates="dynamicCandidates && dynamicCandidates[r] && dynamicCandidates[r][c] ? dynamicCandidates[r][c] : []"
          :is-hint-trigger="hintTriggers.some(h => h.r === r && h.c === c)"
          :is-hint-elimination="hintEliminations.some(h => h.r === r && h.c === c)"
          @click="emit('select-cell', { r, c })"
        />
      </template>
    </div>
  </div>
</template>