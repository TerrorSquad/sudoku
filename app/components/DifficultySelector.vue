<script setup lang="ts">
import type { Difficulty } from "../types/sudoku";

defineProps<{ activeDifficulty: Difficulty; colorMode: boolean }>();

const emit = defineEmits<{
  (e: "select-difficulty", level: Difficulty): void;
  (e: "back-to-menu"): void;
  (e: "update:colorMode", value: boolean): void;
}>();
</script>

<template>
  <div
    class="no-select mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-10"
  >
    <div class="text-center">
      <h2 class="text-3xl font-black tracking-tight text-zinc-900 uppercase dark:text-zinc-100">
        {{ $t("difficulty.title") }}
      </h2>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{{ $t("difficulty.subtitle") }}</p>
    </div>

    <label
      class="flex items-center justify-between border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{{
        $t("difficulty.colorMode")
      }}</span>
      <USwitch
        :model-value="colorMode"
        @update:model-value="(v: boolean) => emit('update:colorMode', v)"
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <button
        @click="emit('select-difficulty', 'beginner')"
        class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all hover:border-teal-500/40 hover:bg-teal-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-teal-950/20"
      >
        <span class="mb-1 block text-2xl">🌱</span>
        <span
          class="block text-lg font-bold text-zinc-900 group-hover:text-teal-400 dark:text-zinc-100"
          >{{ $t("difficulty.beginner") }}</span
        >
        <span class="mt-1 block text-xs leading-snug text-zinc-500">{{
          $t("difficulty.beginnerDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'easy')"
        class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-emerald-950/20"
      >
        <span class="mb-1 block text-2xl">🟢</span>
        <span
          class="block text-lg font-bold text-zinc-900 group-hover:text-emerald-400 dark:text-zinc-100"
          >{{ $t("difficulty.easy") }}</span
        >
        <span class="mt-1 block text-xs leading-snug text-zinc-500">{{
          $t("difficulty.easyDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'medium')"
        class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all hover:border-amber-500/40 hover:bg-amber-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-amber-950/20"
      >
        <span class="mb-1 block text-2xl">🟡</span>
        <span
          class="block text-lg font-bold text-zinc-900 group-hover:text-amber-400 dark:text-zinc-100"
          >{{ $t("difficulty.medium") }}</span
        >
        <span class="mt-1 block text-xs leading-snug text-zinc-500">{{
          $t("difficulty.mediumDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'hard')"
        class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all hover:border-rose-500/40 hover:bg-rose-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-rose-950/20"
      >
        <span class="mb-1 block text-2xl">🔴</span>
        <span
          class="block text-lg font-bold text-zinc-900 group-hover:text-rose-400 dark:text-zinc-100"
          >{{ $t("difficulty.hard") }}</span
        >
        <span class="mt-1 block text-xs leading-snug text-zinc-500">{{
          $t("difficulty.hardDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'expert')"
        class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all hover:border-purple-500/40 hover:bg-purple-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-purple-950/20"
      >
        <span class="mb-1 block text-2xl">💀</span>
        <span
          class="block text-lg font-bold text-zinc-900 group-hover:text-purple-400 dark:text-zinc-100"
          >{{ $t("difficulty.expert") }}</span
        >
        <span class="mt-1 block text-xs leading-snug text-zinc-500">{{
          $t("difficulty.expertDesc")
        }}</span>
      </button>

      <button
        @click="emit('select-difficulty', 'master')"
        class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all hover:border-fuchsia-500/40 hover:bg-fuchsia-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-fuchsia-950/20"
      >
        <span class="mb-1 block text-2xl">⚡</span>
        <span
          class="block text-lg font-bold text-zinc-900 group-hover:text-fuchsia-400 dark:text-zinc-100"
          >{{ $t("difficulty.master") }}</span
        >
        <span class="mt-1 block text-xs leading-snug text-zinc-500">{{
          $t("difficulty.masterDesc")
        }}</span>
      </button>
    </div>

    <button
      @click="emit('back-to-menu')"
      class="w-full border border-zinc-200 bg-zinc-50 py-3 text-sm font-semibold tracking-wider text-zinc-600 uppercase transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {{ $t("difficulty.back") }}
    </button>
  </div>
</template>
