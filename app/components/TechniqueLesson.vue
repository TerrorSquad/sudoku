<script setup lang="ts">
// A guided technique lesson: find the pattern, then make the move it allows. Only those moves are
// accepted, so finishing the lesson shows the technique was applied (it completes the path step).
// No clock, score or save: its own board state, not the game's.

import type { CellCoord, FlashCell, NotesGrid } from "../types/sudoku";
import type { Lesson } from "../utils/lesson";
import type { Level, Stars } from "../utils/progression";
import type { DigitAt, TechniqueId } from "../utils/sudokuGrader";

// inGame: opened from a paused game, so Back returns to it and there's no "full puzzle" (it
// would replace that game).
// level: how much step 1 tells (guideOf).
const props = defineProps<{
  lesson: Lesson;
  level: Level;
  inGame?: boolean;
}>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "practice"): void;
  /** Another lesson: the next technique, or a fresh position for this one (at `level`). */
  (e: "lesson", id: TechniqueId, level?: Level): void;
  (e: "cue", kind: "place" | "hint" | "unlock" | "mistake"): void;
}>();
const { t } = useI18n();

const L = props.lesson;
const id = L.technique;
const name = t(`hint.move.${id}.name`);
const { colorMode, boardTheme: theme } = usePreferences();
const digit = (n: number) => digitLabel(n, colorMode.value, t);
const digits = L.digits.map(digit).join(", ");
// The patterns step 1 accepts (a fish may have a twin; on your own, any instance counts); the one
// found sets step 2's move.
const instances = instancesOf(L, props.level);
const active = ref(instances[0]!);
const elims = computed(() => active.value.eliminations);
const placement = computed(() => active.value.move.placement);

const board = ref(L.board.map((row) => [...row]));
const solved = solveBoard(L.board)!;
const notes = ref<NotesGrid>(notesGrid(L));
const step = ref<"find" | "apply" | "done">("find");
const found = ref<CellCoord[]>([]);
const removed = ref<DigitAt[]>([]);
const selected = ref<CellCoord | null>(null);
// Show me while finding: 1 the digit, 2 the lines or box it works in, 3 the pattern itself.
// While applying: 1 shows the cells to change.
const reveal = ref(0);
const feedback = ref<{ text: string; ok: boolean } | null>(null);
const credited = ref(false);
const flash = ref<FlashCell[]>([]);
// Show me presses and rejected moves; they decide the stars.
const slips = ref(0);
const stars = ref<Stars>(3);
const bestBefore = ref<Stars | undefined>();
const next = ref<TechniqueId | null>(null);

// The levels: each one's best stars; one opens once the level before it is finished.
const path = useTechniquePath();
const LEVELS = [1, 2, 3] as const;
const levelStars = ref(LEVELS.map((n) => path.getStars(n)[id]));
const nextLevel = computed(() =>
  props.level < 3 && levelStars.value[props.level - 1] ? ((props.level + 1) as Level) : null,
);
const guide = guideOf(id, props.level);
// Level 2's name says what changes: the way round, or how much is told.
const levelName = (n: Level) =>
  t(`lesson.level.${n === 2 && guideOf(id, 2) === "marked" ? "turn" : n}`);
const open = (n: Level) => n === 1 || !!levelStars.value[n - 2];
// L (a controller's LT): the next open level, round to the first.
const otherLevel = computed(() => {
  const after = LEVELS.filter((n) => open(n) && n !== props.level);
  return after.find((n) => n > props.level) ?? after[0] ?? null;
});

