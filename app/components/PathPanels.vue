<script setup lang="ts">
import type { Week } from "../utils/progression";
import type { TechniqueId } from "../utils/sudokuGrader";

// The technique path and the technique of the week, side by side in the Academy.
const emit = defineEmits<{
  (e: "lesson", id: TechniqueId): void;
  (e: "weekly", week: Week): void;
}>();

const { t } = useI18n();
const techName = (id: TechniqueId) => t(`hint.move.${id}.name`);

const path = useTechniquePath();
const nextId = nextChallenge(path.getDone());
const doneCount = path.pathDone();
const total = ACADEMY_TECHNIQUES.length;
// Key, technique and seed all from one date, so a click after midnight Sunday can't mix weeks.
const week = weekOf();
const weeklyDone = path.getWeeksDone().includes(week.key);
</script>

<template>
  <section class="panel p-4" data-testid="technique-path">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">
        {{ $t("path.title") }}
      </h2>
      <span class="text-xs font-bold text-violet-700 tabular-nums dark:text-violet-300">{{
        $t("path.progress", { done: doneCount, total })
      }}</span>
    </div>
    <div
      class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      aria-hidden="true"
    >
      <div
        class="h-full rounded-full bg-violet-600"
        :style="{ width: `${(doneCount / total) * 100}%` }"
      />
    </div>
    <template v-if="nextId">
      <p class="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        {{ $t("path.nextHint", { name: techName(nextId) }) }}
      </p>
      <button
        class="tile tile-primary mt-3 w-full px-3 py-2.5 text-sm font-bold"
        @click="emit('lesson', nextId)"
      >
        {{ $t("path.next") }}: {{ techName(nextId) }}
      </button>
    </template>
    <p v-else class="mt-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">
      {{ $t("path.allDone", { n: total }) }}
    </p>
  </section>

  <section class="panel p-4" data-testid="technique-of-week">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">
        {{ $t("weekly.title") }}
      </h2>
      <span v-if="weeklyDone" class="text-xs font-bold text-emerald-700 dark:text-emerald-400"
        >✓ {{ $t("weekly.done") }}</span
      >
    </div>
    <p class="mt-2 text-base font-black text-zinc-900 dark:text-zinc-100">
      {{ techName(week.technique) }}
    </p>
    <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{{ $t("weekly.desc") }}</p>
    <button
      class="tile tile-amber mt-3 w-full px-3 py-2.5 text-sm font-bold"
      @click="emit('weekly', week)"
    >
      {{ $t("weekly.play") }}
    </button>
  </section>
</template>
