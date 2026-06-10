<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Grid } from '../types/sudoku';

const emit = defineEmits<{
  (e: 'load-puzzle', board: Grid): void;
  (e: 'back-to-menu'): void;
}>();

const { t } = useI18n();

const raw = ref('');
const error = ref('');

const cleaned = computed(() => raw.value.replace(/\s/g, ''));

const isValid = computed(() => {
  const s = cleaned.value;
  return s.length === 81 && /^[0-9]+$/.test(s);
});

const preview = computed<number[][] | null>(() => {
  if (!isValid.value) return null;
  const digits = cleaned.value.split('').map(Number);
  return Array.from({ length: 9 }, (_, r) => digits.slice(r * 9, r * 9 + 9));
});

function handleLoad() {
  error.value = '';
  if (!isValid.value) {
    const s = cleaned.value;
    if (s.length !== 81) error.value = t('customImport.errorExpectedDigits', { count: s.length });
    else error.value = t('customImport.errorOnlyDigits');
    return;
  }
  const board = preview.value!.map(row => [...row]) as Grid;
  // Minimal validity: check no two same non-zero values share row/col/box
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r]![c]!;
      if (v === 0) continue;
      for (let x = 0; x < 9; x++) {
        if (x !== c && board[r]![x] === v) { error.value = t('customImport.errorRowDuplicate', { row: r + 1, value: v }); return; }
        if (x !== r && board[x]![c] === v) { error.value = t('customImport.errorColDuplicate', { col: c + 1, value: v }); return; }
      }
      const br = r - (r % 3), bc = c - (c % 3);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const rr = br + i, cc = bc + j;
        if ((rr !== r || cc !== c) && board[rr]![cc] === v) {
          error.value = t('customImport.errorBoxDuplicate', { row: br + 1, col: bc + 1, value: v }); return;
        }
      }
    }
  }
  emit('load-puzzle', board);
}

const EXAMPLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

function loadExample() {
  raw.value = EXAMPLE;
  error.value = '';
}
</script>

<template>
  <div class="flex flex-col justify-center flex-1 w-full max-w-md mx-auto gap-5 px-6 py-10">
    <div>
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-5 transition-colors dark:hover:text-zinc-300 hover:text-zinc-700"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
        {{ $t('customImport.back') }}
      </button>
      <h2 class="text-3xl font-black uppercase tracking-tight dark:text-zinc-100 text-zinc-900">{{ $t('customImport.title') }}</h2>
      <p class="text-sm mt-1 dark:text-zinc-400 text-zinc-600">{{ $t('customImport.description') }}</p>
    </div>

    <textarea
      v-model="raw"
      rows="4"
      placeholder="530070000600195000098000060800060003400803001700020006060000280000419005000080079"
      class="w-full border focus:border-violet-500 text-sm font-game p-3 resize-none outline-none transition-colors dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder:text-zinc-700 bg-zinc-50 border-zinc-300 text-zinc-800 placeholder:text-zinc-400"
      spellcheck="false"
    />

    <div class="flex items-center justify-between text-xs">
      <span :class="cleaned.length === 81 ? 'text-emerald-400' : 'text-zinc-500'" class="font-mono font-bold">
        {{ cleaned.length }} / 81
      </span>
      <button @click="loadExample" class="text-zinc-500 underline transition-colors dark:hover:text-zinc-300 hover:text-zinc-700">
        {{ $t('customImport.loadExample') }}
      </button>
    </div>

    <p v-if="error" class="text-xs text-rose-400 font-semibold">{{ error }}</p>

    <!-- Mini preview -->
    <div v-if="preview" class="grid grid-cols-9 gap-px border shrink-0 dark:bg-zinc-700 dark:border-zinc-700 bg-zinc-300 border-zinc-300">
      <template v-for="(row, r) in preview" :key="r">
        <div
          v-for="(cell, c) in row"
          :key="`${r}-${c}`"
          :class="[
            cell !== 0 ? 'font-bold dark:text-zinc-100 text-zinc-900' : 'dark:text-zinc-700 text-zinc-300',
            (c === 2 || c === 5) ? 'border-r-2 border-r-zinc-500' : '',
            (r === 2 || r === 5) ? 'border-b-2 border-b-zinc-500' : '',
          ]"
          class="aspect-square flex items-center justify-center text-[11px] font-game dark:bg-zinc-900 bg-zinc-100"
        >
          {{ cell !== 0 ? cell : '·' }}
        </div>
      </template>
    </div>

    <button
      @click="handleLoad"
      :disabled="!isValid"
      :class="isValid ? 'bg-violet-700 hover:bg-violet-600 border-violet-600 text-white' : 'dark:bg-zinc-900 dark:border-zinc-800 bg-zinc-100 border-zinc-300 text-zinc-600 cursor-not-allowed'"
      class="w-full py-4 border font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
    >
      {{ $t('customImport.playPuzzle') }}
    </button>
  </div>
</template>
