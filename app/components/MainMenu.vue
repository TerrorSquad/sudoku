<script setup lang="ts">
// The menu is itself a 3×3 box, New game filling four of its cells.
const emit = defineEmits<{
  go: [screen: "settings" | "difficulty" | "stats" | "achievements" | "custom-import"];
  daily: [];
  academy: [];
  basics: [];
}>();

// Mounted afresh on every visit, so reading storage once here is current (it isn't reactive).
const { basicsPrompt } = usePreferences();
const dailyPuzzle = useDailyPuzzle();
const score = useScore();
const techniquePath = useTechniquePath();
const dailyStreak = dailyPuzzle.getStreakState();
// Lit until any Daily is done today, the same rule as the streak and the calendar.
const dailyDone = dailyPuzzle.getCompletedDays().has(dailyPuzzle.todayKey());
const unlockWins = score.unlockWins();
// Lifetime score drives the level.
const playerLevel = levelFor(score.getStats().total);
const lessonsDone = techniquePath.getDone();
const pathDone = ACADEMY_TECHNIQUES.filter((tech) => lessonsDone.includes(tech.id)).length;
// Techniques due in the Daily review, for the Academy tile.
const reviewDue = dueToday(techniquePath.getReview(), localDateKey()).length;
// "New to sudoku?": a fresh player who hasn't dismissed it. Fresh: no win anywhere (the unlock
// count, so Zen wins count too), no technique lesson and no basics lesson done.
const fresh =
  !Object.values(unlockWins).some((e) => (e?.wins ?? 0) > 0 || (e?.best ?? 0) > 0) &&
  lessonsDone.length === 0 &&
  techniquePath.getBasics().length === 0;
const showBasicsPrompt = computed(() => basicsPrompt.value && fresh);
</script>

