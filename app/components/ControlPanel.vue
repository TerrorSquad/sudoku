<script setup lang="ts">
defineProps<{ notesMode: boolean }>();

defineEmits<{
  (e: "undo"): void;
  (e: "erase"): void;
  (e: "toggle-notes"): void;
  (e: "trigger-hint"): void;
  (e: "auto-notes"): void;
}>();
</script>

<template>
  <div class="grid grid-cols-5 gap-1.5 sm:gap-2">
    <!-- Undo -->
    <button
      @click="$emit('undo')"
      class="flex flex-col items-center justify-center gap-1 border border-zinc-200 bg-zinc-50 py-3 transition-all hover:bg-zinc-100 active:scale-95 3xl:gap-2 3xl:py-4 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <svg
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
        />
      </svg>
      <span
        class="text-[10px] font-semibold whitespace-nowrap text-zinc-600 uppercase 3xl:text-xs dark:text-zinc-400"
        >{{ $t("controls.undo") }}</span
      >
    </button>

    <!-- Erase -->
    <button
      @click="$emit('erase')"
      class="flex flex-col items-center justify-center gap-1 border border-zinc-200 bg-zinc-50 py-3 transition-all hover:bg-zinc-100 active:scale-95 3xl:gap-2 3xl:py-4 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <svg
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      <span
        class="text-[10px] font-semibold whitespace-nowrap text-zinc-600 uppercase 3xl:text-xs dark:text-zinc-400"
        >{{ $t("controls.erase") }}</span
      >
    </button>

    <!-- Notes -->
    <button
      @click="$emit('toggle-notes')"
      class="relative flex flex-col items-center justify-center gap-1 border border-zinc-200 bg-zinc-50 py-3 transition-all hover:bg-zinc-100 active:scale-95 3xl:gap-2 3xl:py-4 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      :class="notesMode ? 'border-violet-500/40' : ''"
    >
      <span
        :class="notesMode ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-700'"
        class="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full transition-colors"
      />
      <svg
        class="h-5 w-5 text-zinc-500 3xl:h-7 3xl:w-7 dark:text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
      <span
        class="text-[10px] font-semibold whitespace-nowrap uppercase 3xl:text-xs"
        :class="notesMode ? 'text-violet-400' : 'text-zinc-600 dark:text-zinc-400'"
        >{{ $t("controls.notes") }}</span
      >
    </button>

    <!-- Hint -->
    <button
      @click="$emit('trigger-hint')"
      class="flex flex-col items-center justify-center gap-1 border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-600/10 py-3 transition-all hover:from-amber-500/30 active:scale-95 3xl:gap-2 3xl:py-4"
    >
      <svg
        class="h-5 w-5 text-amber-700 3xl:h-7 3xl:w-7 dark:text-amber-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      <span
        class="text-[10px] font-bold whitespace-nowrap text-amber-700 uppercase 3xl:text-xs dark:text-amber-400"
        >{{ $t("controls.hint") }}</span
      >
    </button>

    <!-- Auto-fill notes -->
    <button
      @click="$emit('auto-notes')"
      class="flex flex-col items-center justify-center gap-1 border border-zinc-200 bg-zinc-50 py-3 text-violet-600 transition-all hover:bg-zinc-100 active:scale-95 3xl:gap-2 3xl:py-4 dark:border-zinc-800 dark:bg-zinc-900 dark:text-violet-400 dark:hover:bg-zinc-800"
    >
      <svg class="h-5 w-5 3xl:h-7 3xl:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
      <span class="text-[10px] font-semibold whitespace-nowrap uppercase 3xl:text-xs">{{
        $t("controls.auto")
      }}</span>
    </button>
  </div>
</template>
