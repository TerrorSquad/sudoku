<script setup lang="ts">
import { computed } from "vue";

import { useDailyPuzzle } from "../composables/useDailyPuzzle";
import { useRecords } from "../composables/useRecords";
import { useScore } from "../composables/useScore";
import { useTechniqueStats } from "../composables/useTechniqueStats";
import { MAX_FREEZES } from "../utils/streak";
import { hasWavedash } from "../utils/wavedash";

const emit = defineEmits<{ (e: "back-to-menu"): void; (e: "start-game"): void }>();

const { t } = useI18n();
const score = useScore();
const techStats = useTechniqueStats();
const daily = useDailyPuzzle();

const stats = score.getStats();
const onWavedash = hasWavedash();
const streakState = daily.getStreakState();
const streak = streakState.current;
const records = useRecords().get();

// Fastest times are the per-difficulty table's Best time column, not repeated here.
const recordRows = [
  { key: "streak", value: streakState.longest },
  { key: "mostInDay", value: records.mostInDay },
  { key: "cleanRun", value: records.bestCleanRun },
  {
    key: "noHint",
    value: records.hardestNoHint ? t(`difficulty.${records.hardestNoHint}`) : 0,
  },
];

const DIFFICULTY_ORDER = [
  "beginner",
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "daily",
  "custom",
];

const difficultyRows = computed(() => {
  const keys = Object.keys(stats.perDifficulty);
  return DIFFICULTY_ORDER.filter((d) => keys.includes(d))
    .concat(keys.filter((k) => !DIFFICULTY_ORDER.includes(k)))
    .map((d) => Object.assign({ difficulty: d }, stats.perDifficulty[d]!))
    .filter((r) => r.wins > 0 || r.best > 0);
});

// Counts are keyed by TechniqueId; a key the migration couldn't map is shown as stored.
function techniqueTitle(id: string): string {
  const key = `hint.move.${id}.name`;
  const title = t(key);
  return title === key ? id : title;
}

const topTechniques = computed(() => {
  const all = techStats.getAll();
  return Object.entries(all)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, name: techniqueTitle(id), count }));
});

const hasStats = computed(() => stats.gamesWon > 0 || topTechniques.value.length > 0);

function formatTime(seconds: number): string {
  if (!seconds) return t("stats.dash");
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const maxTechCount = computed(() => Math.max(1, ...topTechniques.value.map((tech) => tech.count)));
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <!-- Header -->
    <ScreenHeader :back-label="$t('menu.back')" @back="emit('back-to-menu')">
      <div class="min-w-0 flex-1">
        <h1
          class="text-lg leading-tight font-black tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50"
        >
          {{ $t("stats.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">{{ $t("stats.subtitle") }}</p>
      </div>
    </ScreenHeader>

    <!-- Content -->
    <div class="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <LeaderboardPanel v-if="onWavedash" />

      <div v-if="!hasStats" class="tray flex flex-col items-center gap-5 px-6 py-16 text-center">
        <AppIcon
          class="h-10 w-10 text-zinc-400 dark:text-zinc-600"
          path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
        <p class="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
          {{ $t("stats.noStatsYet") }}
        </p>
        <button @click="emit('start-game')" class="tile tile-primary px-8 py-3 text-sm font-bold">
          {{ $t("stats.startFirst") }}
        </button>
      </div>

      <template v-else>
        <!-- Headline cards -->
        <div class="mb-8 grid grid-cols-3 gap-3">
          <div class="panel p-4 text-center">
            <p
              class="text-2xl leading-tight font-black text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50"
            >
              {{ stats.total.toLocaleString() }}
            </p>
            <p class="mt-1 text-[0.625rem] font-semibold text-zinc-500">
              {{ $t("stats.lifetimeScore") }}
            </p>
          </div>
          <div class="panel p-4 text-center">
            <p
              class="text-2xl leading-tight font-black text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-100"
            >
              {{ stats.gamesWon }}
            </p>
            <p class="mt-1 text-[0.625rem] font-semibold text-zinc-500">
              {{ $t("stats.gamesWon") }}
            </p>
          </div>
          <div class="panel p-4 text-center">
            <p
              class="text-2xl leading-tight font-black text-amber-600 tabular-nums sm:text-3xl dark:text-amber-400"
            >
              <span v-if="streak > 0">🔥 {{ streak }}</span>
              <span v-else class="text-zinc-400">{{ $t("stats.dash") }}</span>
            </p>
            <p class="mt-1 text-[0.625rem] font-semibold text-zinc-500">
              {{ $t("stats.dailyStreak") }}
            </p>
            <p
              class="mt-1 text-[0.625rem] font-semibold text-sky-700 dark:text-sky-300"
              data-testid="freezes"
            >
              ❄ {{ $t("streak.freezes", { n: streakState.freezes, max: MAX_FREEZES }) }}
            </p>
          </div>
        </div>

        <DailyCalendar class="mb-8" />

        <!-- Per-difficulty table -->
        <div v-if="difficultyRows.length" class="mb-8">
          <h2 class="mb-3 text-xs font-bold text-zinc-500">
            {{ $t("stats.perDifficulty") }}
          </h2>
          <div class="overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-zinc-100 text-[0.625rem] text-zinc-500 dark:bg-zinc-900/60">
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
                  <td class="px-3 py-2 font-bold text-zinc-900 dark:text-zinc-100">
                    {{ $t(`difficulty.${row.difficulty}`) }}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.wins }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.best.toLocaleString() }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">
                    {{ formatTime(row.bestTime) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Personal records -->
        <div class="mb-8" data-testid="records">
          <h2 class="mb-3 text-xs font-bold text-zinc-500">{{ $t("records.title") }}</h2>
          <dl
            class="divide-y divide-zinc-200 border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800"
          >
            <div
              v-for="row in recordRows"
              :key="row.key"
              class="flex items-baseline justify-between gap-3 px-3 py-2"
            >
              <dt class="text-zinc-700 dark:text-zinc-300">{{ $t(`records.${row.key}`) }}</dt>
              <dd class="font-bold text-zinc-900 tabular-nums dark:text-zinc-100">
                {{ row.value || $t("stats.dash") }}
              </dd>
            </div>
          </dl>
          <p class="mt-2 text-xs text-zinc-500">
            <template v-if="!records.mostInDay">{{ $t("records.since") }}</template>
            {{ difficultyRows.length ? $t("records.fastest") : "" }}
          </p>
        </div>

        <!-- Top techniques -->
        <div>
          <h2 class="mb-3 text-xs font-bold text-zinc-500">
            {{ $t("stats.topTechniques") }}
          </h2>
          <p v-if="!topTechniques.length" class="text-sm text-zinc-500">
            {{ $t("stats.noTechniquesYet") }}
          </p>
          <div v-else class="space-y-2">
            <div v-for="tech in topTechniques" :key="tech.id" class="flex items-center gap-3">
              <span
                class="w-32 shrink-0 truncate text-sm font-semibold text-zinc-700 sm:w-40 dark:text-zinc-300"
                >{{ tech.name }}</span
              >
              <div class="h-4 flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800/60">
                <div
                  class="h-full bg-violet-500/70"
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
      <div
        v-if="hasStats"
        class="mt-10 border-t border-zinc-200 pt-8 text-center dark:border-zinc-800"
      >
        <button
          @click="emit('back-to-menu')"
          class="tile px-8 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300"
        >
          {{ $t("stats.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
