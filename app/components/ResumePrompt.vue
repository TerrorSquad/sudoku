<script setup lang="ts">
import type { GameSave, SaveSlot } from "../composables/useGameSave";

import { formatTime } from "../composables/useTimer";

// A level that already has a saved game: continue it, start over, or back out.
defineProps<{ save: GameSave; level: SaveSlot }>();
const emit = defineEmits<{ continue: []; restart: []; cancel: [] }>();
</script>

<template>
  <div
    data-pad-scope
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
  >
    <div
      class="modal-pop panel w-full max-w-sm !rounded-2xl border-t-[0.375rem] !border-t-violet-500 p-6 text-center shadow-2xl"
    >
      <h3 class="mb-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
        {{ $t("resume.title") }}
      </h3>
      <p class="mb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {{
          $t(save.zen ? "resume.messageZen" : "resume.message", {
            difficulty: $t(`difficulty.${level}`),
            time: formatTime(save.timerSeconds),
          })
        }}
      </p>
      <div class="flex flex-col gap-2">
        <button @click="emit('continue')" class="tile tile-apply w-full py-3 text-sm font-bold">
          {{ $t("resume.continue") }}
        </button>
        <button @click="emit('restart')" class="tile w-full py-3 text-sm font-bold">
          {{ $t("resume.newGame") }}
        </button>
        <button
          @click="emit('cancel')"
          class="w-full py-2 text-xs font-bold text-zinc-500 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
        >
          {{ $t("resume.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>
