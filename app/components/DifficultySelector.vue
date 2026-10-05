<script setup lang="ts">
import type { Difficulty } from "../types/sudoku";

defineProps<{ activeDifficulty: Difficulty }>();

// Levels with a save in progress, so the player sees where a resume prompt will appear.
const { loadDifficulty } = useGameSave();
const inProgress = ref<Set<Difficulty>>(new Set());
onMounted(() => {
  inProgress.value = new Set(
    DIFFICULTIES.map((d) => d.key).filter((k) => loadDifficulty(k) !== null),
  );
});

const emit = defineEmits<{
  (e: "select-difficulty", level: Difficulty): void;
  (e: "back-to-menu"): void;
}>();

const DIFFICULTIES: {
  key: Difficulty;
  level: number;
  bar: string;
  hoverClass: string;
  groupHoverText: string;
}[] = [
  {
    key: "beginner",
    level: 1,
    bar: "bg-teal-500",
    hoverClass: "hover:border-teal-500/40 hover:bg-teal-50 dark:hover:bg-teal-950/20",
    groupHoverText: "group-hover:text-teal-400",
  },
  {
    key: "easy",
    level: 2,
    bar: "bg-emerald-500",
    hoverClass: "hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    groupHoverText: "group-hover:text-emerald-400",
  },
  {
    key: "medium",
    level: 3,
    bar: "bg-amber-500",
    hoverClass: "hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/20",
    groupHoverText: "group-hover:text-amber-400",
  },
  {
    key: "hard",
    level: 4,
    bar: "bg-rose-500",
    hoverClass: "hover:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/20",
    groupHoverText: "group-hover:text-rose-400",
  },
  {
    key: "expert",
    level: 5,
    bar: "bg-purple-500",
    hoverClass: "hover:border-purple-500/40 hover:bg-purple-50 dark:hover:bg-purple-950/20",
    groupHoverText: "group-hover:text-purple-400",
  },
  {
    key: "master",
    level: 6,
    bar: "bg-fuchsia-500",
    hoverClass: "hover:border-fuchsia-500/40 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20",
    groupHoverText: "group-hover:text-fuchsia-400",
  },
];
</script>

<template>
  <div class="flex w-full flex-1 justify-center">
    <div
      class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-10 select-none"
    >
      <div class="text-center">
        <h2 class="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
          {{ $t("difficulty.title") }}
        </h2>
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{{ $t("difficulty.subtitle") }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="d in DIFFICULTIES"
          :key="d.key"
          @click="emit('select-difficulty', d.key)"
          :class="d.hoverClass"
          class="group border border-zinc-200 bg-zinc-50 p-5 text-left transition-all active:scale-95 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span class="mb-2 flex h-5 items-center justify-between">
            <!-- Six pips, filled up to this level: one consistent difficulty scale. -->
            <span class="flex gap-0.5" aria-hidden="true">
              <span
                v-for="n in 6"
                :key="n"
                :class="n <= d.level ? d.bar : 'bg-zinc-300 dark:bg-zinc-700'"
                class="h-3 w-1.5"
              />
            </span>
            <span
              v-if="inProgress.has(d.key)"
              class="border border-violet-500/40 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-300"
              >{{ $t("difficulty.inProgress") }}</span
            >
          </span>
          <span
            :class="d.groupHoverText"
            class="block text-lg font-bold text-zinc-900 dark:text-zinc-100"
            >{{ $t(`difficulty.${d.key}`) }}</span
          >
          <span class="mt-1 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{{
            $t(`difficulty.${d.key}Desc`)
          }}</span>
        </button>
      </div>

      <button
        @click="emit('back-to-menu')"
        class="w-full border border-zinc-200 bg-zinc-50 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {{ $t("difficulty.back") }}
      </button>
    </div>
  </div>
</template>