<template>
  <div class="relative flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
    <button
      @click="emit('go', 'settings')"
      :aria-label="$t('menu.settings')"
      :title="$t('menu.settings')"
      class="tile absolute top-4 right-4 grid h-11 w-11 place-items-center text-zinc-600 dark:text-zinc-300"
    >
      <AppIcon
        class="h-5 w-5"
        path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.65 7.65 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </button>

    <div class="text-center">
      <h1
        class="wordmark relative isolate inline-block text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50"
      >
        {{ $t("menu.title") }}
      </h1>
      <p class="mt-3 text-sm text-zinc-500">
        {{ $t("menu.subtitle") }}
      </p>
      <!-- Level / progress -->
      <div class="mx-auto mt-5 w-full max-w-[15rem]" data-testid="level-badge">
        <p class="text-xs font-bold text-violet-700 dark:text-violet-300">
          {{ $t("level.label", { n: playerLevel.level }) }}
          <span class="font-semibold text-zinc-500"
            >· {{ $t(`level.title.${levelBand(playerLevel.level)}`) }}</span
          >
        </p>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            class="h-full rounded-full bg-violet-600"
            :style="{ width: `${Math.round(playerLevel.progress * 100)}%` }"
          />
        </div>
      </div>
    </div>

    <div
      v-if="showBasicsPrompt"
      data-testid="basics-prompt"
      class="panel flex w-full max-w-[26rem] items-center gap-2 py-1.5 pr-1.5 pl-4"
    >
      <button
        @click="emit('basics')"
        class="min-w-0 flex-1 py-1.5 text-left text-sm font-bold text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
      >
        {{ $t("basics.prompt") }}
      </button>
      <button
        @click="basicsPrompt = false"
        :aria-label="$t('basics.dismiss')"
        :title="$t('basics.dismiss')"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <AppIcon class="h-4 w-4" path="M6 18L18 6M6 6l12 12" />
      </button>
    </div>

    <nav
      :aria-label="$t('menu.title')"
      class="tray grid aspect-square w-full max-w-[26rem] grid-cols-3 grid-rows-3 gap-2 p-2 sm:gap-2.5 sm:p-2.5"
    >
      <button
        @click="emit('go', 'difficulty')"
        class="tile tile-primary relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden p-4 text-left sm:p-5"
      >
        <!-- A faint corner of a puzzle, so the tile says what it starts. -->
        <svg
          aria-hidden="true"
          viewBox="0 0 90 90"
          class="pointer-events-none absolute -top-3 -right-3 h-32 w-32 opacity-20 sm:h-40 sm:w-40"
          fill="none"
          stroke="currentColor"
        >
          <rect x="1" y="1" width="88" height="88" rx="6" stroke-width="2.5" />
          <path d="M31 1v88M59 1v88M1 31h88M1 59h88" stroke-width="1.2" />
          <g
            fill="currentColor"
            stroke="none"
            font-family="var(--font-game)"
            font-weight="800"
            font-size="19"
            text-anchor="middle"
          >
            <text x="16" y="23">5</text>
            <text x="44" y="23">3</text>
            <text x="16" y="51">6</text>
            <text x="74" y="51">9</text>
            <text x="44" y="79">8</text>
            <text x="74" y="79">1</text>
          </g>
        </svg>
        <AppIcon
          class="h-9 w-9 opacity-90"
          path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <span>
          <span class="block font-display text-2xl leading-tight font-extrabold sm:text-3xl">{{
            $t("menu.start")
          }}</span>
          <span class="mt-1 block text-xs font-medium opacity-80">{{ $t("menu.startHint") }}</span>
        </span>
      </button>

      <button @click="emit('daily')" :class="dailyDone ? '' : 'tile-amber'" class="tile menu-cell">
        <AppIcon
          class="h-5 w-5"
          path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
        <span>
          <span class="block">{{
            dailyDone ? $t("menu.dailyCompleted") : $t("menu.dailyChallenge")
          }}</span>
          <span
            v-if="dailyStreak.current > 0"
            class="block text-[0.6875rem] font-semibold opacity-80"
            >🔥 {{ $t("menu.dailyStreak", { n: dailyStreak.current }) }}
            <template v-if="dailyStreak.freezes">· ❄ {{ dailyStreak.freezes }}</template></span
          >
        </span>
      </button>

      <button @click="emit('academy')" class="tile menu-cell">
        <AppIcon
          class="h-5 w-5 text-violet-600 dark:text-violet-300"
          path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
        <span>
          <span class="block">{{ $t("menu.academy") }}</span>
          <span class="block text-[0.6875rem] font-semibold opacity-80"
            >{{ $t("path.menu", { done: pathDone, total: ACADEMY_TECHNIQUES.length }) }}
            <span v-if="reviewDue" data-testid="review-badge">
              · {{ $t("review.menu", { n: reviewDue }) }}</span
            ></span
          >
        </span>
      </button>

      <button @click="emit('go', 'stats')" class="tile menu-cell">
        <AppIcon
          class="h-5 w-5 text-violet-600 dark:text-violet-300"
          path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
        <span>{{ $t("menu.stats") }}</span>
      </button>

      <button @click="emit('go', 'achievements')" class="tile menu-cell">
        <AppIcon
          class="h-5 w-5 text-violet-600 dark:text-violet-300"
          path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
        />
        <span>{{ $t("menu.achievements") }}</span>
      </button>

      <button @click="emit('go', 'custom-import')" class="tile menu-cell">
        <AppIcon
          class="h-5 w-5 text-violet-600 dark:text-violet-300"
          path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
        <span>{{ $t("menu.customPuzzle") }}</span>
      </button>
    </nav>
  </div>
</template>

<!-- Non-scoped: the .dark ancestor lives on <html>, outside this component's scope. -->
<style>
/* A small menu tile: icon at the top, label at the bottom, like a cell's corner marks. */
.menu-cell {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem;
  text-align: left;
  font-family: var(--font-display);
  font-size: 0.8125rem;
  line-height: 1.15;
  font-weight: 700;
  color: var(--color-zinc-800);
}
.dark .menu-cell {
  color: var(--color-zinc-100);
}
.menu-cell.tile-amber {
  color: #422006;
}
.dark .menu-cell.tile-amber {
  color: #fde68a;
}

/* The one loud thing: a highlighter stroke under the wordmark. */
.wordmark::after {
  content: "";
  position: absolute;
  z-index: -1;
  left: -0.12em;
  right: -0.12em;
  bottom: 0.04em;
  height: 0.36em;
  background: rgba(252, 211, 77, 0.75);
  transform: skewX(-8deg) rotate(-0.8deg);
  transform-origin: left center;
  animation: swipe 0.7s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.dark .wordmark::after {
  background: rgba(251, 191, 36, 0.38);
}
@keyframes swipe {
  from {
    transform: skewX(-8deg) rotate(-0.8deg) scaleX(0);
  }
  to {
    transform: skewX(-8deg) rotate(-0.8deg) scaleX(1);
  }
}
</style>
