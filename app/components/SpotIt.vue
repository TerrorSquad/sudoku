<script setup lang="ts">
// Spot it: ten positions from one Academy tier, against the clock. Tap the pattern's cells (the
// lesson's step 1, no step 2); a wrong tap adds MISS_PENALTY, skipping shows it and adds
// SKIP_PENALTY. The clock only runs while a position is up, not while the next one loads.
// With `review` set it's the Daily review instead: one position per due technique, no clock or
// penalties (it's about remembering, not speed), and each result moves its card (utils/review.ts).
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { CellCoord } from "../types/sudoku";
import type { Tier } from "../utils/progression";
import type { TechniqueId } from "../utils/sudokuGrader";

import { useTechniquePath } from "../composables/useTechniquePath";
import { boardKey, focusCell, onButton, shakeCell, stepCell } from "../utils/gridNav";
import {
  findPrompt,
  instancesOf,
  missText,
  notesGrid,
  tapPattern,
  type Instance,
  type Lesson,
} from "../utils/lesson";
import { patternMarks } from "../utils/patternMarks";
import { makeLesson } from "../utils/puzzlePool";
import { reviewPassed } from "../utils/review";
import { readJSON, writeJSON } from "../utils/safeJson";
import {
  MISS_PENALTY,
  ROUND_SIZE,
  SKIP_PENALTY,
  SPOT_BEST_KEY,
  buildRound,
  formatSpotTime,
  mergeSpotBest,
  readSpotBest,
  totalTime,
  type SpotResult,
} from "../utils/spotIt";
import { digitLabel } from "../utils/sudokuColors";
import { makeRng, solveBoard } from "../utils/sudokuCore";
import { saveToCloud } from "../utils/wavedash";
import ScreenHeader from "./ScreenHeader.vue";
import SpotResults from "./SpotResults.vue";
import SudokuGrid from "./SudokuGrid.vue";

const props = defineProps<{
  tier: Tier;
  review?: TechniqueId[];
}>();
const reviewing = !!props.review;
const emit = defineEmits<{
  (e: "back"): void;
  (e: "lesson", id: TechniqueId): void;
  (e: "cue", kind: "place" | "hint" | "unlock" | "mistake"): void;
}>();
const { t } = useI18n();
const { colorMode, boardTheme: theme } = usePreferences();
const digit = (n: number) => digitLabel(n, colorMode.value, t);
const techName = (id: TechniqueId) => t(`hint.move.${id}.name`);

/** How long a found (or skipped) pattern stays drawn before the next position. */
const REVEAL_MS = 1100;

const phase = ref<"loading" | "find" | "reveal" | "done">("loading");
const index = ref(0);
const lesson = ref<Lesson | null>(null);
let instances: Instance[] = [];
const shown = ref<Instance | null>(null);
const found = ref<CellCoord[]>([]);
const selected = ref<CellCoord | null>(null);
const misses = ref(0);
const results = ref<SpotResult[]>([]);
const feedback = ref<{ text: string; ok: boolean } | null>(null);
const best = ref<number | undefined>();
const newBest = ref(false);

// A round: its positions, made in the puzzle worker ahead of the player.
let round = 0;
let positions: (Promise<Lesson> | undefined)[] = [];
let slots: ReturnType<typeof buildRound> = [];
const size = ref(ROUND_SIZE);
let revealTimer: ReturnType<typeof setTimeout> | undefined;
const ensure = (i: number, retry = 0) => {
  const s = slots[i];
  if (!s || (positions[i] && !retry)) return;
  // A retry tries another position of the same technique.
  const p = makeLesson(s.technique, s.seed + retry);
  p.catch(() => {}); // the look-ahead may fail before load() awaits it; load() handles it
  positions[i] = p;
};
// ponytail: a round left early lets its one look-ahead finish in the worker (under a second of
// work); cancelling would mean an abort signal through generatePracticePuzzle.

// The clock: what earlier positions took, plus this one so far.
let findStart = 0;
const now = ref(0);
useIntervalFn(() => (now.value = performance.now()), 100);
// A hidden tab stops the clock: the time away is added to findStart when the tab comes back.
let hiddenAt = 0;
function onVisibility() {
  if (phase.value !== "find") return;
  if (document.hidden) hiddenAt = performance.now();
  else if (hiddenAt) {
    findStart += performance.now() - hiddenAt;
    hiddenAt = 0;
    now.value = performance.now();
  }
}
const clock = computed(() => {
  const live =
    phase.value === "find"
      ? Math.max(0, now.value - findStart) / 1000 + misses.value * MISS_PENALTY
      : 0;
  return totalTime(results.value) + live;
});

function startRound() {
  clearTimeout(revealTimer);
  round++;
  // A test pins the round with window.spotSeed; players get a fresh one.
  const seed = (window as { spotSeed?: number }).spotSeed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);
  slots = props.review
    ? props.review.map((technique) => ({ technique, seed: Math.floor(rng() * 2 ** 31) }))
    : buildRound(props.tier, rng);
  size.value = slots.length;
  positions = [];
  results.value = [];
  newBest.value = false;
  void load(0);
}

