<script setup lang="ts">
import { computed } from "vue";
import type { CellCoord } from "../types/sudoku";

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
  showAllCandidates: boolean;
  dynamicCandidates: number[];
  isHintTrigger: boolean,
isHintElimination: boolean
}>();

defineEmits<{
  (e: "click"): void;
}>();

// Dinamičke klase za Genina stil (oštre ivice, debeli 3x3 borderi)
const cellClasses = computed(() => {
  return {
    "sudoku-border-r": props.col === 2 || props.col === 5,
    "sudoku-border-b": props.row === 2 || props.row === 5,
    "text-zinc-350 font-black": props.isInitial,
    "text-violet-400":
      !props.isInitial && props.value !== 0 && props.isCorrect && !props.hasConflict,
    "text-rose-500 bg-rose-950/20":
      !props.isInitial && props.value !== 0 && (!props.isCorrect || props.hasConflict),
    "bg-zinc-800/40": props.isHighlighted && !props.isSelected,
    "bg-violet-900/15": props.isSameValue && props.value !== 0 && !props.isSelected,
    "bg-zinc-800 ring-2 ring-violet-500 z-10": props.isSelected && !props.hasConflict,
    "bg-zinc-800 ring-2 ring-rose-500 z-10": props.isSelected && props.hasConflict,
    'bg-indigo-500/30 ring-1 ring-indigo-400 z-10': props.isHintTrigger,
'bg-rose-500/30 ring-1 ring-rose-400 z-10': props.isHintElimination,
  };
});
</script>

<template>
  <div
    @click="$emit('click')"
    :class="cellClasses"
    class="relative aspect-square flex items-center justify-center text-3xl font-bold bg-[#141417] border border-zinc-800 cursor-pointer transition-all duration-100 p-0.5 no-select"
  >
    <span v-if="value !== 0">{{ value }}</span>

    <div
      v-else-if="showAllCandidates"
      class="absolute inset-0.5 grid grid-cols-3 grid-rows-3 gap-[1px] text-[10px] font-semibold text-zinc-500"
    >
      <div v-for="n in 9" :key="n" class="flex items-center justify-center leading-none">
        <span :class="{ 'text-amber-400 font-black': dynamicCandidates.includes(n) }">
          {{ dynamicCandidates.includes(n) ? n : "" }}
        </span>
      </div>
    </div>

    <div
      v-else
      class="absolute inset-0.5 grid grid-cols-3 grid-rows-3 gap-[1px] text-[10px] font-black text-zinc-500"
    >
      <div v-for="n in 9" :key="n" class="flex items-center justify-center leading-none">
        <span>{{ notes[n] ? n : "" }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sudoku-border-r {
  border-right: 3px solid #9ca3af !important;
}
.sudoku-border-b {
  border-bottom: 3px solid #9ca3af !important;
}
</style>
