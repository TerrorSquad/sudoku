<script setup lang="ts">
// Covers the board and controls while the clock is paused, so a pause can't be a free look.
defineEmits<{ resume: []; settings: []; shortcuts: [] }>();
</script>

<template>
  <div
    data-pad-scope
    class="pause-overlay absolute top-0 -right-1 -bottom-1 left-0 z-30 flex flex-col items-center justify-center gap-5 rounded-xl bg-zinc-50/90 backdrop-blur-md dark:bg-zinc-950/90"
  >
    <AppIcon class="h-12 w-12 text-zinc-500" path="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    <p class="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
      {{ $t("game.pausedTitle") }}
    </p>
    <button @click="$emit('resume')" class="tile tile-apply px-10 py-4 text-base font-black">
      {{ $t("game.resume") }}
    </button>
    <button
      @click="$emit('settings')"
      class="flex items-center gap-2 text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
    >
      <AppIcon
        class="h-4 w-4"
        path="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      {{ $t("menu.settings") }}
    </button>
    <button
      @click="$emit('shortcuts')"
      class="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
    >
      {{ $t("sidebar.keyboard") }} (?)
    </button>
  </div>
</template>
