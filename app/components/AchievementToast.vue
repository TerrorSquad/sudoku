<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

import { ACHIEVEMENTS, type AchievementTier } from "../utils/achievements";

const props = defineProps<{ ids: string[] }>();
const emit = defineEmits<{ (e: "dismiss", id: string): void }>();

const TIER_BORDER: Record<AchievementTier, string> = {
  common: "border-l-zinc-400",
  rare: "border-l-cyan-400",
  epic: "border-l-amber-400",
};

const tierOf = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.tier ?? "common";

// Each toast clears itself after 5s, but hovering or focusing it pauses the countdown
// (WCAG 2.2.1: timed content shouldn't vanish while someone is reading or using it).
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function disarm(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}
function arm() {
  for (const id of props.ids) {
    if (!timers.has(id))
      timers.set(
        id,
        setTimeout(() => dismiss(id), 5000),
      );
  }
}
function dismiss(id: string) {
  disarm(id);
  emit("dismiss", id);
}
onMounted(arm);
watch(() => props.ids.slice(), arm);
onUnmounted(() => [...timers.keys()].forEach(disarm));
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3"
    aria-live="polite"
  >
    <button
      v-for="id in ids"
      :key="id"
      :class="TIER_BORDER[tierOf(id)]"
      class="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 border border-l-4 border-zinc-200 bg-white px-4 py-3 text-left shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      @click="dismiss(id)"
      @mouseenter="disarm(id)"
      @focusin="disarm(id)"
      @mouseleave="arm"
      @focusout="arm"
    >
      <AppIcon
        class="h-7 w-7 shrink-0 text-amber-500"
        path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
      />
      <span class="min-w-0">
        <span class="block text-[10px] font-bold tracking-widest text-amber-600 uppercase">
          {{ $t("achievements.unlocked") }}
        </span>
        <span class="block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {{ $t(`achievements.${id}.name`) }}
        </span>
        <span class="block text-xs text-zinc-600 dark:text-zinc-400">
          {{ $t(`achievements.${id}.desc`) }}
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
@keyframes toast-in {
  0% {
    transform: translateY(-16px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
.toast-in {
  animation: toast-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
</style>
