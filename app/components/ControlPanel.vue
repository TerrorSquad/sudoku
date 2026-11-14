<script setup lang="ts">
defineProps<{
  notesMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Only singles are left: Finish takes Fill notes' place (no use for notes by then). */
  canFinish?: boolean;
}>();

defineEmits<{
  (e: "undo"): void;
  (e: "redo"): void;
  (e: "erase"): void;
  (e: "toggle-notes"): void;
  (e: "trigger-hint"): void;
  (e: "auto-notes"): void;
  (e: "finish"): void;
}>();
</script>

<template>
  <div class="grid grid-cols-6 gap-1.5 sm:gap-2">
    <!-- Undo -->
    <button
      @click="$emit('undo')"
      :title="`${$t('controls.undo')} (Ctrl+Z)`"
      :disabled="!canUndo"
      :aria-label="$t('controls.undo')"
      class="tile flex flex-col items-center justify-center gap-1 py-4 disabled:pointer-events-none disabled:opacity-40 3xl:gap-2 3xl:py-4 lg:py-3"
    >
      <AppIcon
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        path="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
      />
      <span
        class="text-[10px] font-semibold whitespace-nowrap text-zinc-600 3xl:text-xs dark:text-zinc-400"
        >{{ $t("controls.undo") }}</span
      >
    </button>

    <!-- Redo -->
    <button
      @click="$emit('redo')"
      :title="`${$t('controls.redo')} (Ctrl+Y)`"
      :disabled="!canRedo"
      :aria-label="$t('controls.redo')"
      class="tile flex flex-col items-center justify-center gap-1 py-4 disabled:pointer-events-none disabled:opacity-40 3xl:gap-2 3xl:py-4 lg:py-3"
    >
      <AppIcon
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        path="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
      />
      <span
        class="text-[10px] font-semibold whitespace-nowrap text-zinc-600 3xl:text-xs dark:text-zinc-400"
        >{{ $t("controls.redo") }}</span
      >
    </button>

    <!-- Erase -->
    <button
      @click="$emit('erase')"
      :title="`${$t('controls.erase')} (Backspace)`"
      class="tile flex flex-col items-center justify-center gap-1 py-4 3xl:gap-2 3xl:py-4 lg:py-3"
    >
      <AppIcon
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
      <span
        class="text-[10px] font-semibold whitespace-nowrap text-zinc-600 3xl:text-xs dark:text-zinc-400"
        >{{ $t("controls.erase") }}</span
      >
    </button>

    <!-- Notes -->
    <button
      @click="$emit('toggle-notes')"
      :title="`${$t('controls.notes')} (N)`"
      class="tile relative flex flex-col items-center justify-center gap-1 py-4 3xl:gap-2 3xl:py-4 lg:py-3"
      :aria-pressed="notesMode"
    >
      <span
        :class="notesMode ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-700'"
        class="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full transition-colors"
      />
      <AppIcon
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
      <span
        class="text-[10px] font-semibold whitespace-nowrap 3xl:text-xs"
        :class="
          notesMode ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-600 dark:text-zinc-400'
        "
        >{{ $t("controls.notes") }}</span
      >
    </button>

    <!-- Hint -->
    <button
      @click="$emit('trigger-hint')"
      :title="`${$t('controls.hint')} (H)`"
      class="tile tile-amber flex flex-col items-center justify-center gap-1 py-4 3xl:gap-2 3xl:py-4 lg:py-3"
    >
      <AppIcon
        class="h-5 w-5 text-amber-900 3xl:h-7 3xl:w-7 dark:text-amber-300"
        path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
      <span
        class="text-[10px] font-bold whitespace-nowrap text-amber-900 3xl:text-xs dark:text-amber-300"
        >{{ $t("controls.hint") }}</span
      >
    </button>

    <!-- Finish, in Fill notes' place so nothing moves when it appears -->
    <button
      v-if="canFinish"
      @click="$emit('finish')"
      :title="$t('game.finishBody')"
      class="modal-pop tile tile-apply flex flex-col items-center justify-center gap-1 py-4 3xl:gap-2 3xl:py-4 lg:py-3"
    >
      <AppIcon class="h-5 w-5 3xl:h-7 3xl:w-7" path="M5 13l4 4L19 7" />
      <span class="text-[10px] font-bold whitespace-nowrap 3xl:text-xs">{{
        $t("game.finish")
      }}</span>
    </button>

    <!-- Auto-fill notes -->
    <button
      v-else
      @click="$emit('auto-notes')"
      :title="`${$t('controls.auto')} (F)`"
      class="tile flex flex-col items-center justify-center gap-1 py-4 text-violet-600 3xl:gap-2 3xl:py-4 lg:py-3 dark:text-violet-300"
    >
      <AppIcon
        class="h-5 w-5 3xl:h-7 3xl:w-7"
        path="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
      <span class="text-[10px] font-semibold whitespace-nowrap 3xl:text-xs">{{
        $t("controls.auto")
      }}</span>
    </button>
  </div>
</template>
