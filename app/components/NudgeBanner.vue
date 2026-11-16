<script setup lang="ts">
import type { TechniqueId } from "../utils/sudokuGrader";

// Nudge: names the technique and where to look before the full explanation.
defineProps<{ technique: TechniqueId | null; unit: string }>();
defineEmits<{ lesson: []; explain: [] }>();
</script>

<template>
  <div
    role="status"
    class="flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-300/25 px-3 py-2 text-xs text-amber-950 dark:bg-amber-400/10 dark:text-amber-200"
  >
    <i18n-t v-if="technique" keypath="hint.nudge.body" tag="p" scope="global">
      <template #unit>{{ unit }}</template>
      <template #technique>
        <button
          @click="$emit('lesson')"
          :title="$t('modal.openLesson')"
          class="font-bold underline decoration-amber-600/60 underline-offset-2 hover:decoration-2"
        >
          {{ $t(`hint.move.${technique}.name`) }}
        </button>
      </template>
    </i18n-t>
    <p v-else>{{ $t("hint.nudge.wrong", { unit }) }}</p>
    <button
      @click="$emit('explain')"
      class="shrink-0 border border-amber-600/50 px-2 py-1 font-bold transition-colors hover:bg-amber-400/30"
    >
      {{ $t("hint.nudge.explain") }}
    </button>
  </div>
</template>
