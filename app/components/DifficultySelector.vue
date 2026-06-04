<script setup lang="ts">
import type { Difficulty } from '../types/sudoku';

defineProps<{
  activeDifficulty: Difficulty;
}>();

const emit = defineEmits<{
  (e: 'select-difficulty', level: Difficulty): void;
  (e: 'back-to-menu'): void;
}>();
</script>

<template>
  <div class="flex flex-col justify-center h-full w-full max-w-md mx-auto gap-6 py-6 no-select">
    <div class="text-center">
      <h2 class="text-3xl font-black text-zinc-100 uppercase tracking-tight">Izaberi Izazov</h2>
      <p class="text-xs text-zinc-400 mt-1">Spreman za analizu? Izaberi težinu:</p>
    </div>

    <div class="grid grid-cols-2 gap-3.5">
      <button @click="emit('select-difficulty', 'lako')" class="p-5 bg-zinc-900 hover:bg-emerald-950/20 border border-zinc-800 hover:border-emerald-500/30 text-left transition-all active:scale-95 group rounded-none">
        <span class="block text-2xl mb-1">🟢</span>
        <span class="block text-lg font-bold text-zinc-100 group-hover:text-emerald-400">Lako</span>
        <span class="block text-[11px] text-zinc-500 mt-1">Jednostavne eliminacije.</span>
      </button>

      <button @click="emit('select-difficulty', 'srednje')" class="p-5 bg-zinc-900 hover:bg-amber-950/20 border border-zinc-800 hover:border-amber-500/30 text-left transition-all active:scale-95 group rounded-none">
        <span class="block text-2xl mb-1">🟡</span>
        <span class="block text-lg font-bold text-zinc-100 group-hover:text-amber-400">Srednje</span>
        <span class="block text-[11px] text-zinc-500 mt-1">Zahtijeva Pointing parove.</span>
      </button>

      <button @click="emit('select-difficulty', 'tesko')" class="p-5 bg-zinc-900 hover:bg-rose-950/20 border border-zinc-800 hover:border-rose-500/30 text-left transition-all active:scale-95 group rounded-none">
        <span class="block text-2xl mb-1">🔴</span>
        <span class="block text-lg font-bold text-zinc-100 group-hover:text-rose-400">Teško</span>
        <span class="block text-[11px] text-zinc-500 mt-1">Naked parovi i eliminacije.</span>
      </button>

      <button @click="emit('select-difficulty', 'ekspert')" class="p-5 bg-zinc-900 hover:bg-purple-950/20 border border-zinc-800 hover:border-purple-500/30 text-left transition-all active:scale-95 group rounded-none">
        <span class="block text-2xl mb-1">💀</span>
        <span class="block text-lg font-bold text-zinc-100 group-hover:text-purple-400">Ekspert</span>
        <span class="block text-[11px] text-zinc-500 mt-1">Zahtijeva X-Wing i Y-Wing.</span>
      </button>
    </div>

    <button @click="emit('back-to-menu')" class="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-semibold text-xs text-zinc-400 uppercase tracking-wider transition-colors rounded-none">
      Nazad u Meni
    </button>
  </div>
</template>