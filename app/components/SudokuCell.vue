<script setup lang="ts">
import { computed } from "vue";

import type { CellCoord } from "../types/sudoku";

import { SUDOKU_COLORS } from "../utils/sudokuColors";

const props = defineProps<{
  row: number;
  col: number;
  value: number;
  isInitial: boolean;
  isCorrect: boolean;
  hasConflict: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isSameValue: boolean;
  notes: boolean[];
  isHintTrigger: boolean;
  isHintElimination: boolean;
  colorMode: boolean;
}>();

defineEmits<{
  (e: "click"): void;
}>();

// A player entry that's wrong (conflict or not matching the solution) shakes
// instead of popping, for immediate tactile feedback on a mistake.
const isWrong = computed(
  () => props.value !== 0 && !props.isInitial && (!props.isCorrect || props.hasConflict),
);

// Dinamičke klase za Genina stil (oštre ivice, 3x3 borderi blago naglašeni)
const cellClasses = computed(() => {
  return {
    "border-l": props.col === 0,
    "border-t": props.row === 0,
    "border-r": props.col !== 2 && props.col !== 5,
    "border-r-2": props.col === 2 || props.col === 5,
    "border-b": props.row !== 2 && props.row !== 5,
    "border-b-2": props.row === 2 || props.row === 5,
    "dark:text-zinc-100 text-zinc-900 font-bold": props.isInitial,
    "dark:text-violet-300 text-violet-600 font-semibold":
      !props.isInitial && props.value !== 0 && props.isCorrect && !props.hasConflict,
    "dark:text-rose-400 text-rose-600 dark:!bg-rose-950/20 !bg-rose-100":
      !props.isInitial && props.value !== 0 && (!props.isCorrect || props.hasConflict),
    "dark:bg-zinc-800/40 bg-zinc-300/50 dark:border-zinc-400 border-zinc-600":
      props.isHighlighted && !props.isSelected,
    "!bg-violet-900/20": props.isSameValue && props.value !== 0 && !props.isSelected,
    "dark:!bg-violet-950/60 !bg-violet-200 ring-2 dark:ring-violet-400 ring-violet-600 z-10":
      props.isSelected && !props.hasConflict,
    "dark:!bg-rose-950/50 !bg-rose-200 ring-2 dark:ring-rose-500 ring-rose-600 z-10":
      props.isSelected && props.hasConflict,
    "!bg-indigo-500/30 ring-1 ring-indigo-400 z-10": props.isHintTrigger,
    "!bg-rose-500/30 ring-1 ring-rose-400 z-10": props.isHintElimination,
  };
});
</script>

<template>
  <div
    @click="$emit('click')"
    :class="cellClasses"
    class="no-select relative flex cursor-pointer items-center justify-center border-zinc-400 bg-zinc-100 p-0.5 text-3xl font-bold transition-all duration-100 3xl:text-4xl dark:border-zinc-600 dark:bg-[#141417]"
  >
    <div
      v-if="value !== 0 && colorMode"
      :key="value"
      :class="[SUDOKU_COLORS[value], isWrong ? 'cell-shake' : 'cell-pop']"
      class="h-[60%] w-[60%] rounded-full"
    />
    <span
      v-else-if="value !== 0"
      :key="value"
      class="font-game"
      :class="isWrong ? 'cell-shake' : 'cell-pop'"
      >{{ value }}</span
    >

    <div
      v-else
      class="absolute inset-0.5 grid grid-cols-3 grid-rows-3 gap-px font-game text-[10px] font-black text-zinc-600 3xl:text-[13px] dark:text-zinc-400"
    >
      <div v-for="n in 9" :key="n" class="flex items-center justify-center leading-none">
        <span>{{ notes[n] ? n : "" }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes cell-pop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  60% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.cell-pop {
  animation: cell-pop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes cell-shake {
  0% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-4px);
  }
  40% {
    transform: translateX(4px);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(2px);
  }
  100% {
    transform: translateX(0);
  }
}
.cell-shake {
  animation: cell-shake 0.32s ease-in-out both;
}
</style>
