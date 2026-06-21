<script setup lang="ts">
interface Cell {
  r: number;
  c: number;
}

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
  const isTarget = props.target?.some((p) => p.r === r && p.c === c);
  const isTrigger = props.trigger?.some((p) => p.r === r && p.c === c);
  const isElim = props.elimination?.some((p) => p.r === r && p.c === c);
  return {
    "border-r-2 border-r-zinc-400": c === 2 || c === 5,
    "border-b-2 border-b-zinc-400": r === 2 || r === 5,
    "bg-emerald-500/20 ring-1 ring-emerald-500 z-10": isTarget,
    "bg-indigo-500/30 ring-1 ring-indigo-400 z-10": isTrigger,
    "bg-rose-500/30 ring-1 ring-rose-400 z-10": isElim,
  };
}
</script>

<template>
  <div
    class="mx-auto grid w-full max-w-[280px] grid-cols-9 border-2 border-zinc-400 bg-zinc-100 select-none dark:border-zinc-600 dark:bg-[#141417]"
  >
    <template v-for="(row, r) in board" :key="r">
      <div
        v-for="(val, c) in row"
        :key="c"
        :class="cellClass(r, c)"
        class="relative flex aspect-square items-center justify-center border border-zinc-300 font-game text-sm font-bold text-zinc-800 sm:text-base dark:border-zinc-800 dark:text-zinc-200"
      >
        <span v-if="val !== 0">{{ val }}</span>
        <div
          v-else-if="candidates(r, c).length"
          class="absolute inset-0.5 grid grid-cols-3 grid-rows-3 font-game text-[7px] leading-none font-semibold text-amber-700 sm:text-[8px] dark:text-amber-400"
        >
          <div v-for="n in 9" :key="n" class="flex items-center justify-center">
            {{ candidates(r, c).includes(n) ? n : "" }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
