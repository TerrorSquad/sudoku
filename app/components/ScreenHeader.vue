<script setup lang="ts">
// The bar atop a full screen: Back, then the title (default slot). A lesson's bar is slimmer
// and scrolls away with the page.

defineProps<{ backLabel: string; lesson?: boolean }>();
const emit = defineEmits<{ (e: "back"): void }>();
</script>

<template>
  <div
    :class="
      lesson
        ? 'flex items-center gap-4 border-b border-zinc-200 bg-[var(--ground)] px-4 py-3 sm:px-8 dark:border-zinc-800'
        : 'sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-[var(--ground)] py-4 pr-4 pl-4 sm:pl-8 dark:border-zinc-800'
    "
  >
    <button
      :aria-label="backLabel"
      @click="emit('back')"
      class="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <AppIcon class="h-4 w-4" path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
      <span class="hidden sm:inline">{{ backLabel }}</span>
    </button>
    <slot />
  </div>
</template>
