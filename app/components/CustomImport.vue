<script setup lang="ts">
import { ref, computed } from "vue";

import type { Grid } from "../types/sudoku";

import { countSolutions } from "../utils/sudokuCore";

const emit = defineEmits<{
  (e: "load-puzzle", board: Grid): void;
  (e: "back-to-menu"): void;
}>();

const { t } = useI18n();

const raw = ref("");
const error = ref("");

const cleaned = computed(() => raw.value.replace(/\s/g, ""));

const isValid = computed(() => {
  const s = cleaned.value;
  return s.length === 81 && /^[0-9]+$/.test(s);
});

const preview = computed<number[][] | null>(() => {
  if (!isValid.value) return null;
  const digits = cleaned.value.split("").map(Number);
  return Array.from({ length: 9 }, (_, r) => digits.slice(r * 9, r * 9 + 9));
});

function handleLoad() {
  error.value = "";
  if (!isValid.value) {
    const s = cleaned.value;
    if (s.length !== 81) error.value = t("customImport.errorExpectedDigits", { count: s.length });
    else error.value = t("customImport.errorOnlyDigits");
    return;
  }
  const board = preview.value!.map((row) => row.concat()) as Grid;
  // Minimal validity: check no two same non-zero values share row/col/box
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r]![c]!;
      if (v === 0) continue;
      for (let x = 0; x < 9; x++) {
        if (x !== c && board[r]![x] === v) {
          error.value = t("customImport.errorRowDuplicate", { row: r + 1, value: v });
          return;
        }
        if (x !== r && board[x]![c] === v) {
          error.value = t("customImport.errorColDuplicate", { col: c + 1, value: v });
          return;
        }
      }
      const br = r - (r % 3),
        bc = c - (c % 3);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const rr = br + i,
            cc = bc + j;
          if ((rr !== r || cc !== c) && board[rr]![cc] === v) {
            error.value = t("customImport.errorBoxDuplicate", {
              row: br + 1,
              col: bc + 1,
              value: v,
            });
            return;
          }
        }
    }
  }
  const solutions = countSolutions(board, 2);
  if (solutions === 0) {
    error.value = t("customImport.errorNoSolution");
    return;
  }
  if (solutions > 1) {
    error.value = t("customImport.errorMultipleSolutions");
    return;
  }
  emit("load-puzzle", board);
}

const EXAMPLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

function loadExample() {
  raw.value = EXAMPLE;
  error.value = "";
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-10">
    <div>
      <button
        @click="emit('back-to-menu')"
        class="mb-5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
          />
        </svg>
        {{ $t("customImport.back") }}
      </button>
      <h2 class="text-3xl font-black tracking-tight text-zinc-900 uppercase dark:text-zinc-100">
        {{ $t("customImport.title") }}
      </h2>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {{ $t("customImport.description") }}
      </p>
    </div>

    <textarea
      v-model="raw"
      rows="4"
      placeholder="530070000600195000098000060800060003400803001700020006060000280000419005000080079"
      class="w-full resize-none border border-zinc-300 bg-zinc-50 p-3 font-game text-sm text-zinc-800 transition-colors outline-none placeholder:text-zinc-400 focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-700"
      spellcheck="false"
    />

    <div class="flex items-center justify-between text-xs">
      <span
        :class="cleaned.length === 81 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'"
        class="font-mono font-bold"
      >
        {{ cleaned.length }} / 81
      </span>
      <button
        @click="loadExample"
        class="text-zinc-500 underline transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {{ $t("customImport.loadExample") }}
      </button>
    </div>

    <p v-if="error" class="text-xs font-semibold text-rose-600 dark:text-rose-400">{{ error }}</p>

    <!-- Mini preview -->
    <div
      v-if="preview"
      class="grid shrink-0 grid-cols-9 gap-px border border-zinc-300 bg-zinc-300 dark:border-zinc-700 dark:bg-zinc-700"
    >
      <template v-for="(row, r) in preview" :key="r">
        <div
          v-for="(cell, c) in row"
          :key="`${r}-${c}`"
          :class="[
            cell !== 0
              ? 'font-bold text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-300 dark:text-zinc-700',
            c === 2 || c === 5 ? 'border-r-2 border-r-zinc-500' : '',
            r === 2 || r === 5 ? 'border-b-2 border-b-zinc-500' : '',
          ]"
          class="flex aspect-square items-center justify-center bg-zinc-100 font-game text-[11px] dark:bg-zinc-900"
        >
          {{ cell !== 0 ? cell : "·" }}
        </div>
      </template>
    </div>

    <button
      @click="handleLoad"
      :disabled="!isValid"
      :class="
        isValid
          ? 'border-violet-600 bg-violet-700 text-white hover:bg-violet-600'
          : 'cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900'
      "
      class="w-full border py-4 text-sm font-bold tracking-wider uppercase transition-all active:scale-95"
    >
      {{ $t("customImport.playPuzzle") }}
    </button>
  </div>
</template>