// Once done, the arrows (a controller's D-pad) walk the coach's buttons; Enter (A) presses one.
const coachEl = ref<HTMLElement>();
function stepButton(by: 1 | -1) {
  const list = [...(coachEl.value?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
  const i = list.indexOf(document.activeElement as HTMLElement);
  list[i < 0 ? (by > 0 ? 0 : list.length - 1) : (i + by + list.length) % list.length]?.focus();
}

const prompt = computed(() => {
  if (step.value === "find") return findPrompt(L, t, digit, props.level);
  if (step.value === "apply")
    return placement.value
      ? t("lesson.apply.place", { num: digit(placement.value.num) })
      : t("lesson.apply.eliminate", { count: elims.value.length });
  return "";
});

const counts = computed(() => {
  const c = Array(10).fill(0);
  for (const row of board.value) for (const v of row) c[v]++;
  return c;
});

const say = (key: string, ok: boolean, params: Record<string, unknown> = {}) =>
  (feedback.value = { text: t(key, params), ok });

function tap(cell: CellCoord) {
  selected.value = cell;
  if (step.value !== "find") return;
  if (found.value.some((f) => sameCell(f, cell))) return;
  const res = tapPattern(instances, found.value, cell);
  if (res.miss) return slip(cell, missText(L, cell, t, digit, props.level));
  found.value = res.found;
  const complete = res.complete;
  if (!complete) {
    // On your own the count isn't told (and an instance found may have another).
    if (props.level === 3) feedback.value = null;
    else say("lesson.found", true, { n: res.found.length, total: L.pattern.length });
    return;
  }
  active.value = complete;
  startApply();
  // An instance other than the one the lesson picked: just as real, so it's the one to use.
  if (complete !== instances[0]) say("lesson.twin", true, { technique: name });
  else feedback.value = null;
}

function startApply() {
  found.value = [...active.value.pattern];
  step.value = "apply";
  reveal.value = 0;
  emit("cue", "hint");
}

// The move told with this board's rows, columns and boxes (explain.ts): step 2 gives the why, and
// Show me (or finishing) adds the conclusion, which names the cells to change; the recap is all of it.
const story = computed(() => narrate(drawn.value, has, t, digit));
const why = computed(() =>
  story.value
    .filter((s) => (s.step !== "result" && !s.answer) || reveal.value > 0 || step.value === "done")
    .map((s) => s.text),
);

function input(num: number) {
  if (step.value === "find") return say("lesson.findFirst", false);
  if (step.value !== "apply") return;
  const cell = selected.value;
  if (!cell) return say("lesson.selectFirst", false);
  const { r, c } = cell;
  const p = placement.value;
  if (p) {
    if (!sameCell(cell, p)) return reject(cell, "lesson.notThisCell");
    if (num !== p.num) return reject(cell, "lesson.notThisDigit", { num: digit(num) });
    board.value[r]![c] = num;
    emit("cue", "place");
    flash.value = [{ r, c, delay: 0 }];
    return finish();
  }
  if (!notes.value[r]![c]![num]) return reject(cell, "lesson.noMark", { num: digit(num) });
  if (!elims.value.some((e) => sameCell(e, cell) && e.num === num))
    return slip(cell, reasonText(L, removalReason(L, active.value, cell, num), t, digit));
  notes.value[r]![c]![num] = false;
  removed.value.push({ r, c, num });
  emit("cue", "place");
  if (removed.value.length < elims.value.length)
    say("lesson.crossed", true, { n: removed.value.length, total: elims.value.length });
  else finish();
}

// Backspace / Delete / X: crosses out the selected cell's mark when only one is left to go there.
function crossOut() {
  if (step.value !== "apply" || placement.value || !selected.value) return;
  const cell = selected.value;
  const left = elims.value.filter(
    (e) => sameCell(e, cell) && !removed.value.some((x) => sameCell(x, e) && x.num === e.num),
  );
  if (left.length === 1) return input(left[0]!.num);
  if (left.length)
    return say("lesson.whichDigit", false, { digits: left.map((e) => digit(e.num)).join(", ") });
  // Everything this cell loses is gone already: nothing wrong was tried, so no slip.
  if (elims.value.some((e) => sameCell(e, cell))) return say("lesson.cellDone", true);
  reject(cell, "lesson.notThisCell");
}

function reject(cell: CellCoord, key: string, params: Record<string, unknown> = {}) {
  slip(cell, t(key, params));
}
function slip(cell: CellCoord, text: string) {
  slips.value++;
  shakeCell(cell);
  emit("cue", "mistake");
  feedback.value = { text, ok: false };
}

function finish() {
  step.value = "done";
  selected.value = null;
  credited.value = path.recordLesson(id);
  stars.value = lessonStarsFor(slips.value);
  bestBefore.value = path.recordStars(id, stars.value, props.level);
  levelStars.value = LEVELS.map((n) => path.getStars(n)[id]);
  path.scheduleReview(id);
  next.value = nextLesson(id, path.getDone(), credited.value);
  feedback.value = null;
  emit("cue", credited.value ? "unlock" : "place");
  saveToCloud();
}

// Finding: the digit, then the lines or box it works in, then the pattern itself (and on to
// step 2). A naked single has no one digit, so it starts at the box. Applying: the cells to change.
function showMe() {
  if (step.value === "done") return;
  // Applying, only the first press shows anything new, so only it costs a star.
  if (step.value === "find" || reveal.value === 0) slips.value++;
  reveal.value += step.value === "find" && reveal.value === 0 && !lookable ? 2 : 1;
  if (step.value === "find" && reveal.value >= 3) {
    startApply();
    say("lesson.revealed", true);
  } else if (step.value === "find") {
    say(reveal.value === 1 ? "lesson.look.digit" : "lesson.look.units", true, { d: digits });
  }
}

// What the board highlights: the pattern found so far, and whatever Show me revealed.
const triggers = computed(() => (step.value === "done" ? active.value.pattern : found.value));
const eliminationCells = computed(() =>
  (step.value === "apply" && reveal.value) || step.value === "done"
    ? elims.value.map(({ r, c }) => ({ r, c }))
    : [],
);
const target = computed(() =>
  placement.value && ((step.value === "apply" && reveal.value) || step.value === "done")
    ? { r: placement.value.r, c: placement.value.c }
    : null,
);
// The legend under the coach: the keys that do something on this step.
const keys = computed(() =>
  step.value === "done"
    ? [
        ...(nextLevel.value ? [{ key: "Enter", desc: t("lesson.key.nextLevel") }] : []),
        ...(next.value ? [{ key: "N", desc: t("lesson.key.next") }] : []),
        { key: "R", desc: t("lesson.key.again") },
        { key: "P", desc: t("lesson.key.practice") },
        ...(otherLevel.value ? [{ key: "L", desc: t("lesson.key.level") }] : []),
        { key: "Esc", desc: t("lesson.key.back") },
      ]
    : [
        { key: "↑←↓→", desc: t("lesson.key.move") },
        step.value === "find"
          ? { key: "Enter", desc: t("lesson.key.tap") }
          : placement.value
            ? { key: "1–9", desc: t("lesson.key.place") }
            : { key: "1–9 / ⌫", desc: t("lesson.key.cross") },
        { key: "H", desc: t("lesson.showMe") },
        ...(otherLevel.value ? [{ key: "L", desc: t("lesson.key.level") }] : []),
        { key: "Esc", desc: t("lesson.key.back") },
      ],
);

// The pattern in pen, as a book draws it, from the instance the player found (a second fish
// counts): once it's found, then the whole move when it's done (what was crossed out redrawn in
// red). Crossing a mark out strikes it through before it goes.
const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
const drawn = computed(() => ({
  ...active.value.move,
  triggers: active.value.pattern,
  eliminations: active.value.eliminations,
}));
const marks = computed(() => {
  if (step.value === "find") return [];
  if (step.value === "done")
    return [
      ...patternMarks(drawn.value, has).filter((m) => m.kind !== "cross"),
      ...strikes(elims.value, false),
    ];
  // Applying: the pattern, reaching the cells to change only once Show me points at them; the
  // crossing out is the player's.
  return [
    ...patternMarks(drawn.value, has, reveal.value > 0).filter(
      (m) => m.kind !== "cross" && m.kind !== "place",
    ),
    ...strikes(removed.value),
  ];
});
const replays = ref(0);

const lookable = id !== "naked-single";
const lookDigit = computed(() =>
  step.value === "find" && reveal.value && lookable ? (L.digits[0] ?? null) : null,
);
// A "marked" level shows where to look from the start; else Show me's second stage does.
const units = guide === "marked" ? guideUnits(L) : lessonUnits(L);
const nudge = computed(() =>
  step.value === "find" && (guide === "marked" || reveal.value >= 2) ? units : null,
);

// Arrows or WASD walk the grid, Enter or Space taps, 1–9 enters, Backspace crosses out, H shows,
// Esc leaves, L moves to another open level. Once done: the arrows walk the buttons, Enter for the
// next level (else the next lesson), N the next lesson, R another example, P a full puzzle.
function onKey(e: KeyboardEvent) {
  const key = boardKey(e, () => emit("back"));
  if (!key) return;
  if (key === "l" && otherLevel.value) return emit("lesson", id, otherLevel.value);
  if (step.value === "done") {
    if (stepCell(null, key)) {
      e.preventDefault();
      return stepButton(["ArrowUp", "ArrowLeft", "w", "a"].includes(key) ? -1 : 1);
    }
    // Enter on a focused button is that button's own click.
    if (key === "Enter" && !onButton(e) && nextLevel.value) {
      e.preventDefault();
      emit("lesson", id, nextLevel.value);
    } else if ((key === "Enter" && !onButton(e)) || key === "n") {
      e.preventDefault();
      if (next.value) emit("lesson", next.value);
    } else if (key === "r") emit("lesson", id, props.level);
    else if (key === "p" && !props.inGame) emit("practice");
    return;
  }
  const move = stepCell(selected.value, key);
  if (move) {
    e.preventDefault();
    focusCell((selected.value = move));
  } else if ((key === "Enter" || key === " ") && selected.value) {
    if (!(e.target as HTMLElement).closest?.("[data-cell]")) return; // a focused button's own key
    e.preventDefault();
    tap(selected.value);
  } else if (key >= "1" && key <= "9") {
    input(Number(key));
  } else if (key === "Backspace" || key === "Delete" || key === "x") {
    e.preventDefault();
    crossOut();
  } else if (key === "h" && !e.repeat) {
    // Not on key repeat: holding H would race through every stage.
    showMe();
  }
}
useEventListener(window, "keydown", onKey);
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <ScreenHeader
      lesson
      :back-label="inGame ? $t('settings.backToGame') : $t('lesson.back')"
      @back="emit('back')"
    >
      <h1 class="min-w-0 flex-1 truncate text-lg font-black text-zinc-900 dark:text-zinc-50">
        {{ $t("lesson.title", { name }) }}
      </h1>
    </ScreenHeader>

    <div
      class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-3 sm:px-5 lg:grid lg:grid-cols-12 lg:gap-6"
    >
      <!-- Coach: first on a phone, so the prompt is above the board. -->
      <section
        class="panel order-first flex flex-col gap-3 p-4 lg:order-last lg:col-span-5 lg:self-start"
        data-testid="coach"
        ref="coachEl"
      >
        <div class="flex gap-1.5" role="group" :aria-label="$t('lesson.levels')">
          <button
            v-for="n in LEVELS"
            :key="n"
            :data-testid="`level-${n}`"
            :aria-pressed="n === level"
            :disabled="!open(n)"
            :title="open(n) ? undefined : $t('lesson.levelLocked')"
            :aria-label="
              levelStars[n - 1]
                ? `${levelName(n)}, ${$t('lesson.starsLabel', { n: levelStars[n - 1] })}`
                : levelName(n)
            "
            :class="n === level ? 'tile-primary' : ''"
            class="tile flex min-w-0 flex-1 flex-col items-center justify-center px-1.5 py-1 text-center text-xs leading-tight font-bold"
            @click="emit('lesson', id, n)"
          >
            <span>{{ levelName(n) }}</span>
            <span aria-hidden="true" class="text-[0.625rem] tracking-widest">{{
              levelStars[n - 1]
                ? "★".repeat(levelStars[n - 1]!) + "☆".repeat(3 - levelStars[n - 1]!)
                : "☆☆☆"
            }}</span>
          </button>
        </div>
        <div v-if="step !== 'done'" class="flex gap-1.5" aria-hidden="true">
          <div
            v-for="n in 2"
            :key="n"
            :class="n === 1 || step === 'apply' ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-zinc-800'"
            class="h-1 flex-grow rounded-full"
          />
        </div>
        <template v-if="step !== 'done'">
          <p class="text-xs font-bold text-violet-700 dark:text-violet-300">
            {{ $t(step === "find" ? "lesson.step1" : "lesson.step2") }}
          </p>
          <ul
            v-if="step === 'apply'"
            class="space-y-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
            data-testid="lesson-why"
          >
            <li v-for="(line, i) in why" :key="i">{{ line }}</li>
          </ul>
          <p class="text-base leading-snug font-semibold text-zinc-900 dark:text-zinc-100">
            {{ prompt }}
          </p>
          <p
            v-if="step === 'find'"
            class="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            <span class="font-bold">{{ $t("academy.lookForLabel") }}:</span>
            {{ $t(`academy.tech.${id}.lookFor`) }}
          </p>
          <button
            @click="showMe"
            class="tile self-start px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300"
          >
            {{ $t("lesson.showMe") }}
          </button>
        </template>
        <template v-else>
          <p class="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {{ $t("lesson.doneTitle") }}
          </p>
          <p data-testid="lesson-stars" class="flex items-center gap-2">
            <span
              class="text-2xl tracking-widest text-amber-700 dark:text-amber-400"
              role="img"
              :aria-label="$t('lesson.starsLabel', { n: stars })"
              >{{ "★".repeat(stars) + "☆".repeat(3 - stars) }}</span
            >
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{{
              $t(`lesson.stars${stars}`)
            }}</span>
          </p>
          <p
            v-if="bestBefore && stars > bestBefore"
            class="text-xs font-bold text-amber-700 dark:text-amber-300"
          >
            {{ $t("lesson.newBest", { was: bestBefore }) }}
          </p>
          <p v-if="credited" class="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {{ $t("path.completed", { name }) }}
          </p>
          <p
            v-for="(line, i) in why"
            :key="i"
            class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
          >
            {{ line }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="nextLevel"
              @click="emit('lesson', id, nextLevel)"
              class="tile tile-primary w-full px-4 py-2.5 text-sm font-bold"
            >
              {{ $t("lesson.nextLevel", { name: levelName(nextLevel) }) }}
            </button>
            <button
              v-if="next"
              @click="emit('lesson', next)"
              :class="nextLevel ? '' : 'tile-primary'"
              class="tile w-full px-4 py-2.5 text-sm font-bold"
            >
              {{ $t("lesson.next", { name: $t(`hint.move.${next}.name`) }) }}
            </button>
            <button
              @click="emit('lesson', id, level)"
              class="tile min-w-[8.5rem] flex-1 px-3 py-2 text-sm font-bold"
            >
              {{ $t("lesson.again") }}
            </button>
            <button
              v-if="!inGame"
              @click="emit('practice')"
              class="tile min-w-[8.5rem] flex-1 px-3 py-2 text-sm font-bold"
            >
              {{ $t("lesson.fullPuzzle") }}
            </button>
            <button
              @click="emit('back')"
              class="tile min-w-[8.5rem] flex-1 px-3 py-2 text-sm font-bold"
            >
              {{ inGame ? $t("settings.backToGame") : $t("lesson.back") }}
            </button>
          </div>
        </template>
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
        <!-- Keys, for a keyboard (hidden where the only pointer is a finger). -->
        <ul
          data-testid="lesson-keys"
          class="lesson-keys flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-200 pt-2 text-[0.6875rem] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
        >
          <li v-for="k in keys" :key="k.key">
            <kbd
              class="border border-zinc-300 bg-zinc-100 px-1 font-game font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >{{ k.key }}</kbd
            >
            {{ k.desc }}
          </li>
        </ul>
      </section>

      <div class="flex flex-col gap-3 lg:col-span-7">
        <SudokuGrid
          :current-board="board"
          :initial-board="L.board"
          :solved-board="solved"
          :notes-board="notes"
          :selected-cell="selected"
          :active-hint-cell="target"
          :hint-triggers="triggers"
          :hint-eliminations="eliminationCells"
          :conflict-cells="[]"
          :color-mode="colorMode"
          :flash-cells="flash"
          :show-errors="false"
          :active-digit="lookDigit"
          :show-candidates="!!lookDigit"
          :nudge="nudge"
          :theme="theme"
          :marks="marks"
          :marks-key="replays"
          @select-cell="tap"
        />
        <button
          v-if="step === 'done'"
          @click="replays++"
          class="tile flex items-center gap-2 self-center px-4 py-2 text-sm font-bold text-violet-700 dark:text-violet-300"
        >
          <AppIcon
            class="h-4 w-4"
            path="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m0 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
          />
          {{ $t("lesson.replay") }}
        </button>
        <Numpad
          v-if="step === 'apply'"
          :counts="counts"
          :color-mode="colorMode"
          @input-number="input"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A touch-only device has no keys to list. */
@media not (any-pointer: fine) {
  .lesson-keys {
    display: none;
  }
}
</style>
