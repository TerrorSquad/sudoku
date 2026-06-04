<script setup lang="ts">
defineProps<{
  formattedTime: string;
  isPaused: boolean;
  mistakes: number;
  maxMistakes: number;
  hintStatus: string;
  hintBody: string; // Dodat puni opis tehnike
  difficulty: string;
}>();

defineEmits<{
  (e: 'toggle-pause'): void;
  (e: 'exit-game'): void; // Novi emiter za povratak u meni
}>();
</script>

<template>
  <div class="flex flex-col gap-2 w-full">
    <div class="flex justify-between items-center py-0.5">
      <button @click="$emit('exit-game')" class="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors uppercase tracking-wider">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path>
        </svg>
        <span>Izlaz u Meni</span>
      </button>

      <span class="px-2.5 py-0.5 text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase">
        {{ difficulty }}
      </span>
    </div>

    <div class="flex justify-between items-center bg-zinc-900/50 border border-zinc-800 px-3.5 py-2.5 text-xs rounded-none">
      <div class="flex items-center gap-2 text-zinc-300">
        <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="font-mono font-bold text-sm text-zinc-200">{{ formattedTime }}</span>
        <button @click="$emit('toggle-pause')" class="p-1 hover:bg-zinc-800 transition-colors">
          <svg v-if="!isPaused" class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <svg v-else class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
          </svg>
        </button>
      </div>

      <div class="text-[11px] text-amber-400 font-black tracking-wide uppercase">
        {{ hintStatus }}
      </div>

      <div class="flex items-center gap-1 text-zinc-400">
        <span>Greške:</span>
        <span class="font-bold text-rose-400">{{ mistakes }}</span>
        <span>/ {{ maxMistakes }}</span>
      </div>
    </div>

    <div v-if="hintBody && hintBody !== 'Spreman za igru'" class="bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300 leading-relaxed transition-all animate-fade-in">
      <span class="font-bold text-amber-400 block mb-0.5">💡 Logička Analiza:</span>
      {{ hintBody }}
    </div>
  </div>
</template>