async function load(i: number) {
  const mine = round;
  phase.value = "loading";
  index.value = i;
  ensure(i);
  ensure(i + 1);
  let L: Lesson;
  try {
    L = await positions[i]!;
  } catch {
    if (mine !== round) return;
    // Another position of the same technique; if that fails too, say so (Back still works).
    ensure(i, 1);
    try {
      L = await positions[i]!;
    } catch {
      if (mine === round) feedback.value = { text: t("spot.failed"), ok: false };
      return;
    }
  }
  if (mine !== round) return; // a new round started, or the screen closed
  lesson.value = L;
  instances = instancesOf(L);
  shown.value = null;
  found.value = [];
  selected.value = null;
  misses.value = 0;
  feedback.value = null;
  phase.value = "find";
  findStart = now.value = performance.now();
  // Up while the tab is hidden (the reveal timer ran on): the clock waits for the player.
  hiddenAt = document.hidden ? findStart : 0;
}

function tap(cell: CellCoord) {
  selected.value = cell;
  const L = lesson.value;
  if (phase.value !== "find" || !L) return;
  if (found.value.some((f) => f.r === cell.r && f.c === cell.c)) return;
  const res = tapPattern(instances, found.value, cell);
  if (res.miss) {
    misses.value++;
    shakeCell(cell);
    emit("cue", "mistake");
    const why = missText(L, cell, t, digit);
    feedback.value = {
      text: reviewing ? why : `${why} ${t("spot.penalty", { s: MISS_PENALTY })}`,
      ok: false,
    };
    return;
  }
  found.value = res.found;
  if (res.complete) return settle(res.complete, false);
  feedback.value = {
    text: t("lesson.found", { n: res.found.length, total: L.pattern.length }),
    ok: true,
  };
}

function skip() {
  if (phase.value === "find") settle(instances[0]!, true);
}

function settle(instance: Instance, skipped: boolean) {
  const seconds =
    (performance.now() - findStart) / 1000 +
    misses.value * MISS_PENALTY +
    (skipped ? SKIP_PENALTY : 0);
  results.value = [
    ...results.value,
    { technique: lesson.value!.technique, seconds, misses: misses.value, skipped },
  ];
  shown.value = instance;
  phase.value = "reveal";
  feedback.value = skipped
    ? { text: reviewing ? t("review.shown") : t("spot.skipped", { s: SKIP_PENALTY }), ok: false }
    : { text: t("spot.found"), ok: true };
  emit("cue", skipped ? "hint" : "place");
  revealTimer = setTimeout(
    () => (index.value + 1 < slots.length ? load(index.value + 1) : finishRound()),
    REVEAL_MS,
  );
}

// The review's outcome per technique: passed or not, and its card now.
const reviewed = ref<{ technique: TechniqueId; passed: boolean; box: number; next: string }[]>([]);

function finishRound() {
  if (reviewing) {
    const path = useTechniquePath();
    reviewed.value = results.value.map(({ technique, misses: m, skipped }) => {
      const passed = reviewPassed(m, skipped);
      return { technique, passed, ...path.recordReview(technique, passed) };
    });
    phase.value = "done";
    emit("cue", reviewed.value.every((r) => r.passed) ? "unlock" : "place");
    saveToCloud();
    return;
  }
  const total = Math.round(totalTime(results.value) * 10) / 10;
  const stored = readJSON<unknown>(SPOT_BEST_KEY, {});
  best.value = readSpotBest(stored)[props.tier];
  newBest.value = best.value === undefined || total < best.value;
  // Merged into the raw entry, so tiers this version can't read survive.
  writeJSON(SPOT_BEST_KEY, mergeSpotBest(stored, { [props.tier]: total }));
  phase.value = "done";
  emit("cue", newBest.value ? "unlock" : "place");
  saveToCloud();
}

// The board: the pattern found so far; once settled, the whole move drawn in pen.
const L = computed(() => lesson.value);
const notes = computed(() => (L.value ? notesGrid(L.value) : []));
const solved = computed(() => (L.value ? solveBoard(L.value.board)! : []));
const triggers = computed(() => shown.value?.pattern ?? found.value);
const eliminationCells = computed(
  () => shown.value?.eliminations.map(({ r, c }) => ({ r, c })) ?? [],
);
const target = computed(() =>
  shown.value && L.value?.placement ? { r: L.value.placement.r, c: L.value.placement.c } : null,
);
const marks = computed(() => {
  if (!shown.value || !L.value) return [];
  const has = (r: number, c: number, n: number) => !!L.value!.notes[r]?.[c]?.includes(n);
  const move = {
    ...L.value.move,
    triggers: shown.value.pattern,
    eliminations: shown.value.eliminations,
  };
  return patternMarks(move, has, true);
});
const prompt = computed(() => (L.value ? findPrompt(L.value, t, digit) : ""));

