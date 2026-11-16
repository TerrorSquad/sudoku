<!-- The wide-screen (3xl) left sidebar: every game key and what the board's colours mean. -->
<template>
  <div class="sticky top-3 hidden flex-col gap-6 3xl:col-span-1 3xl:flex">
    <div>
      <p class="mb-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
        {{ $t("sidebar.keyboard") }}
      </p>
      <ShortcutList />
    </div>

    <div class="border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <p class="mb-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
        {{ $t("sidebar.legend") }}
      </p>
      <ul class="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <li class="flex items-center gap-3">
          <span
            class="h-4 w-4 shrink-0 border border-zinc-400 bg-zinc-900 dark:border-zinc-600 dark:bg-zinc-100"
          />
          {{ $t("sidebar.legendGiven") }}
        </li>
        <li class="flex items-center gap-3">
          <span
            class="h-4 w-4 shrink-0 border border-violet-500 bg-violet-600/30 dark:border-violet-400 dark:bg-violet-300/30"
          />
          {{ $t("sidebar.legendEntry") }}
        </li>
        <li class="flex items-center gap-3">
          <span class="h-4 w-4 shrink-0 border border-rose-400 bg-rose-500/20" />
          {{ $t("sidebar.legendConflict") }}
        </li>
        <li class="flex items-center gap-3">
          <span
            class="h-4 w-4 shrink-0 border border-violet-300 bg-violet-200 dark:border-violet-400/70 dark:bg-violet-500/35"
          />
          {{ $t("sidebar.legendSame") }}
        </li>
        <li class="flex items-center gap-3">
          <span
            class="h-4 w-4 shrink-0 border-2 border-amber-500 bg-amber-200 dark:border-amber-300 dark:bg-amber-400/30"
          />
          {{ $t("sidebar.legendSelected") }}
        </li>
      </ul>
    </div>
  </div>
</template>
