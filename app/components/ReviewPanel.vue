<script setup lang="ts">
// The Academy's Daily review: what's due today from the lessons already finished (utils/review.ts).
// Hidden until there's a finished lesson to review.
import type { TechniqueId } from "../utils/sudokuGrader";

import { localDateKey } from "../composables/useDailyPuzzle";
import { useTechniquePath } from "../composables/useTechniquePath";
import { SESSION_SIZE, dayLabel, dueToday, nextReviewDay } from "../utils/review";

const emit = defineEmits<{ (e: "review", ids: TechniqueId[]): void }>();
const { t, locale, locales } = useI18n();

const today = localDateKey();
const schedule = useTechniquePath().getReview();
const due = dueToday(schedule, today);
const next = nextReviewDay(schedule, today);
const lang = locales.value.find((l) => typeof l === "object" && l.code === locale.value);
const nextLabel = next
  ? dayLabel(
      next,
      today,
      (lang as { language?: string })?.language ?? locale.value,
      t("review.tomorrow"),
    )
  : "";
</script>

<template>
  <section
    v-if="Object.keys(schedule).length"
    class="panel flex flex-wrap items-center gap-3 p-4 sm:col-span-2"
    data-testid="review-panel"
  >
    <div class="min-w-0 flex-1">
      <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">{{ $t("review.title") }}</h2>
      <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400" data-testid="review-status">
        <template v-if="due.length">{{ $t("review.due", { n: due.length }) }}</template>
        <template v-else>{{ $t("review.caughtUp", { day: nextLabel }) }}</template>
      </p>
    </div>
    <button
      v-if="due.length"
      @click="emit('review', due.slice(0, SESSION_SIZE))"
      class="tile tile-primary shrink-0 px-4 py-2 text-sm font-bold"
    >
      {{ $t("review.start", { n: Math.min(due.length, SESSION_SIZE) }) }}
    </button>
  </section>
</template>
