<script setup lang="ts">
defineProps<{
  formattedTime: string;
  isPaused: boolean;
  mistakes: number;
  maxMistakes: number;
  difficulty: string;
}>();

defineEmits<{
  (e: "toggle-pause"): void;
  (e: "exit-game"): void;
}>();
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60"
  >
    <!-- Exit button-->
    <button
      @click="$emit('exit-game')"
      :aria-label="$t('game.exitToMenu')"
      class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-600 uppercase transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <AppIcon class="h-5 w-5" path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
    </button>

    <!-- Difficulty label-->
    <span
      class="border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-violet-600 uppercase dark:text-violet-400"
    >
      {{ difficulty }}
    </span>

    <!-- Timer -->
    <div class="flex shrink-0 items-center gap-2">
      <span
        class="font-mono text-base font-bold text-zinc-900 tabular-nums 3xl:text-xl dark:text-zinc-100"
        >{{ formattedTime }}</span
      >
      <button
        @click="$emit('toggle-pause')"
        :aria-label="isPaused ? $t('game.resume') : $t('game.pause')"
        class="rounded p-1 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800"
      >
        <AppIcon
          v-if="!isPaused"
          class="h-4 w-4 text-violet-600 dark:text-violet-400"
          path="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <AppIcon
          v-else
          class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
      </button>
    </div>

    <!-- Mistakes -->
    <div
      class="flex shrink-0 items-center gap-1 text-xs text-zinc-600 3xl:text-sm dark:text-zinc-400"
    >
      <span>{{ $t("game.mistakes") }}:</span>
      <span class="font-bold text-rose-600 dark:text-rose-400">{{ mistakes }}</span>
      <span>/ {{ maxMistakes }}</span>
    </div>
  </div>
</template>
