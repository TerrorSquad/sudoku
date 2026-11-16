<script setup lang="ts">
import type { Difficulty } from "../types/sudoku";

defineProps<{ activeDifficulty: Difficulty }>();

const { zen } = usePreferences();

// Levels with a save in progress, so the player sees where a resume prompt will appear.
const { loadDifficulty } = useGameSave();
// Read in setup, not onMounted, so a locked level never flashes open (or the reverse).
const inProgress = new Set(LADDER.filter((k) => loadDifficulty(k) !== null));
const wins = useScore().unlockWins();
const lockFor = (d: Difficulty) => lockOf(d, wins, inProgress.has(d));
onMounted(() => {
  // Have a board ready for every open level by the time one is picked.
  for (const d of TILES) if (!lockFor(d.key)) prefetchPuzzle(d.key);
});

const emit = defineEmits<{
  (e: "select-difficulty", level: Difficulty): void;
  (e: "back-to-menu"): void;
}>();

const TILES: {
  key: Difficulty;
  bar: string;
  hoverClass: string;
  groupHoverText: string;
}[] = [
  {
    key: "beginner",
    bar: "bg-teal-500",
    hoverClass: "hover:border-teal-500/40 hover:bg-teal-50 dark:hover:bg-teal-950/20",
    groupHoverText: "group-hover:text-teal-700 dark:group-hover:text-teal-300",
  },
  {
    key: "easy",
    bar: "bg-emerald-500",
    hoverClass: "hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    groupHoverText: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
  },
  {
    key: "medium",
    bar: "bg-amber-500",
    hoverClass: "hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/20",
    groupHoverText: "group-hover:text-amber-700 dark:group-hover:text-amber-300",
  },
  {
    key: "hard",
    bar: "bg-rose-500",
    hoverClass: "hover:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/20",
    groupHoverText: "group-hover:text-rose-700 dark:group-hover:text-rose-300",
  },
  {
    key: "expert",
    bar: "bg-purple-500",
    hoverClass: "hover:border-purple-500/40 hover:bg-purple-50 dark:hover:bg-purple-950/20",
    groupHoverText: "group-hover:text-purple-700 dark:group-hover:text-purple-300",
  },
  {
    key: "master",
    bar: "bg-fuchsia-500",
    hoverClass: "hover:border-fuchsia-500/40 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20",
    groupHoverText: "group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-300",
  },
];

function pick(d: Difficulty) {
  if (!lockFor(d)) emit("select-difficulty", d);
}
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

      <label class="panel flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
        <span>
          <span class="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{{
            $t("difficulty.zen")
          }}</span>
          <span class="block text-xs text-zinc-500 dark:text-zinc-400">{{
            $t("difficulty.zenDesc")
          }}</span>
        </span>
        <USwitch v-model="zen" />
      </label>

      <div class="grid grid-cols-2 gap-3">
        <!-- A locked level stays visible and focusable, saying what opens it. The requirement is
             its description, not part of its name, so "Medium" names only the Medium tile. -->
        <button
          v-for="d in TILES"
          :key="d.key"
          @click="pick(d.key)"
          :aria-disabled="lockFor(d.key) ? 'true' : undefined"
          :aria-describedby="lockFor(d.key) ? `unlock-${d.key}` : undefined"
          :data-locked="lockFor(d.key) ? '' : undefined"
          :class="lockFor(d.key) ? 'cursor-not-allowed' : d.hoverClass"
          class="tile group p-5 text-left"
        >
          <span class="mb-2 flex h-5 items-center justify-between">
            <!-- Six pips, filled up to this level: one consistent difficulty scale. -->
            <span class="flex gap-0.5" aria-hidden="true">
              <span
                v-for="n in 6"
                :key="n"
                :class="n <= LADDER.indexOf(d.key) + 1 ? d.bar : 'bg-zinc-300 dark:bg-zinc-700'"
                class="h-3 w-1.5 rounded-full"
              />
            </span>
            <span
              v-if="lockFor(d.key)"
              class="flex items-center gap-1 text-[0.625rem] font-bold text-zinc-600 dark:text-zinc-400"
            >
              <AppIcon
                class="h-3.5 w-3.5"
                path="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
              {{ $t("difficulty.locked") }}
            </span>
            <span
              v-else-if="inProgress.has(d.key)"
              class="rounded-full border border-violet-500/40 px-1.5 py-0.5 text-[0.5625rem] font-bold text-violet-600 dark:text-violet-300"
              >{{ $t("difficulty.inProgress") }}</span
            >
          </span>
          <span
            :class="lockFor(d.key) ? '' : d.groupHoverText"
            class="block text-lg font-bold text-zinc-900 dark:text-zinc-100"
            >{{ $t(`difficulty.${d.key}`) }}</span
          >
          <span
            v-if="lockFor(d.key)"
            :id="`unlock-${d.key}`"
            aria-hidden="true"
            class="mt-1 block text-xs leading-snug font-semibold text-zinc-600 dark:text-zinc-300"
            >{{
              $t("difficulty.unlockReq", {
                n: lockFor(d.key)!.need,
                level: $t(`difficulty.${lockFor(d.key)!.at}`),
                have: lockFor(d.key)!.have,
              })
            }}</span
          >
          <span v-else class="mt-1 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{{
            $t(`difficulty.${d.key}Desc`)
          }}</span>
        </button>
      </div>

      <button
        @click="emit('back-to-menu')"
        class="tile w-full py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
      >
        {{ $t("difficulty.back") }}
      </button>
    </div>
  </div>
</template>