// Arrows or WASD walk the grid, Enter or Space taps, H skips, Esc leaves; once done Enter plays
// again. (S is WASD's down, so skipping is H, the key that shows the answer everywhere else.)
function onKey(e: KeyboardEvent) {
  const key = boardKey(e, () => emit("back"));
  if (!key) return;
  if (phase.value === "done") {
    if (key === "Enter" && !onButton(e)) {
      e.preventDefault();
      if (reviewing) emit("back");
      else startRound();
    }
    return;
  }
  const move = stepCell(selected.value, key);
  if (move) {
    e.preventDefault();
    focusCell((selected.value = move));
  } else if ((key === "Enter" || key === " ") && selected.value && !onButton(e)) {
    e.preventDefault();
    if (!e.repeat) tap(selected.value); // a held key isn't a stack of +5 s taps
  } else if (key === "h" && !e.repeat) {
    skip();
  }
}

useEventListener(window, "keydown", onKey);
useEventListener(document, "visibilitychange", onVisibility);
onMounted(startRound);
onUnmounted(() => {
  clearTimeout(revealTimer);
  round++; // drops a position still loading
});
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <ScreenHeader lesson :back-label="$t('lesson.back')" @back="emit('back')">
      <h1 class="min-w-0 flex-1 truncate text-lg font-black text-zinc-900 dark:text-zinc-50">
        <template v-if="reviewing">{{ $t("review.title") }}</template>
        <template v-else>{{ $t("spot.title") }} · {{ $t(`academy.tier.${tier}`) }}</template>
      </h1>
      <span
        v-if="phase !== 'done' && !reviewing"
        data-testid="spot-clock"
        class="font-game text-lg font-bold text-zinc-900 tabular-nums dark:text-zinc-50"
        >{{ formatSpotTime(clock) }}</span
      >
    </ScreenHeader>

    <SpotResults
      v-if="phase === 'done'"
      :review="reviewing"
      :reviewed="reviewed"
      :results="results"
      :best="best"
      :new-best="newBest"
      @back="emit('back')"
      @again="startRound"
      @lesson="(id) => emit('lesson', id)"
    />

    <!-- A position -->
    <div
      v-else
      class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-3 sm:px-5 lg:grid lg:grid-cols-12 lg:gap-6"
    >
      <section
        class="panel order-first flex flex-col gap-3 p-4 lg:order-last lg:col-span-5 lg:self-start"
        data-testid="spot-coach"
      >
        <div class="flex gap-1" aria-hidden="true">
          <div
            v-for="n in size"
            :key="n"
            :class="
              n - 1 < results.length
                ? results[n - 1]!.skipped
                  ? 'bg-rose-500'
                  : 'bg-violet-600'
                : n - 1 === index
                  ? 'bg-violet-300 dark:bg-violet-800'
                  : 'bg-zinc-200 dark:bg-zinc-800'
            "
            class="h-1 flex-grow rounded-full"
          />
        </div>
        <p
          class="text-xs font-bold text-violet-700 dark:text-violet-300"
          data-testid="spot-progress"
        >
          {{ $t("spot.progress", { n: index + 1, total: size }) }}
          <template v-if="lesson && phase !== 'loading'">
            · {{ techName(lesson.technique) }}</template
          >
        </p>
        <p
          v-if="phase === 'loading'"
          class="text-base leading-snug font-semibold text-zinc-600 dark:text-zinc-400"
        >
          {{ $t("spot.loading") }}
        </p>
        <p v-else class="text-base leading-snug font-semibold text-zinc-900 dark:text-zinc-100">
          {{ prompt }}
        </p>
        <button
          :disabled="phase !== 'find'"
          @click="skip"
          class="tile self-start px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300"
        >
          {{ reviewing ? $t("lesson.showMe") : $t("spot.skip", { s: SKIP_PENALTY }) }}
        </button>
        <p
          role="status"
          :class="
            feedback?.ok
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-700 dark:text-rose-300'
          "
          class="min-h-5 text-sm font-semibold"
        >
          {{ feedback?.text }}
        </p>
        <ul
          class="spot-keys flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-200 pt-2 text-[0.6875rem] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
        >
          <li
            v-for="k in [
              { key: '↑←↓→', desc: $t('lesson.key.move') },
              { key: 'Enter', desc: $t('lesson.key.tap') },
              { key: 'H', desc: reviewing ? $t('lesson.showMe') : $t('spot.key.skip') },
              { key: 'Esc', desc: $t('lesson.key.back') },
            ]"
            :key="k.key"
          >
            <kbd
              class="border border-zinc-300 bg-zinc-100 px-1 font-game font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >{{ k.key }}</kbd
            >
            {{ k.desc }}
          </li>
        </ul>
      </section>

      <div class="lg:col-span-7">
        <SudokuGrid
          v-if="lesson"
          :key="index"
          :current-board="lesson.board"
          :initial-board="lesson.board"
          :solved-board="solved"
          :notes-board="notes"
          :selected-cell="selected"
          :active-hint-cell="target"
          :hint-triggers="triggers"
          :hint-eliminations="eliminationCells"
          :conflict-cells="[]"
          :color-mode="colorMode"
          :flash-cells="[]"
          :show-errors="false"
          :theme="theme"
          :marks="marks"
          :class="phase === 'loading' && 'opacity-40'"
          @select-cell="tap"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A touch-only device has no keys to list. */
@media not (any-pointer: fine) {
  .spot-keys {
    display: none;
  }
}
</style>
