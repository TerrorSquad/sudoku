<script setup lang="ts">
import { digitLabel, dotClass } from "../utils/sudokuColors";

// Controller: the digit A or X enters, and the buttons for this screen.
defineProps<{ digit: number; colorMode: boolean; game: boolean }>();
const { t } = useI18n();
</script>

<template>
  <div
    data-testid="pad-hud"
    aria-hidden="true"
    class="panel fixed bottom-3 left-3 z-40 flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
  >
    <span v-if="colorMode" :class="dotClass(digit)" class="h-6 w-6" />
    <span
      :class="colorMode ? 'text-sm' : 'font-game text-2xl'"
      class="font-black text-violet-700 dark:text-violet-300"
      >{{ digitLabel(digit, colorMode, t) }}</span
    >
    <span>{{ $t(game ? "pad.game" : "pad.academy") }}</span>
  </div>
</template>
