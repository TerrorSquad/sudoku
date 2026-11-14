<script setup lang="ts">
import { computed } from "vue";

import type { ComplexHint, ExplanationStep } from "../composables/useSudokuEngine";

const props = defineProps<{
  activeComplexHint: ComplexHint | null;
  currentStepIndex: number;
  currentStep: ExplanationStep | null;
}>();

const emit = defineEmits<{
  (e: "next-step"): void;
  (e: "prev-step"): void;
  (e: "cancel"): void;
}>();

const isLastStep = computed(() => {
  if (!props.activeComplexHint) return false;
  return props.currentStepIndex === props.activeComplexHint.steps.length - 1;
});
</script>

<template>
  <div
    class="panel flex w-full flex-col p-4 select-none 3xl:mt-12"
  >
    <!-- Empty state -->
    <div
      v-if="!activeComplexHint"
      class="flex flex-col items-center justify-center p-6 py-10 text-center"
    >
      <div
        class="tray mb-4 p-3 text-amber-600 dark:text-amber-400"
      >
        <AppIcon
          class="h-8 w-8"
          :stroke-width="1.5"
          path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </div>
      <h3 class="text-sm font-bold text-zinc-600 3xl:text-base dark:text-zinc-400">
        {{ $t("hint.panelTitle") }}
      </h3>
      <p class="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500 3xl:text-sm">
        {{ $t("hint.panelDesc") }}
      </p>
    </div>

    <!-- Active hint -->
    <div v-else class="flex flex-col gap-4">
      <!-- Technique title -->
      <div class="border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <span class="mb-1 block text-[10px] font-bold text-amber-700 dark:text-amber-400">
          {{ $t("hint.detectedTechnique") }}
        </span>
        <h2
          class="text-lg leading-tight font-black tracking-tight text-zinc-900 3xl:text-2xl dark:text-zinc-100"
        >
          {{ activeComplexHint.title }}
        </h2>
      </div>

      <!-- Step progress bar -->
      <div class="flex gap-1.5">
        <div
          v-for="(step, idx) in activeComplexHint.steps"
          :key="idx"
          :class="idx <= currentStepIndex ? 'bg-amber-500' : 'bg-zinc-200 dark:bg-zinc-800'"
          class="h-1 flex-grow transition-colors duration-150"
        />
      </div>

      <!-- Step content -->
      <div
        v-if="currentStep"
        class="space-y-2 border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
      >
        <h4 class="font-mono text-xs font-black text-amber-700 3xl:text-sm dark:text-amber-400">
          {{ $t("hint.step", { n: currentStepIndex + 1 }) }}: {{ currentStep.label }}
        </h4>
        <p class="text-sm leading-relaxed text-zinc-700 3xl:text-base dark:text-zinc-300">
          {{ currentStep.description }}
        </p>
      </div>

      <!-- Legend -->
      <div
        class="space-y-1.5 border-t border-zinc-200 pt-3 text-xs font-medium text-zinc-500 3xl:text-sm dark:border-zinc-800/60"
      >
        <!-- Only the colours this hint uses: a placement has a target, a removal has eliminations. -->
        <div v-if="activeComplexHint.targetCell" class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 border border-emerald-500 bg-emerald-500/20" />
          <span>{{ $t("hint.targetCell") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 border border-indigo-400 bg-indigo-500/20" />
          <span>{{ $t("hint.triggerCells") }}</span>
        </div>
        <div v-if="!activeComplexHint.targetCell" class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 border border-rose-400 bg-rose-500/20" />
          <span>{{ $t("hint.eliminations") }}</span>
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="emit('prev-step')"
            :disabled="currentStepIndex === 0"
            :class="
              currentStepIndex === 0
                ? 'pointer-events-none opacity-30'
                : 'text-zinc-800 dark:text-zinc-200'
            "
            class="tile py-2.5 text-xs font-bold 3xl:py-3 3xl:text-sm"
          >
            {{ $t("hint.prev") }}
          </button>

          <button
            @click="emit('next-step')"
            :class="
              isLastStep
                ? 'tile-apply'
                : 'tile-amber'
            "
            class="tile py-2.5 text-xs font-black 3xl:py-3 3xl:text-sm"
          >
            {{ isLastStep ? $t("hint.apply") : $t("hint.next") }}
          </button>
        </div>

        <button
          @click="emit('cancel')"
          class="w-full py-2 text-xs font-bold text-zinc-500 transition-colors hover:text-rose-600 3xl:py-3 3xl:text-sm dark:hover:text-rose-400"
        >
          {{ $t("hint.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>
