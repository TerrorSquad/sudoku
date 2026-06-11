<script setup lang="ts">
interface Props {
  counts: number[];
}

defineProps<Props>();
defineEmits<{
  (e: 'input-number', num: number): void;
}>();
</script>

<template>
  <div class="grid grid-cols-9 gap-1.5 mt-1 pb-1">
    <button
      v-for="n in 9"
      :key="n"
      @click="$emit('input-number', n)"
      :disabled="9 - counts[n]! <= 0"
      :class="9 - counts[n]! <= 0 ? 'opacity-30 pointer-events-none' : 'dark:hover:bg-zinc-800 hover:bg-zinc-100 active:scale-95'"
      class="relative py-3 sm:py-4 3xl:py-5 text-xl sm:text-2xl 3xl:text-3xl font-black font-game transition-all border flex items-center justify-center dark:bg-zinc-900 dark:border-zinc-800 bg-zinc-50 border-zinc-200"
    >
      <span>{{ n }}</span>
      <span
        v-if="9 - counts[n]! > 0"
        class="absolute top-1 right-1 text-[9px] 3xl:text-[12px] dark:text-violet-400 text-violet-600 font-extrabold tabular-nums leading-none"
      >
        {{ Math.max(0, 9 - counts[n]!) }}
      </span>
      <span
        v-else
        :key="`done-${n}`"
        class="digit-done absolute top-0.5 right-0.5 text-[10px] 3xl:text-[13px] dark:text-emerald-400 text-emerald-600 font-black leading-none"
      >✓</span>
    </button>
  </div>
</template>

<style scoped>
@keyframes digit-done {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.4); }
  100% { transform: scale(1)   rotate(0);    opacity: 1; }
}
.digit-done { animation: digit-done 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
</style>
