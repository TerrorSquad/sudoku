<script setup lang="ts">
import { useDailyPuzzle } from "../composables/useDailyPuzzle";
import { calendarDays } from "../utils/calendar";

const WEEKS = 12;
const daily = useDailyPuzzle();

const days = calendarDays(new Date(), WEEKS).map((d) => ({
  key: d.key,
  future: d.future,
  done: !d.future && daily.getRecordFor(d.key)?.completed === true,
}));
const completed = days.filter((d) => d.done).length;
const today = daily.todayKey();
</script>

<template>
  <div>
    <h2
      class="mb-3 flex items-baseline justify-between text-xs font-bold tracking-widest text-zinc-500 uppercase"
    >
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
        :title="d.future ? undefined : d.key"
        :data-done="d.done"
        :class="[
          d.future
            ? 'bg-transparent'
            : d.done
              ? 'bg-violet-500 dark:bg-violet-400'
              : 'bg-zinc-200 dark:bg-zinc-800',
          d.key === today
            ? 'ring-1 ring-violet-500 ring-offset-1 dark:ring-violet-300 dark:ring-offset-[#0c0a09]'
            : '',
        ]"
        class="h-5 w-5"
      />
    </div>
  </div>
</template>
