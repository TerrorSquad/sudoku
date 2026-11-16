<script setup lang="ts">
interface Props {
  counts: number[];
  colorMode: boolean;
  /** Digit-first input: the digit currently armed, if any. */
  activeDigit?: number | null;
  digitFirst?: boolean;
}

defineProps<Props>();
const { t } = useI18n();
defineEmits<{
  (e: "input-number", num: number): void;
}>();
</script>

<template>
  <!-- One row of nine from lg up: gives the board the height the second row used. -->
  <div data-testid="numpad" data-tour="digits" class="grid grid-cols-5 gap-2 lg:grid-cols-9">
    <button
      v-for="n in 9"
      :key="n"
      @click="$emit('input-number', n)"
      :disabled="9 - counts[n]! <= 0"
      :aria-label="
        9 - counts[n]! > 0
          ? t('a11y.digitLeft', { num: digitLabel(n, colorMode, t), count: 9 - counts[n]! })
          : digitLabel(n, colorMode, t)
      "
      :aria-pressed="digitFirst ? activeDigit === n : undefined"
      :class="[
        9 - counts[n]! <= 0 ? 'pointer-events-none opacity-30' : '',
        digitFirst && activeDigit === n
          ? '!border-violet-500 !bg-violet-100 ring-2 ring-violet-500 dark:!bg-violet-500/20'
          : '',
      ]"
      class="tile relative flex items-center justify-center py-5 font-game text-3xl font-black 3xl:py-5 3xl:text-4xl lg:py-3 lg:text-2xl"
    >
      <span v-if="colorMode" :class="dotClass(n)" class="h-6 w-6 3xl:h-9 3xl:w-9" />
      <span v-else>{{ n }}</span>
      <!-- Keeps the digit and its count separate words in the visible text, which must match the label. -->
      {{ " " }}
      <span
        v-if="9 - counts[n]! > 0"
        class="absolute top-1 right-1.5 text-[0.625rem] leading-none font-extrabold text-violet-600 tabular-nums 3xl:text-[0.8125rem] dark:text-violet-300"
      >
        {{ Math.max(0, 9 - counts[n]!) }}
      </span>
      <span
        v-else
        :key="`done-${n}`"
        class="digit-done absolute top-1 right-1.5 text-[0.6875rem] leading-none font-black text-emerald-600 3xl:text-sm dark:text-emerald-400"
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
