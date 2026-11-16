<script setup lang="ts">
import type { Mark } from "../utils/patternMarks";

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
  /** Thumbnail for card previews: tiny digits, no pencil notes. */
  mini?: boolean;
  /** The pattern drawn in pen over the board. */
  marks?: Mark[];
  /** Pencil marks of these digits stand out (Watch it: the digits to look at). */
  digits?: number[];
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
    :class="mini ? 'max-w-[6.5rem]' : 'max-w-[17.5rem]'"
    class="relative mx-auto grid w-full grid-cols-9 border-2 border-zinc-400 bg-zinc-100 select-none dark:border-zinc-600 dark:bg-zinc-900"
  >
    <template v-for="(row, r) in board" :key="r">
      <div
        v-for="(val, c) in row"
        :key="c"
        class="relative flex aspect-square items-center justify-center border border-zinc-300 font-game font-bold text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
        :class="[cellClass(r, c), mini ? 'text-[0.4375rem]' : 'text-sm sm:text-base']"
      >
        <span v-if="val !== 0">{{ val }}</span>
        <div
          v-else-if="!mini && candidates(r, c).length"
          class="absolute inset-0.5 grid grid-cols-3 grid-rows-3 font-game text-[0.4375rem] leading-none font-semibold text-amber-700 sm:text-[0.5rem] dark:text-amber-400"
        >
          <div
            v-for="n in 9"
            :key="n"
            :class="
              digits?.includes(n) &&
              'font-black text-violet-700 underline decoration-2 dark:text-violet-300'
            "
            class="flex items-center justify-center"
          >
            {{ candidates(r, c).includes(n) ? n : "" }}
          </div>
        </div>
      </div>
    </template>
    <PatternOverlay v-if="marks?.length" :marks="marks" />
  </div>
</template>

<!-- Trigger and elimination cells pulse, so the pattern reads at a glance. -->
<style scoped>
@keyframes trigger-glow {
  0%,
  100% {
    background-color: rgba(99, 102, 241, 0.25);
    box-shadow: inset 0 0 10px rgba(99, 102, 241, 0.4);
  }
  50% {
    background-color: rgba(99, 102, 241, 0.5);
    box-shadow: inset 0 0 18px rgba(99, 102, 241, 0.8);
  }
}
@keyframes elimination-blink {
  0%,
  100% {
    background-color: rgba(244, 63, 94, 0.2);
    box-shadow: inset 0 0 8px rgba(244, 63, 94, 0.3);
  }
  50% {
    background-color: rgba(244, 63, 94, 0.55);
    box-shadow: inset 0 0 16px rgba(244, 63, 94, 0.7);
  }
}
.bg-indigo-500\/30 {
  animation: trigger-glow 1.2s infinite ease-in-out !important;
}
.bg-rose-500\/30 {
  animation: elimination-blink 1.2s infinite ease-in-out !important;
}
</style>
