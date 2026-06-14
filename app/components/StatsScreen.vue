<script setup lang="ts">
import { computed } from "vue";
import { useScore } from "../composables/useScore";
import { useTechniqueStats } from "../composables/useTechniqueStats";
import { useDailyPuzzle } from "../composables/useDailyPuzzle";

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
  <div class="min-h-screen w-full flex flex-col">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 backdrop-blur border-b pl-4 sm:pl-8 pr-4 py-4 flex items-center gap-4 dark:bg-[#0c0a09]/95 dark:border-zinc-800 bg-white/95 border-zinc-200"
    >
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider transition-colors dark:text-zinc-400 dark:hover:text-zinc-100 text-zinc-600 hover:text-zinc-900"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
          />
        </svg>
        <span class="hidden sm:inline">{{ $t("menu.back") }}</span>
      </button>
      <div class="flex-1 min-w-0">
        <h1
          class="text-lg sm:text-2xl font-black tracking-tight leading-tight dark:text-zinc-100 text-zinc-900"
        >
          {{ $t("stats.title") }}
        </h1>
        <p class="text-xs text-zinc-500 hidden sm:block">{{ $t("stats.subtitle") }}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-3xl mx-auto w-full">
      <p v-if="!hasStats" class="text-center text-sm text-zinc-500 py-16">
        {{ $t("stats.noStatsYet") }}
      </p>

      <template v-else>
        <!-- Headline cards -->
        <div class="grid grid-cols-3 gap-3 mb-8">
          <div
            class="border p-4 text-center dark:bg-zinc-900/60 dark:border-zinc-800 bg-zinc-50 border-zinc-200"
          >
            <p
              class="text-2xl sm:text-3xl font-black tabular-nums bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent leading-tight"
            >
              {{ stats.total.toLocaleString() }}
            </p>
            <p class="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-1">
              {{ $t("stats.lifetimeScore") }}
            </p>
          </div>
          <div
            class="border p-4 text-center dark:bg-zinc-900/60 dark:border-zinc-800 bg-zinc-50 border-zinc-200"
          >
            <p
              class="text-2xl sm:text-3xl font-black tabular-nums dark:text-zinc-100 text-zinc-900 leading-tight"
            >
              {{ stats.gamesWon }}
            </p>
            <p class="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-1">
              {{ $t("stats.gamesWon") }}
            </p>
          </div>
          <div
            class="border p-4 text-center dark:bg-zinc-900/60 dark:border-zinc-800 bg-zinc-50 border-zinc-200"
          >
            <p
              class="text-2xl sm:text-3xl font-black tabular-nums dark:text-amber-400 text-amber-600 leading-tight"
            >
              <span v-if="streak > 0">🔥 {{ streak }}</span>
              <span v-else class="text-zinc-400">{{ $t("stats.dash") }}</span>
            </p>
            <p class="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-1">
              {{ $t("stats.dailyStreak") }}
            </p>
          </div>
        </div>

        <!-- Per-difficulty table -->
        <div v-if="difficultyRows.length" class="mb-8">
          <h2 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
            {{ $t("stats.perDifficulty") }}
          </h2>
          <div class="border dark:border-zinc-800 border-zinc-200 overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/60 bg-zinc-100"
                >
                  <th class="text-left font-semibold px-3 py-2">{{ $t("stats.difficulty") }}</th>
                  <th class="text-right font-semibold px-3 py-2">{{ $t("stats.wins") }}</th>
                  <th class="text-right font-semibold px-3 py-2">{{ $t("stats.bestScore") }}</th>
                  <th class="text-right font-semibold px-3 py-2">{{ $t("stats.bestTime") }}</th>
                </tr>
              </thead>
              <tbody class="divide-y dark:divide-zinc-800 divide-zinc-200">
                <tr
                  v-for="row in difficultyRows"
                  :key="row.difficulty"
                  class="dark:text-zinc-300 text-zinc-700"
                >
                  <td class="px-3 py-2 font-bold capitalize dark:text-zinc-100 text-zinc-900">
                    {{ row.difficulty }}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.wins }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.best.toLocaleString() }}</td>
                  <td class="px-3 py-2 text-right tabular-nums font-mono">
                    {{ formatTime(row.bestTime) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top techniques -->
        <div>
          <h2 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
            {{ $t("stats.topTechniques") }}
          </h2>
          <p v-if="!topTechniques.length" class="text-sm text-zinc-500">
            {{ $t("stats.noTechniquesYet") }}
          </p>
          <div v-else class="space-y-2">
            <div v-for="tech in topTechniques" :key="tech.name" class="flex items-center gap-3">
              <span
                class="w-32 sm:w-40 shrink-0 text-sm font-semibold dark:text-zinc-300 text-zinc-700 truncate"
                >{{ tech.name }}</span
              >
              <div class="flex-1 h-4 dark:bg-zinc-800/60 bg-zinc-100 overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-violet-500/60 to-cyan-500/60"
                  :style="{ width: `${(tech.count / maxTechCount) * 100}%` }"
                />
              </div>
              <span
                class="w-8 shrink-0 text-right text-xs font-bold tabular-nums dark:text-zinc-400 text-zinc-600"
                >{{ tech.count }}</span
              >
            </div>
          </div>
        </div>
      </template>

      <!-- Footer -->
      <div class="border-t pt-8 mt-10 text-center dark:border-zinc-800 border-zinc-200">
        <button
          @click="emit('back-to-menu')"
          class="px-8 py-3 border text-sm font-bold uppercase tracking-wider transition-all active:scale-95 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 bg-zinc-50 hover:bg-zinc-100 border-zinc-300 text-zinc-700"
        >
          {{ $t("stats.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
