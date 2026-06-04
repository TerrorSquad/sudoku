<script setup lang="ts">
interface Props {
  counts: number[];
}

defineProps<Props>();
defineEmits<{
  (e: "input-number", num: number): void;
}>();
</script>

<template>
  <div class="grid grid-cols-9 gap-1.5 mt-1 pb-1">
    <button
      v-for="n in 9"
      :key="n"
      @click="$emit('input-number', n)"
      :disabled="9 - counts[n] <= 0"
      :class="{ 'opacity-30 pointer-events-none': 9 - counts[n] <= 0 }"
      class="relative py-4 bg-zinc-900 hover:bg-zinc-850 text-2xl font-black rounded-none active:scale-95 transition-all border border-zinc-800 flex items-center justify-center"
    >
      <span>{{ n }}</span>
      <span class="absolute top-1 right-1.5 text-[10px] text-violet-400 font-extrabold">
        {{ Math.max(0, 9 - counts[n]) }}
      </span>
    </button>
  </div>
</template>
