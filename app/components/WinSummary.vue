<script setup lang="ts">
import type { StuckMoment } from "../utils/stuckMoments";
import type { TechniqueId } from "../utils/sudokuGrader";

import { usePreferences } from "../composables/usePreferences";
import { useTechniqueStats } from "../composables/useTechniqueStats";
import { formatTime } from "../composables/useTimer";

// The win modal's summary: the level, mistakes and hints, and the techniques the game took.
defineProps<{
  difficultyLabel: string;
  zen: boolean;
  mistakes: number;
  hintsUsed: number;
  neededTechs: TechniqueId[];
  stuck: StuckMoment[];
  techniqueLog: TechniqueId[];
}>();
const emit = defineEmits<{ lesson: [id: TechniqueId] }>();

const { mistakeLimit } = usePreferences();
// Lifetime per-technique usage, read as the modal opens.
const techStatsTotals = useTechniqueStats().getAll();
</script>

<template>
  <div
    class="mb-5 divide-y divide-zinc-200 border border-zinc-200 text-left dark:divide-zinc-800 dark:border-zinc-800"
  >
    <div class="flex justify-between px-3 py-2">
      <span class="text-xs font-semibold text-zinc-500">{{ $t("modal.difficulty") }}</span>
      <span class="text-xs font-bold text-zinc-800 dark:text-zinc-200">{{ difficultyLabel }}</span>
    </div>
    <div class="flex justify-between px-3 py-2">
      <span class="text-xs font-semibold text-zinc-500">{{ $t("game.mistakes") }}</span>
      <span
        class="text-xs font-bold"
        :class="
          mistakes === 0
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400'
        "
        >{{ mistakes }}{{ mistakeLimit && !zen ? ` / ${mistakeLimit}` : "" }}</span
      >
    </div>
    <div class="flex justify-between px-3 py-2">
      <span class="text-xs font-semibold text-zinc-500">{{ $t("modal.hintsUsed") }}</span>
      <span
        class="text-xs font-bold"
        :class="
          hintsUsed === 0
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-amber-700 dark:text-amber-400'
        "
        >{{ hintsUsed }}</span
      >
    </div>
    <div v-if="neededTechs.length" class="px-3 py-2" data-testid="needed-techniques">
      <p class="mb-2 text-xs font-semibold text-zinc-500">
        {{ $t("modal.needed") }}
      </p>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="id in neededTechs"
          :key="id"
          @click="emit('lesson', id)"
          :title="$t('modal.openLesson')"
          class="min-h-6 border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[0.6875rem] font-semibold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
        >
          {{ $t(`hint.move.${id}.name`) }}
        </button>
      </div>
    </div>
    <div v-if="stuck.length" class="px-3 py-2" data-testid="stuck-moments">
      <p class="mb-2 text-xs font-semibold text-zinc-500">
        {{ $t("modal.stuck") }}
      </p>
      <ul class="space-y-1.5">
        <li
          v-for="m in stuck"
          :key="m.at"
          class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"
        >
          <span class="text-xs text-zinc-700 tabular-nums dark:text-zinc-300">{{
            $t("modal.stuckAt", {
              at: formatTime(m.at),
              gap: formatTime(m.gap),
            })
          }}</span>
          <button
            v-if="m.technique"
            @click="emit('lesson', m.technique!)"
            :title="$t('modal.openLesson')"
            class="min-h-6 border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[0.6875rem] font-semibold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
          >
            {{ $t(`hint.move.${m.technique}.name`) }}
          </button>
        </li>
      </ul>
    </div>
    <div v-if="techniqueLog.length" class="px-3 py-2">
      <p class="mb-2 text-xs font-semibold text-zinc-500">
        {{ $t("modal.techniquesUsed") }}
      </p>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="id in techniqueLog"
          :key="id"
          :title="$t('modal.usedTotal', { n: techStatsTotals[id] ?? 1 })"
          class="border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-amber-700 dark:text-amber-400"
          >{{ $t(`hint.move.${id}.name`) }}
          <span class="opacity-70">×{{ techStatsTotals[id] ?? 1 }}</span></span
        >
      </div>
    </div>
  </div>
</template>
