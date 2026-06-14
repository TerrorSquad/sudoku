<script setup lang="ts">
import { computed } from "vue";

interface ExplanationStep {
  label: string;
  description: string;
}

interface ComplexHint {
  title: string;
  targetCell: { r: number; c: number };
  targetNum: number;
  steps: ExplanationStep[];
}

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
    class="w-full border p-4 flex flex-col select-none dark:bg-zinc-900/40 dark:border-zinc-800 bg-zinc-50 border-zinc-200 3xl:mt-12"
  >
    <!-- Empty state -->
    <div
      v-if="!activeComplexHint"
      class="flex flex-col items-center justify-center text-center p-6 py-10"
    >
      <div
        class="p-3 border text-zinc-500 mb-4 dark:bg-zinc-800 dark:border-zinc-700 bg-zinc-100 border-zinc-300"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </div>
      <h3
        class="text-sm 3xl:text-base font-bold uppercase tracking-wider dark:text-zinc-400 text-zinc-600"
      >
        {{ $t("hint.panelTitle") }}
      </h3>
      <p class="text-xs 3xl:text-sm text-zinc-500 max-w-xs mt-2 leading-relaxed">
        {{ $t("hint.panelDesc") }}
      </p>
    </div>

    <!-- Active hint -->
    <div v-else class="flex flex-col gap-4">
      <!-- Technique title -->
      <div class="border-b pb-3 dark:border-zinc-800 border-zinc-200">
        <span
          class="text-[10px] font-bold dark:text-amber-400 text-amber-700 uppercase tracking-widest block mb-1"
        >
          {{ $t("hint.detectedTechnique") }}
        </span>
        <h2
          class="text-lg 3xl:text-2xl font-black tracking-tight leading-tight dark:text-zinc-100 text-zinc-900"
        >
          {{ activeComplexHint.title }}
        </h2>
      </div>

      <!-- Step progress bar -->
      <div class="flex gap-1.5">
        <div
          v-for="(step, idx) in activeComplexHint.steps"
          :key="idx"
          :class="idx <= currentStepIndex ? 'bg-amber-500' : 'dark:bg-zinc-800 bg-zinc-200'"
          class="h-1 flex-grow transition-colors duration-150"
        />
      </div>

      <!-- Step content -->
      <div
        v-if="currentStep"
        class="border p-4 space-y-2 dark:bg-zinc-950/60 dark:border-zinc-800 bg-zinc-100 border-zinc-200"
      >
        <h4
          class="text-xs 3xl:text-sm font-black dark:text-amber-400 text-amber-700 uppercase tracking-wider font-mono"
        >
          {{ $t("hint.step", { n: currentStepIndex + 1 }) }}: {{ currentStep.label }}
        </h4>
        <p class="text-sm 3xl:text-base leading-relaxed dark:text-zinc-300 text-zinc-700">
          {{ currentStep.description }}
        </p>
      </div>

      <!-- Legend -->
      <div
        class="border-t pt-3 space-y-1.5 text-xs 3xl:text-sm font-medium text-zinc-500 dark:border-zinc-800/60 border-zinc-200"
      >
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 shrink-0 bg-emerald-500/20 border border-emerald-500" />
          <span>{{ $t("hint.targetCell") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 shrink-0 bg-indigo-500/20 border border-indigo-400" />
          <span>{{ $t("hint.triggerCells") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 shrink-0 bg-rose-500/20 border border-rose-400" />
          <span>{{ $t("hint.eliminations") }}</span>
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex flex-col gap-2 border-t pt-3 dark:border-zinc-800 border-zinc-200">
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="emit('prev-step')"
            :disabled="currentStepIndex === 0"
            :class="
              currentStepIndex === 0
                ? 'opacity-30 pointer-events-none'
                : 'dark:hover:bg-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 text-zinc-800'
            "
            class="py-2.5 3xl:py-3 border text-xs 3xl:text-sm font-bold uppercase transition-all active:scale-95 dark:bg-zinc-900 dark:border-zinc-800 bg-zinc-50 border-zinc-200"
          >
            {{ $t("hint.prev") }}
          </button>

          <button
            @click="emit('next-step')"
            :class="
              isLastStep
                ? 'bg-emerald-600/20 border-emerald-500 dark:text-emerald-400 text-emerald-700 hover:bg-emerald-600/30'
                : 'bg-amber-500/10 border-amber-500/30 dark:text-amber-400 text-amber-700 hover:bg-amber-500/20'
            "
            class="py-2.5 border text-xs font-black uppercase transition-all active:scale-95"
          >
            {{ isLastStep ? $t("hint.apply") : $t("hint.next") }}
          </button>
        </div>

        <button
          @click="emit('cancel')"
          class="w-full py-2 3xl:py-3 text-zinc-500 dark:hover:text-rose-400 hover:text-rose-600 text-xs 3xl:text-sm uppercase font-bold tracking-wider transition-colors"
        >
          {{ $t("hint.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>
