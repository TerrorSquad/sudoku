<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { localDateKey } from "../composables/useDailyPuzzle";
import {
  DIFFICULTIES,
  dailyBoard,
  loadBoard,
  timeBoard,
  type Board,
  type BoardView,
} from "../utils/wavedash";

const { t } = useI18n();

// Shown only on Wavedash (StatsScreen checks hasWavedash()).
const boards = computed<{ board: Board; label: string }[]>(() => [
  { board: dailyBoard(localDateKey()), label: t("leaderboard.dailyToday") },
  ...DIFFICULTIES.map((d) => ({
    board: timeBoard(d),
    label: t("leaderboard.bestTime", { difficulty: t(`difficulty.${d}`) }),
  })),
]);

const selected = ref(dailyBoard(localDateKey()).name);
const friendsOnly = ref(false);
const view = ref<BoardView | null>(null);
const error = ref(false);
const loading = ref(false);

const current = computed(() => boards.value.find((b) => b.board.name === selected.value)!.board);

let request = 0;
watch(
  [current, friendsOnly],
  async ([board, friends]) => {
    const mine = ++request;
    loading.value = true;
    error.value = false;
    try {
      const result = await loadBoard(board, friends);
      if (mine === request) view.value = result;
    } catch {
      if (mine === request) error.value = true;
    } finally {
      if (mine === request) loading.value = false;
    }
  },
  { immediate: true },
);

function formatScore(score: number): string {
  const m = Math.floor(score / 60);
  return `${m}:${String(score % 60).padStart(2, "0")}`;
}
</script>

<template>
  <section class="mb-8" :aria-label="$t('leaderboard.title')">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xs font-bold text-zinc-500">{{ $t("leaderboard.title") }}</h2>
      <div class="flex items-center gap-2">
        <select
          v-model="selected"
          :aria-label="$t('leaderboard.board')"
          class="border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option v-for="b in boards" :key="b.board.name" :value="b.board.name">
            {{ b.label }}
          </option>
        </select>
        <div class="flex border border-zinc-300 dark:border-zinc-700">
          <button
            v-for="friends in [false, true]"
            :key="String(friends)"
            :aria-pressed="friendsOnly === friends"
            class="px-3 py-1 text-xs font-bold transition-colors"
            :class="
              friendsOnly === friends
                ? 'bg-violet-600 text-white'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            "
            @click="friendsOnly = friends"
          >
            {{ friends ? $t("leaderboard.friends") : $t("leaderboard.global") }}
          </button>
        </div>
      </div>
    </div>

    <div class="border border-zinc-200 dark:border-zinc-800" aria-live="polite">
      <p v-if="error" class="px-3 py-4 text-sm text-red-600 dark:text-red-400">
        {{ $t("leaderboard.error") }}
      </p>
      <p v-else-if="!view" class="px-3 py-4 text-sm text-zinc-500">
        {{ $t("leaderboard.loading") }}
      </p>
      <template v-else>
        <p v-if="!view.top.length" class="px-3 py-4 text-sm text-zinc-500">
          {{ $t("leaderboard.empty") }}
        </p>
        <ol
          v-else
          class="divide-y divide-zinc-200 text-sm dark:divide-zinc-800"
          :class="{ 'opacity-60': loading }"
        >
          <li
            v-for="entry in view.top"
            :key="entry.userId"
            class="flex items-center gap-3 px-3 py-2"
            :class="
              entry.userId === view.me?.userId
                ? 'bg-violet-50 font-bold text-violet-900 dark:bg-violet-950/40 dark:text-violet-100'
                : 'text-zinc-700 dark:text-zinc-300'
            "
          >
            <span class="w-8 text-right text-xs text-zinc-500 tabular-nums">
              {{ entry.globalRank }}
            </span>
            <span class="min-w-0 flex-1 truncate">{{ entry.username }}</span>
            <span class="font-mono tabular-nums">{{ formatScore(entry.score) }}</span>
          </li>
        </ol>
        <p
          class="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
        >
          {{
            view.me
              ? $t("leaderboard.yourRank", {
                  rank: view.me.globalRank,
                  score: formatScore(view.me.score),
                })
              : $t("leaderboard.notRanked")
          }}
        </p>
      </template>
    </div>
  </section>
</template>
