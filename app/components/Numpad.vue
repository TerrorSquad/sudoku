<script setup lang="ts">
import { dotClass } from "../utils/sudokuColors";

interface Props {
  counts: number[];
  colorMode: boolean;
}

defineProps<Props>();
defineEmits<{
  (e: "input-number", num: number): void;
}>();
</script>

<template>
  <!-- One row of nine from lg up: gives the board the height the second row used. -->
  <div data-testid="numpad" class="grid grid-cols-5 gap-2 lg:grid-cols-9">
    <button
      v-for="n in 9"
      :key="n"
      @click="$emit('input-number', n)"
      :disabled="9 - counts[n]! <= 0"
      :class="
        9 - counts[n]! <= 0
          ? 'pointer-events-none opacity-30'
          : 'hover:bg-zinc-100 active:scale-95 dark:hover:bg-zinc-800'
      "
      class="relative flex items-center justify-center border border-zinc-200 bg-zinc-50 py-5 font-game text-3xl font-black transition-all 3xl:py-5 3xl:text-4xl lg:py-3 lg:text-2xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span v-if="colorMode" :class="dotClass(n)" class="h-6 w-6 3xl:h-9 3xl:w-9" />
      <span v-else>{{ n }}</span>
      <span
        v-if="9 - counts[n]! > 0"
        class="absolute top-1 right-1.5 text-[10px] leading-none font-extrabold text-violet-600 tabular-nums 3xl:text-[13px] dark:text-violet-400"
      >
        {{ Math.max(0, 9 - counts[n]!) }}
      </span>
      <span
        v-else
        :key="`done-${n}`"
        class="digit-done absolute top-1 right-1.5 text-[11px] leading-none font-black text-emerald-600 3xl:text-[14px] dark:text-emerald-400"
        >✓</span
      >
    </button>
  </div>
</template>

<style scoped>
@keyframes digit-done {
  0% {
    transform: scale(0) rotate(-30deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.4);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}
.digit-done {
  animation: digit-done 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
</style>
