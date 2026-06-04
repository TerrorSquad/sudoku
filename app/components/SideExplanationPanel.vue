<script setup lang="ts">
import { computed } from 'vue';

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
  (e: 'next-step'): void;
  (e: 'prev-step'): void;
  (e: 'cancel'): void;
}>();

const isLastStep = computed(() => {
  if (!props.activeComplexHint) return false;
  return props.currentStepIndex === props.activeComplexHint.steps.length - 1;
});
</script>

<template>
  <div class="h-full w-full bg-zinc-900/40 border border-zinc-800 p-4 flex flex-col justify-between antialiased select-none">

    <div v-if="!activeComplexHint" class="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
      <div class="p-3 bg-zinc-800 border border-zinc-750 text-zinc-500 mb-3">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>
      </div>
      <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-wider">Analitički Panel</h3>
      <p class="text-xs text-zinc-500 max-w-xs mt-1.5 leading-relaxed">
        Kliknite na dugme **"CSP Savjet"** tokom igre kako biste aktivirali duboku logičku analizu i step-by-step dekonstrukciju kompleksnih tehnika.
      </p>
    </div>

    <div v-else class="flex flex-col h-full justify-between gap-4">
      <div class="space-y-4">
        <div class="border-b border-zinc-800 pb-3">
          <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-0.5">Detektovana Tehnika:</span>
          <h2 class="text-xl font-black text-zinc-100 tracking-tight">{{ activeComplexHint.title }}</h2>
        </div>

        <div class="flex gap-1.5">
          <div
            v-for="(step, idx) in activeComplexHint.steps"
            :key="idx"
            :class="idx <= currentStepIndex ? 'bg-amber-500' : 'bg-zinc-800'"
            class="h-1.5 flex-grow transition-colors duration-150"
          ></div>
        </div>

        <div v-if="currentStep" class="bg-zinc-950/60 border border-zinc-850 p-4 space-y-2 animate-fade-in">
          <h4 class="text-xs font-black text-amber-400 uppercase tracking-wider font-mono">
            Korak {{ currentStepIndex + 1 }}: {{ currentStep.label }}
          </h4>
          <p class="text-xs text-zinc-350 leading-relaxed font-medium">
            {{ currentStep.description }}
          </p>
        </div>

        <div class="border-t border-zinc-800/60 pt-3 space-y-1.5 text-[11px] font-semibold text-zinc-400">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 bg-emerald-500/20 border border-emerald-500"></span>
            <span>Ciljna ćelija (Polje koje se rješava)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 bg-indigo-500/20 border border-indigo-400"></span>
            <span>Ćelije dokaza (Trigeri logičkog pravila)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 bg-rose-500/20 border border-rose-400"></span>
            <span>Eliminacije (Čišćenje konfliktnih kandidata)</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="emit('prev-step')"
            :disabled="currentStepIndex === 0"
            :class="currentStepIndex === 0 ? 'opacity-30 pointer-events-none' : 'hover:bg-zinc-800 text-zinc-200'"
            class="py-2.5 bg-zinc-900 border border-zinc-800 text-xs font-bold uppercase transition-all active:scale-95 rounded-none"
          >
            Prethodni
          </button>

          <button
            @click="emit('next-step')"
            :class="isLastStep ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 hover:bg-emerald-600/30' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'"
            class="py-2.5 border text-xs font-black uppercase transition-all active:scale-95 rounded-none"
          >
            {{ isLastStep ? 'Upiši Broj' : 'Sljedeći' }}
          </button>
        </div>

        <button
          @click="emit('cancel')"
          class="w-full py-2 bg-transparent hover:text-rose-400 text-zinc-500 text-[11px] uppercase font-bold tracking-wider transition-colors mt-1"
        >
          Prekini Analizu
        </button>
      </div>

    </div>
  </div>
</template>