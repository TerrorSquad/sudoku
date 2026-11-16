<script setup lang="ts">
const WEEKS = 12;
const daily = useDailyPuzzle();

const frozen = new Set(daily.getStreakState().frozen);
// A day is done when any level's Daily was (the streak counts it the same way).
const doneDays = daily.getCompletedDays();
const days = calendarDays(new Date(), WEEKS).map((d) => ({
  key: d.key,
  future: d.future,
  done: !d.future && doneDays.has(d.key),
  frozen: frozen.has(d.key),
}));
const completed = days.filter((d) => d.done).length;
const today = daily.todayKey();
</script>

<template>
  <div>
    <h2 class="mb-3 flex items-baseline justify-between text-xs font-bold text-zinc-500">
      <span>{{ $t("stats.dailyActivity") }}</span>
      <span class="font-semibold tracking-normal normal-case tabular-nums">{{
        $t("stats.dailyDone", { n: completed, weeks: WEEKS })
      }}</span>
    </h2>
    <!-- Column-major: one column per week, Monday at the top. -->
    <div
      class="grid w-max max-w-full grid-flow-col grid-rows-7 gap-1 overflow-x-auto"
      :style="{ gridTemplateColumns: `repeat(${WEEKS}, 1.25rem)` }"
      role="img"
      :aria-label="$t('stats.dailyDone', { n: completed, weeks: WEEKS })"
    >
      <span
        v-for="d in days"
        :key="d.key"
        :title="d.future ? undefined : d.frozen ? `${d.key} · ${$t('streak.frozenDay')}` : d.key"
        :data-done="d.done"
        :data-frozen="d.frozen || undefined"
        :class="[
          d.future
            ? 'bg-transparent'
            : d.done
              ? 'bg-violet-500 dark:bg-violet-400'
              : d.frozen
                ? 'bg-sky-300 dark:bg-sky-700'
                : 'bg-zinc-200 dark:bg-zinc-800',
          d.key === today
            ? 'ring-1 ring-violet-500 ring-offset-1 dark:ring-violet-300 dark:ring-offset-[var(--ground)]'
            : '',
        ]"
        class="h-5 w-5"
      />
    </div>
    <p class="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
      <span class="inline-block h-3 w-3 shrink-0 bg-sky-300 dark:bg-sky-700" aria-hidden="true" />
      {{ $t("streak.freezeHelp", { n: FREEZE_EVERY, max: MAX_FREEZES }) }}
    </p>
  </div>
</template>
