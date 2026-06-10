<script setup lang="ts">
defineProps<{
  formattedTime: string;
  isPaused: boolean;
  mistakes: number;
  maxMistakes: number;
  hintStatus: string;
  difficulty: string;
}>();

defineEmits<{
  (e: 'toggle-pause'): void;
  (e: 'exit-game'): void;
}>();
</script>

<template>
  <div class="flex flex-col gap-2 w-full">
    <div class="flex justify-between items-center">
      <button
        @click="$emit('exit-game')"
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors dark:text-zinc-400 dark:hover:text-zinc-100 text-zinc-600 hover:text-zinc-900"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
        <span>{{ $t('game.exitToMenu') }}</span>
      </button>

      <span class="px-2.5 py-0.5 text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-wide">
        {{ difficulty }}
      </span>
    </div>

    <div class="flex items-center justify-between border px-3.5 py-2.5 gap-3 dark:bg-zinc-900/60 dark:border-zinc-800 bg-zinc-50 border-zinc-200">
      <!-- Timer -->
      <div class="flex items-center gap-2 shrink-0">
        <span class="font-mono font-bold text-base 3xl:text-xl tabular-nums dark:text-zinc-100 text-zinc-900">{{ formattedTime }}</span>
        <button @click="$emit('toggle-pause')" class="p-1 transition-colors rounded dark:hover:bg-zinc-800 hover:bg-zinc-200">
          <svg v-if="!isPaused" class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
        </button>
      </div>

      <!-- Hint status -->
      <div class="text-[11px] 3xl:text-sm text-amber-400 font-bold tracking-wide uppercase truncate text-center flex-1 min-w-0">
        {{ hintStatus }}
      </div>

      <!-- Mistakes -->
      <div class="flex items-center gap-1 text-xs 3xl:text-sm shrink-0 dark:text-zinc-400 text-zinc-600">
        <span>{{ $t('game.mistakes') }}:</span>
        <span class="font-bold text-rose-400">{{ mistakes }}</span>
        <span>/ {{ maxMistakes }}</span>
      </div>
    </div>
  </div>
</template>
