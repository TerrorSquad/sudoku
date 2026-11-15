<script setup lang="ts">
// A guided technique lesson: find the pattern, then make the move it allows. Only those moves are
// accepted, so finishing the lesson shows the technique was applied (it completes the path step).
// No clock, score or save: its own board state, not the game's.
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

import type { CellCoord, FlashCell, NotesGrid } from "../types/sudoku";
import type { Lesson } from "../utils/lesson";
import type { BoardTheme } from "../utils/preferenceValues";
import type { DigitAt } from "../utils/sudokuGrader";

import { useTechniquePath } from "../composables/useTechniquePath";
import { patternMarks, strikes } from "../utils/patternMarks";
import { digitLabel } from "../utils/sudokuColors";
import { solveBoard } from "../utils/sudokuCore";
import { saveToCloud } from "../utils/wavedash";
import AppIcon from "./AppIcon.vue";
import Numpad from "./Numpad.vue";
import SudokuGrid from "./SudokuGrid.vue";

const props = defineProps<{ lesson: Lesson; colorMode: boolean; theme: BoardTheme }>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "practice"): void;
  (e: "cue", kind: "place" | "hint" | "unlock" | "mistake"): void;
}>();
const { t } = useI18n();

const L = props.lesson;
const id = L.technique;
const name = t(`hint.move.${id}.name`);
const digit = (n: number) => digitLabel(n, props.colorMode, t);
const digits = L.digits.map(digit).join(", ");
// What step 2 removes: for hidden subsets that's the other candidates, not the subset's digits.
const removedDigits = [...new Set(L.eliminations.map((e) => e.num))].map(digit).join(", ");

const board = ref(L.board.map((row) => [...row]));
const solved = solveBoard(L.board)!;
const notes = ref<NotesGrid>(
  L.notes.map((row) => row.map((ns) => Array.from({ length: 10 }, (_, n) => ns.includes(n)))),
);
const step = ref<"find" | "apply" | "done">("find");
const found = ref<CellCoord[]>([]);
const removed = ref<DigitAt[]>([]);
const selected = ref<CellCoord | null>(null);
// Show me: 1 points at where to look, 2 shows the answer to the current step.
const reveal = ref(0);
const feedback = ref<{ text: string; ok: boolean } | null>(null);
const credited = ref(false);
const flash = ref<FlashCell[]>([]);

const same = (a: CellCoord, b: CellCoord) => a.r === b.r && a.c === b.c;
const where = L.unit
  ? t(`lesson.where.${L.unit.kind}`, {
      n:
        L.unit.kind === "row"
          ? L.unit.r + 1
          : L.unit.kind === "col"
            ? L.unit.c + 1
            : Math.floor(L.unit.r / 3) * 3 + Math.floor(L.unit.c / 3) + 1,
    })
  : t("lesson.where.here");

const prompt = computed(() => {
  if (step.value === "find") {
    if (id === "naked-single") return t("lesson.find.nakedSingle", { where });
    if (id === "hidden-single") return t("lesson.find.hiddenSingle", { num: digits, where });
    if (L.placement) return t("lesson.find.cell", { technique: name, where });
    return t("lesson.find.pattern", { technique: name, digits, where, count: L.pattern.length });
  }
  if (step.value === "apply")
    return L.placement
      ? t("lesson.apply.place", { num: digit(L.placement.num) })
      : t("lesson.apply.eliminate", { count: L.eliminations.length });
  return "";
});

// What the hint engine says about this move, as the recap.
const recap = computed(() => [
  t(`hint.move.${id}.desc`, { num: digit(L.digits[0] ?? 0), digits, count: L.eliminations.length }),
  L.placement
    ? t("hint.move.placeStep", {
        num: digit(L.placement.num),
        row: L.placement.r + 1,
        col: L.placement.c + 1,
      })
    : t("hint.move.eliminateStep", { digits: removedDigits, count: L.eliminations.length }),
]);

const counts = computed(() => {
  const c = Array(10).fill(0);
  for (const row of board.value) for (const v of row) c[v]++;
  return c;
});

const say = (key: string, ok: boolean, params: Record<string, unknown> = {}) =>
  (feedback.value = { text: t(key, params), ok });

function shake({ r, c }: CellCoord) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelector(`[data-cell="${r}-${c}"]`)?.animate(
    [0, -4, 4, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 320 },
  );
}

function tap(cell: CellCoord) {
  selected.value = cell;
  if (step.value !== "find") return;
  if (found.value.some((f) => same(f, cell))) return;
  if (!L.pattern.some((p) => same(p, cell))) {
    shake(cell);
    emit("cue", "mistake");
    say("lesson.miss", false);
    return;
  }
  found.value.push(cell);
  if (found.value.length < L.pattern.length) {
    say("lesson.found", true, { n: found.value.length, total: L.pattern.length });
  } else {
    feedback.value = null;
    startApply();
  }
}

function startApply() {
  found.value = [...L.pattern];
  step.value = "apply";
  reveal.value = 0;
  emit("cue", "hint");
}

