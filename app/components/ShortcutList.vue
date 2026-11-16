<script setup lang="ts">
// `sheet`: the ? dialog's copy, with wider keys and darker text than the sidebar's.
defineProps<{ sheet?: boolean }>();

// The game's keys: the wide-screen sidebar lists them, and ? opens the same list anywhere.
const SHORTCUTS = [
  { key: "↑←↓→", desc: "sidebar.shortcutMove" },
  { key: "WASD", desc: "sidebar.shortcutMove" },
  { key: "1–9", desc: "sidebar.shortcutInputNumber" },
  { key: "Backspace", desc: "sidebar.shortcutEraseCell" },
  { key: "N", desc: "sidebar.shortcutToggleNotes" },
  { key: "H", desc: "sidebar.shortcutGetHint" },
  { key: "F", desc: "sidebar.shortcutAutoFillNotes" },
  { key: "P", desc: "sidebar.shortcutPause" },
  { key: "Ctrl+Z", desc: "sidebar.shortcutUndo" },
  { key: "Ctrl+Y", desc: "sidebar.shortcutRedo" },
  { key: "Shift+Z", desc: "sidebar.shortcutHistory" },
  { key: "?", desc: "sidebar.shortcutHelp" },
] as const;
</script>

<template>
  <ul :class="sheet ? 'space-y-2.5' : 'space-y-3'">
    <li v-for="(s, i) in SHORTCUTS" :key="i" class="flex items-center gap-3">
      <kbd
        :class="sheet ? 'min-w-[4.5rem]' : 'min-w-[3.75rem]'"
        class="shrink-0 border border-zinc-300 bg-zinc-100 px-2 py-1 text-center font-game text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >{{ s.key }}</kbd
      >
      <span
        :class="sheet ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-600 dark:text-zinc-400'"
        class="text-sm"
        >{{ $t(s.desc) }}</span
      >
    </li>
  </ul>
</template>
