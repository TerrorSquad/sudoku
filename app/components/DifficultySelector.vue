<script setup lang="ts">
import type { Difficulty } from "../types/sudoku";

defineProps<{ activeDifficulty: Difficulty }>();

const emit = defineEmits<{
  (e: "select-difficulty", level: Difficulty): void;
  (e: "back-to-menu"): void;
}>();
</script>

<template>
  <div
    class="flex flex-col justify-center flex-1 w-full max-w-md mx-auto gap-6 px-6 py-10 no-select"
  >
    <div class="text-center">
      <h2 class="text-3xl font-black uppercase tracking-tight dark:text-zinc-100 text-zinc-900">
        {{ $t("difficulty.title") }}
      </h2>
      <p class="text-sm mt-1 dark:text-zinc-400 text-zinc-600">{{ $t("difficulty.subtitle") }}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <button
        @click="emit('select-difficulty', 'beginner')"
        class="p-5 border hover:border-teal-500/40 text-left transition-all active:scale-95 group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-teal-950/20 bg-zinc-50 border-zinc-200 hover:bg-teal-50"
      >
        <span class="block text-2xl mb-1">🌱</span>
        <span
          class="block text-lg font-bold group-hover:text-teal-400 dark:text-zinc-100 text-zinc-900"
          >{{ $t("difficulty.beginner") }}</span
        >
        <span class="block text-xs text-zinc-500 mt-1 leading-snug">{{
          $t("difficulty.beginnerDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'easy')"
        class="p-5 border hover:border-emerald-500/40 text-left transition-all active:scale-95 group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-emerald-950/20 bg-zinc-50 border-zinc-200 hover:bg-emerald-50"
      >
        <span class="block text-2xl mb-1">🟢</span>
        <span
          class="block text-lg font-bold group-hover:text-emerald-400 dark:text-zinc-100 text-zinc-900"
          >{{ $t("difficulty.easy") }}</span
        >
        <span class="block text-xs text-zinc-500 mt-1 leading-snug">{{
          $t("difficulty.easyDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'medium')"
        class="p-5 border hover:border-amber-500/40 text-left transition-all active:scale-95 group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-amber-950/20 bg-zinc-50 border-zinc-200 hover:bg-amber-50"
      >
        <span class="block text-2xl mb-1">🟡</span>
        <span
          class="block text-lg font-bold group-hover:text-amber-400 dark:text-zinc-100 text-zinc-900"
          >{{ $t("difficulty.medium") }}</span
        >
        <span class="block text-xs text-zinc-500 mt-1 leading-snug">{{
          $t("difficulty.mediumDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'hard')"
        class="p-5 border hover:border-rose-500/40 text-left transition-all active:scale-95 group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-rose-950/20 bg-zinc-50 border-zinc-200 hover:bg-rose-50"
      >
        <span class="block text-2xl mb-1">🔴</span>
        <span
          class="block text-lg font-bold group-hover:text-rose-400 dark:text-zinc-100 text-zinc-900"
          >{{ $t("difficulty.hard") }}</span
        >
        <span class="block text-xs text-zinc-500 mt-1 leading-snug">{{
          $t("difficulty.hardDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'expert')"
        class="p-5 border hover:border-purple-500/40 text-left transition-all active:scale-95 group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-purple-950/20 bg-zinc-50 border-zinc-200 hover:bg-purple-50"
      >
        <span class="block text-2xl mb-1">💀</span>
        <span
          class="block text-lg font-bold group-hover:text-purple-400 dark:text-zinc-100 text-zinc-900"
          >{{ $t("difficulty.expert") }}</span
        >
        <span class="block text-xs text-zinc-500 mt-1 leading-snug">{{
          $t("difficulty.expertDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'master')"
        class="p-5 border hover:border-fuchsia-500/40 text-left transition-all active:scale-95 group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-fuchsia-950/20 bg-zinc-50 border-zinc-200 hover:bg-fuchsia-50"
      >
        <span class="block text-2xl mb-1">⚡</span>
        <span
          class="block text-lg font-bold group-hover:text-fuchsia-400 dark:text-zinc-100 text-zinc-900"
          >{{ $t("difficulty.master") }}</span
        >
        <span class="block text-xs text-zinc-500 mt-1 leading-snug">{{
          $t("difficulty.masterDesc")
        }}</span>
      </button>
    </div>

    <button
      @click="emit('back-to-menu')"
      class="w-full py-3 border font-semibold text-sm uppercase tracking-wider transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400 bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600"
    >
      {{ $t("difficulty.back") }}
    </button>
  </div>
</template>
