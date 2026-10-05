<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type { CellCoord } from "../types/sudoku";

import { digitLabel, dotClass } from "../utils/sudokuColors";

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
  isFlashing: boolean;
  flashDelay?: number;
  showErrors: boolean;
  /** Digit-first input: the armed digit could still go here. */
  isCandidate?: boolean;
  /** The single Tab stop in the grid: the selected cell, or the first when nothing is selected. */
  tabStop: boolean;
}>();

defineEmits<{
  (e: "click"): void;
}>();

// A player entry that's wrong (conflict or not matching the solution) shakes
// instead of popping, for immediate tactile feedback on a mistake.
// With "Highlight mistakes" off nothing is marked wrong, visually or to screen readers.
const isWrong = computed(
  () =>
    props.showErrors &&
    props.value !== 0 &&
    !props.isInitial &&
    (!props.isCorrect || props.hasConflict),
);

// A wrong or conflicting player entry keeps its red treatment while selected.
const { t } = useI18n();

// The diagonal "print-in" plays once on mount. Dropping the class afterwards matters: a later
// flash/shake would otherwise restart it, and its inline delay would leak into those animations.
const entering = ref(true);
function onAnimationEnd(e: AnimationEvent) {
  // animationend bubbles from the digit's own pop/shake; only the cell's entrance counts.
  if (e.target === e.currentTarget && e.animationName.startsWith("cell-in")) entering.value = false;
}
// animationend never fires if the cell mounts hidden or the screen transition is interrupted.
onMounted(() => setTimeout(() => (entering.value = false), 1500));

// Screen-reader description: position, state and value (colour name in colour mode), plus notes.
const label = computed(() => {
  const pos = t("a11y.cellPos", { r: props.row + 1, c: props.col + 1 });
  if (props.value !== 0) {
    const v = digitLabel(props.value, props.colorMode, t);
    const kind = props.isInitial
      ? t("a11y.cellGiven", { v })
      : isBad.value
        ? t("a11y.cellWrong", { v })
        : t("a11y.cellEntry", { v });
    return `${pos}, ${kind}`;
  }
  const marks = props.notes
    .map((on, n) => (on ? digitLabel(n, props.colorMode, t) : ""))
    .filter(Boolean);
  return marks.length
    ? `${pos}, ${t("a11y.cellNotes", { notes: marks.join(", ") })}`
    : `${pos}, ${t("a11y.cellEmpty")}`;
});

const isBad = computed(() => isWrong.value || (props.showErrors && props.hasConflict));

// Dinamičke klase za Genina stil (oštre ivice, 3x3 borderi blago naglašeni)
const cellClasses = computed(() => {
  return {
    "border-l": props.col === 0,
    "border-t": props.row === 0,
    "border-r": props.col !== 2 && props.col !== 5,
    "border-r-2 border-r-zinc-600 dark:border-r-zinc-400": props.col === 2 || props.col === 5,
    "border-b": props.row !== 2 && props.row !== 5,
    "border-b-2 border-b-zinc-600 dark:border-b-zinc-400": props.row === 2 || props.row === 5,
    "dark:text-zinc-100 text-zinc-900 font-bold": props.isInitial,
    "dark:text-violet-300 text-violet-600 font-semibold":
      !props.isInitial && props.value !== 0 && !isWrong.value,
    "dark:text-rose-300 text-rose-600 dark:!bg-rose-900/40 !bg-rose-100": isWrong.value,
    "dark:bg-zinc-700/60 bg-zinc-200 dark:border-zinc-400 border-zinc-600":
      props.isHighlighted && !props.isSelected,
    "dark:!bg-violet-500/35 !bg-violet-200 ring-1 ring-inset dark:ring-violet-400/70 ring-violet-400":
      props.isSameValue && props.value !== 0 && !props.isSelected,
    "dark:!bg-amber-400/30 !bg-amber-200 ring-[3px] dark:ring-amber-300 ring-amber-500 z-10":
      props.isSelected && !isBad.value,
    "dark:!bg-rose-800/60 !bg-rose-200 ring-[3px] dark:ring-rose-400 ring-rose-600 z-10":
      props.isSelected && isBad.value,
    "!bg-indigo-500/30 ring-1 ring-indigo-400 z-10": props.isHintTrigger,
    "!bg-rose-500/30 ring-1 ring-rose-400 z-10": props.isHintElimination,
    "ring-1 ring-inset ring-violet-400/50 !bg-violet-500/10":
      props.isCandidate && !props.isSelected,
    "cell-flash": props.isFlashing,
    "cell-in": entering.value,
  };
});
</script>

<template>
  <div
    role="gridcell"
    :aria-label="label"
    :aria-selected="isSelected"
    :tabindex="tabStop ? 0 : -1"
    :data-cell="`${row}-${col}`"
    :style="
      isFlashing
        ? { animationDelay: `${flashDelay ?? 0}ms` }
        : entering
          ? { animationDelay: `${(row + col) * 22}ms` }
          : undefined
    "
    @animationend="onAnimationEnd"
    @click="$emit('click')"
    :class="cellClasses"
    class="relative flex cursor-pointer items-center justify-center border-zinc-400 bg-zinc-100 p-0.5 text-3xl font-bold transition-all duration-100 select-none 3xl:text-4xl dark:border-zinc-600 dark:bg-[#131b24]"
  >
    <div
      v-if="value !== 0 && colorMode"
      :key="value"
      :class="[dotClass(value), isWrong ? 'cell-shake' : 'cell-pop']"
      class="h-[60%] w-[60%]"
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
/* Board "prints in" diagonally from the top-left when a game opens. */
@keyframes cell-in {
  0% {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
.cell-in {
  animation: cell-in 0.32s ease-out both;
}

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
/* A bright pulse that rides outward from the digit just placed (the delay is set inline). */
@keyframes cell-flash {
  0% {
    background-color: rgba(16, 185, 129, 0);
    transform: scale(1);
  }
  30% {
    background-color: rgba(16, 185, 129, 0.55);
    transform: scale(1.09);
    z-index: 20;
  }
  100% {
    background-color: rgba(16, 185, 129, 0);
    transform: scale(1);
  }
}
.cell-flash {
  animation: cell-flash 0.7s ease-out backwards;
}
</style>
