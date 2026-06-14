<script setup lang="ts">
import { computed } from "vue";

import { useDailyPuzzle } from "../composables/useDailyPuzzle";
import { useScore } from "../composables/useScore";
import { useTechniqueStats } from "../composables/useTechniqueStats";

const emit = defineEmits<{ (e: "back-to-menu"): void }>();

const { t } = useI18n();
const score = useScore();
const techStats = useTechniqueStats();
const daily = useDailyPuzzle();

const stats = score.getStats();
const streak = daily.getStreak();

const DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert", "master", "custom"];

const difficultyRows = computed(() => {
  const keys = Object.keys(stats.perDifficulty);
  return DIFFICULTY_ORDER.filter((d) => keys.includes(d))
    .concat(keys.filter((k) => !DIFFICULTY_ORDER.includes(k)))
    .map((d) => ({ difficulty: d, ...stats.perDifficulty[d]! }))
    .filter((r) => r.wins > 0 || r.best > 0);
});

const topTechniques = computed(() => {
  const all = techStats.getAll();
  return Object.entries(all)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
});

const hasStats = computed(() => stats.gamesWon > 0 || topTechniques.value.length > 0);

function formatTime(seconds: number): string {
  if (!seconds) return t("stats.dash");
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const maxTechCount = computed(() => Math.max(1, ...topTechniques.value.map((t) => t.count)));
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-white/95 py-4 pr-4 pl-4 backdrop-blur sm:pl-8 dark:border-zinc-800 dark:bg-[#0c0a09]/95"
    >
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold tracking-wider text-zinc-600 uppercase transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
          />
        </svg>
        <span class="hidden sm:inline">{{ $t("menu.back") }}</span>
      </button>
      <div class="min-w-0 flex-1">
        <h1
          class="text-lg leading-tight font-black tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100"
        >
          {{ $t("stats.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">{{ $t("stats.subtitle") }}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <p v-if="!hasStats" class="py-16 text-center text-sm text-zinc-500">
        {{ $t("stats.noStatsYet") }}
      </p>

      <template v-else>
        <!-- Headline cards -->
        <div class="mb-8 grid grid-cols-3 gap-3">
          <div
            class="border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <p
              class="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-2xl leading-tight font-black text-transparent tabular-nums sm:text-3xl"
            >
              {{ stats.total.toLocaleString() }}
            </p>
            <p class="mt-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              {{ $t("stats.lifetimeScore") }}
            </p>
          </div>
          <div
            class="border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <p
              class="text-2xl leading-tight font-black text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-100"
            >
              {{ stats.gamesWon }}
            </p>
            <p class="mt-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              {{ $t("stats.gamesWon") }}
            </p>
          </div>
          <div
            class="border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <p
              class="text-2xl leading-tight font-black text-amber-600 tabular-nums sm:text-3xl dark:text-amber-400"
            >
              <span v-if="streak > 0">🔥 {{ streak }}</span>
              <span v-else class="text-zinc-400">{{ $t("stats.dash") }}</span>
            </p>
            <p class="mt-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              {{ $t("stats.dailyStreak") }}
            </p>
          </div>
        </div>

        <!-- Per-difficulty table -->
        <div v-if="difficultyRows.length" class="mb-8">
          <h2 class="mb-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
            {{ $t("stats.perDifficulty") }}
          </h2>
          <div class="overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="bg-zinc-100 text-[10px] tracking-wider text-zinc-500 uppercase dark:bg-zinc-900/60"
                >
                  <th class="px-3 py-2 text-left font-semibold">{{ $t("stats.difficulty") }}</th>
                  <th class="px-3 py-2 text-right font-semibold">{{ $t("stats.wins") }}</th>
                  <th class="px-3 py-2 text-right font-semibold">{{ $t("stats.bestScore") }}</th>
                  <th class="px-3 py-2 text-right font-semibold">{{ $t("stats.bestTime") }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                <tr
                  v-for="row in difficultyRows"
                  :key="row.difficulty"
                  class="text-zinc-700 dark:text-zinc-300"
                >
                  <td class="px-3 py-2 font-bold text-zinc-900 capitalize dark:text-zinc-100">
                    {{ row.difficulty }}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.wins }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.best.toLocaleString() }}</td>
                  <td class="px-3 py-2 text-right font-mono tabular-nums">
                    {{ formatTime(row.bestTime) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top techniques -->
        <div>
          <h2 class="mb-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
            {{ $t("stats.topTechniques") }}
          </h2>
          <p v-if="!topTechniques.length" class="text-sm text-zinc-500">
            {{ $t("stats.noTechniquesYet") }}
          </p>
          <div v-else class="space-y-2">
            <div v-for="tech in topTechniques" :key="tech.name" class="flex items-center gap-3">
              <span
                class="w-32 shrink-0 truncate text-sm font-semibold text-zinc-700 sm:w-40 dark:text-zinc-300"
                >{{ tech.name }}</span
              >
              <div class="h-4 flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800/60">
                <div
                  class="h-full bg-gradient-to-r from-violet-500/60 to-cyan-500/60"
                  :style="{ width: `${(tech.count / maxTechCount) * 100}%` }"
                />
              </div>
              <span
                class="w-8 shrink-0 text-right text-xs font-bold text-zinc-600 tabular-nums dark:text-zinc-400"
                >{{ tech.count }}</span
              >
            </div>
          </div>
        </div>
      </template>

      <!-- Footer -->
      <div class="mt-10 border-t border-zinc-200 pt-8 text-center dark:border-zinc-800">
        <button
          @click="emit('back-to-menu')"
          class="border border-zinc-300 bg-zinc-50 px-8 py-3 text-sm font-bold tracking-wider text-zinc-700 uppercase transition-all hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {{ $t("stats.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