function input(num: number) {
  if (step.value === "find") return say("lesson.findFirst", false);
  if (step.value !== "apply") return;
  const cell = selected.value;
  if (!cell) return say("lesson.selectFirst", false);
  const { r, c } = cell;
  if (L.placement) {
    if (!same(cell, L.placement)) return reject(cell, "lesson.notThisCell");
    if (num !== L.placement.num) return reject(cell, "lesson.notThisDigit", { num: digit(num) });
    board.value[r]![c] = num;
    emit("cue", "place");
    flash.value = [{ r, c, delay: 0 }];
    return finish();
  }
  if (!notes.value[r]![c]![num]) return reject(cell, "lesson.noMark", { num: digit(num) });
  if (!L.eliminations.some((e) => same(e, cell) && e.num === num)) {
    const inStep = L.eliminations.some((e) => same(e, cell));
    return reject(cell, inStep ? "lesson.keepMark" : "lesson.notThisCell", { num: digit(num) });
  }
  notes.value[r]![c]![num] = false;
  removed.value.push({ r, c, num });
  emit("cue", "place");
  if (removed.value.length < L.eliminations.length)
    say("lesson.crossed", true, { n: removed.value.length, total: L.eliminations.length });
  else finish();
}

function reject(cell: CellCoord, key: string, params: Record<string, unknown> = {}) {
  shake(cell);
  emit("cue", "mistake");
  say(key, false, params);
}

function finish() {
  step.value = "done";
  selected.value = null;
  credited.value = useTechniquePath().recordLesson(id);
  feedback.value = null;
  emit("cue", credited.value ? "unlock" : "place");
  if (credited.value) saveToCloud();
}

// Finding: the first press points at where to look, the second shows the pattern and moves on.
// Applying: shows the cells to change.
function showMe() {
  reveal.value++;
  if (step.value === "find" && reveal.value >= 2) {
    startApply();
    say("lesson.revealed", true);
  }
}

// What the board highlights: the pattern found so far, and whatever Show me revealed.
const triggers = computed(() => (step.value === "done" ? L.pattern : found.value));
const eliminationCells = computed(() =>
  (step.value === "apply" && reveal.value) || step.value === "done"
    ? L.eliminations.map(({ r, c }) => ({ r, c }))
    : [],
);
const target = computed(() =>
  L.placement && ((step.value === "apply" && reveal.value) || step.value === "done")
    ? { r: L.placement.r, c: L.placement.c }
    : null,
);
const lookDigit = computed(() =>
  step.value === "find" && reveal.value && id !== "naked-single" ? (L.digits[0] ?? null) : null,
);
const nudge = computed(() => (step.value === "find" && reveal.value ? L.unit : null));

// The pattern in pen, as a book draws it: once it's found, then the whole move when it's done
// (what was crossed out redrawn in red). Crossing a mark out strikes it through before it goes.
const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
const fullMarks = patternMarks(L.move, has);
const marks = computed(() => {
  if (step.value === "find") return [];
  if (step.value === "done")
    return [...fullMarks.filter((m) => m.kind !== "cross"), ...strikes(L.eliminations, false)];
  return [
    ...fullMarks.filter((m) => m.kind !== "cross" && m.kind !== "place"),
    ...strikes(removed.value),
  ];
});
const replays = ref(0);

// Arrows walk the grid, Enter or Space taps, 1–9 enters.
const STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const move = STEPS[e.key];
  if (move) {
    e.preventDefault();
    const cur = selected.value;
    const r = Math.min(8, Math.max(0, (cur?.r ?? 0) + (cur ? move[0] : 0)));
    const c = Math.min(8, Math.max(0, (cur?.c ?? 0) + (cur ? move[1] : 0)));
    selected.value = { r, c };
    nextTick(() => document.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus());
  } else if ((e.key === "Enter" || e.key === " ") && selected.value) {
    if (!(e.target as HTMLElement).closest?.("[data-cell]")) return; // a focused button's own key
    e.preventDefault();
    tap(selected.value);
  } else if (e.key >= "1" && e.key <= "9") {
    input(Number(e.key));
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <div
      class="flex items-center gap-4 border-b border-zinc-200 bg-[var(--ground)] px-4 py-3 sm:px-8 dark:border-zinc-800"
    >
      <button
        :aria-label="$t('lesson.back')"
        @click="emit('back')"
        class="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <AppIcon
          class="h-4 w-4"
          path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
        />
        <span class="hidden sm:inline">{{ $t("lesson.back") }}</span>
      </button>
      <h1 class="min-w-0 flex-1 truncate text-lg font-black text-zinc-900 dark:text-zinc-50">
        {{ $t("lesson.title", { name }) }}
      </h1>
    </div>

    <div
      class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-3 sm:px-5 lg:grid lg:grid-cols-12 lg:gap-6"
    >
      <!-- Coach: first on a phone, so the prompt is above the board. -->
      <section
        class="panel order-first flex flex-col gap-3 p-4 lg:order-last lg:col-span-5 lg:self-start"
        data-testid="coach"
      >
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
          <p v-if="credited" class="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {{ $t("path.completed", { name }) }}
          </p>
          <p
            v-for="(line, i) in recap"
            :key="i"
            class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
          >
            {{ line }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button @click="emit('practice')" class="tile tile-primary px-4 py-2 text-sm font-bold">
              {{ $t("lesson.fullPuzzle") }}
            </button>
            <button @click="emit('back')" class="tile px-4 py-2 text-sm font-bold">
              {{ $t("lesson.back") }}
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
