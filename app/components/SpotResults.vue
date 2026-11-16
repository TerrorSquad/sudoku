<script setup lang="ts">
// The end of a Spot it round (each position's time, a best) or of a Daily review (each card's move).
import { computed } from "vue";

import type { TechniqueId } from "../utils/sudokuGrader";

import { dayLabel } from "../utils/review";
import { breakdown, formatSpotTime, totalTime, type SpotResult } from "../utils/spotIt";
import { localDateKey } from "../utils/streak";

const props = defineProps<{
  review: boolean;
  reviewed: { technique: TechniqueId; passed: boolean; box: number; next: string }[];
  results: SpotResult[];
  best: number | undefined;
  newBest: boolean;
}>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "again"): void;
  (e: "lesson", id: TechniqueId): void;
}>();
const { t, locale, locales } = useI18n();
const lang = computed(
  () => locales.value.find((l) => typeof l === "object" && l.code === locale.value)?.language,
);
const techName = (id: TechniqueId) => t(`hint.move.${id}.name`);

const rows = computed(() => breakdown(props.results));
</script>

<template>
  <!-- Review results: each technique's card, up a box or back to the first. -->
  <div v-if="review" class="mx-auto w-full max-w-md px-4 py-6" data-testid="review-done">
    <p class="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">
      {{ $t("review.doneTitle") }}
    </p>
    <ul class="mt-4 flex flex-col gap-2">
      <li
        v-for="r in reviewed"
        :key="r.technique"
        :data-passed="r.passed"
        class="panel flex items-center gap-3 p-3"
      >
        <span
          aria-hidden="true"
          :class="
            r.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'
          "
          class="text-lg font-black"
          >{{ r.passed ? "↑" : "↺" }}</span
        >
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{{
            techName(r.technique)
          }}</span>
          <span class="block text-xs text-zinc-600 dark:text-zinc-400">
            {{ r.passed ? $t("review.up", { box: r.box }) : $t("review.reset") }} ·
            {{
              $t("review.next", {
                day: dayLabel(r.next, localDateKey(), lang ?? locale, $t("review.tomorrow")),
              })
            }}
          </span>
        </span>
        <button
          v-if="!r.passed"
          @click="emit('lesson', r.technique)"
          class="tile shrink-0 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300"
        >
          {{ $t("spot.learn") }}
        </button>
      </li>
    </ul>
    <button @click="emit('back')" class="tile tile-primary mt-6 w-full py-3 text-sm font-bold">
      {{ $t("lesson.back") }}
    </button>
  </div>

  <!-- Results -->
  <div v-else class="mx-auto w-full max-w-md px-4 py-6" data-testid="spot-done">
    <section class="panel flex flex-col gap-3 p-5 text-center">
      <p class="text-xs font-bold text-zinc-600 dark:text-zinc-400">{{ $t("spot.total") }}</p>
      <p
        data-testid="spot-total"
        class="font-display text-4xl font-black text-zinc-900 tabular-nums dark:text-zinc-50"
      >
        {{ formatSpotTime(totalTime(results)) }}
      </p>
      <p v-if="newBest" class="text-sm font-bold text-amber-700 dark:text-amber-400">
        {{ $t("spot.newBest") }}
        <span v-if="best !== undefined" class="font-semibold">{{
          $t("spot.was", { time: formatSpotTime(best) })
        }}</span>
      </p>
      <p v-else-if="best !== undefined" class="text-sm text-zinc-600 dark:text-zinc-400">
        {{ $t("spot.best", { time: formatSpotTime(best) }) }}
      </p>
    </section>

    <h2 class="mt-6 mb-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
      {{ $t("spot.breakdown") }}
    </h2>
    <ul class="flex flex-col gap-2" data-testid="spot-breakdown">
      <li v-for="row in rows" :key="row.technique" class="panel flex items-center gap-3 p-3">
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{{
            techName(row.technique)
          }}</span>
          <span class="block text-xs text-zinc-600 dark:text-zinc-400">
            {{ $t("spot.average", { time: formatSpotTime(row.average) }) }}
            <template v-if="row.misses"> · {{ $t("spot.misses", { n: row.misses }) }}</template>
            <template v-if="row.skips"> · {{ $t("spot.skips", { n: row.skips }) }}</template>
          </span>
        </span>
        <button
          v-if="row.weak"
          @click="emit('lesson', row.technique)"
          class="tile shrink-0 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300"
        >
          {{ $t("spot.learn") }}
        </button>
      </li>
    </ul>

    <div class="mt-6 flex gap-2">
      <button @click="emit('again')" class="tile tile-primary flex-1 py-3 text-sm font-bold">
        {{ $t("spot.again") }}
      </button>
      <button @click="emit('back')" class="tile flex-1 py-3 text-sm font-bold">
        {{ $t("lesson.back") }}
      </button>
    </div>
  </div>
</template>
