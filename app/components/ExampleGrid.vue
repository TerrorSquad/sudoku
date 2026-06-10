<script setup lang="ts">
interface Cell { r: number; c: number; }

const props = defineProps<{
  board: number[][];
  notes?: Record<string, number[]>;
  target?: Cell[];
  trigger?: Cell[];
  elimination?: Cell[];
}>();

function noteKey(r: number, c: number) {
  return `${r}-${c}`;
}

function candidates(r: number, c: number): number[] {
  return props.notes?.[noteKey(r, c)] ?? [];
}

function cellClass(r: number, c: number) {
  const isTarget = props.target?.some(p => p.r === r && p.c === c);
  const isTrigger = props.trigger?.some(p => p.r === r && p.c === c);
  const isElim = props.elimination?.some(p => p.r === r && p.c === c);
  return {
    'sudoku-border-r': c === 2 || c === 5,
    'sudoku-border-b': r === 2 || r === 5,
    'bg-emerald-500/20 ring-1 ring-emerald-500 z-10': isTarget,
    'bg-indigo-500/30 ring-1 ring-indigo-400 z-10': isTrigger,
    'bg-rose-500/30 ring-1 ring-rose-400 z-10': isElim,
  };
}
</script>

<template>
  <div class="grid grid-cols-9 w-full max-w-[280px] mx-auto border-2 select-none dark:bg-[#141417] dark:border-zinc-600 bg-zinc-100 border-zinc-400">
    <template v-for="(row, r) in board" :key="r">
      <div
        v-for="(val, c) in row"
        :key="c"
        :class="cellClass(r, c)"
        class="relative aspect-square flex items-center justify-center border text-sm sm:text-base font-bold font-game dark:border-zinc-800 dark:text-zinc-200 border-zinc-300 text-zinc-800"
      >
        <span v-if="val !== 0">{{ val }}</span>
        <div
          v-else-if="candidates(r, c).length"
          class="absolute inset-0.5 grid grid-cols-3 grid-rows-3 text-[7px] sm:text-[8px] font-semibold text-amber-400 font-game leading-none"
        >
          <div v-for="n in 9" :key="n" class="flex items-center justify-center">
            {{ candidates(r, c).includes(n) ? n : '' }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sudoku-border-r {
  border-right: 3px solid #a1a1aa !important;
}
.sudoku-border-b {
  border-bottom: 3px solid #a1a1aa !important;
}
</style>
