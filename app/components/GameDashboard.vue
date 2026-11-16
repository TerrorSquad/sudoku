<script setup lang="ts">
defineProps<{
  formattedTime: string;
  isPaused: boolean;
  mistakes: number;
  /** 0 = unlimited. */
  maxMistakes: number;
  showTimer: boolean;
  /** Personal best to pace against, formatted; empty hides it. */
  bestTime: string;
  /** The clock has run past `bestTime`. */
  pastBest: boolean;
  /** `bestTime` is a friend's time from a challenge code, not the player's own best. */
  challenge?: boolean;
  showMistakes: boolean;
  difficulty: string;
}>();

defineEmits<{
  (e: "toggle-pause"): void;
  (e: "exit-game"): void;
}>();
</script>

<template>
  <div data-tour="pause" class="panel flex items-center justify-between gap-3 px-3.5 py-2.5">
    <div class="flex items-center gap-3">
      <!-- Exit button-->
      <button
        @click="$emit('exit-game')"
        :aria-label="$t('game.exitToMenu')"
        class="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <AppIcon
          class="h-5 w-5"
          path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
        />
      </button>

      <!-- Difficulty label-->
      <span
        class="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-violet-700 dark:text-violet-300"
      >
        {{ difficulty }}
      </span>
    </div>

    <!-- Timer -->
    <div class="flex shrink-0 items-center gap-2">
      <!-- The best sits under the clock on phones (no room beside it), to its left from sm up. -->
      <div v-if="showTimer" class="flex flex-col items-center sm:flex-row-reverse sm:gap-2">
        <span
          data-testid="timer"
          class="text-base font-bold text-zinc-900 tabular-nums 3xl:text-xl dark:text-zinc-100"
          >{{ formattedTime }}</span
        >
        <!-- Struck through once the clock passes it, so it doesn't rely on colour alone. -->
        <span
          v-if="bestTime"
          data-testid="best-time"
          :data-past="pastBest"
          class="text-[0.625rem] leading-none font-semibold text-zinc-500 tabular-nums sm:text-[0.6875rem]"
          :class="{ 'line-through decoration-rose-500/70': pastBest }"
          >{{ $t(challenge ? "game.toBeat" : "game.best", { time: bestTime })
          }}<span v-if="pastBest" class="sr-only">
            {{ $t(challenge ? "game.toBeatPassed" : "game.bestPassed") }}</span
          ></span
        >
      </div>
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
      v-if="showMistakes"
      class="flex shrink-0 items-center gap-1 text-xs text-zinc-600 3xl:text-sm dark:text-zinc-400"
    >
      <span>{{ $t("game.mistakes") }}:</span>
      <span class="font-bold text-rose-600 dark:text-rose-400">{{ mistakes }}</span>
      <span v-if="maxMistakes">/ {{ maxMistakes }}</span>
    </div>
  </div>
</template>
