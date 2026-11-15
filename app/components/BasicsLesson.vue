<script setup lang="ts">
// "How to play": one of the four basics lessons (utils/basics.ts), task by task. Same look and
// keys as a technique lesson, but its own small engine: the moves are the beginner's (place the
// missing digit, pencil in the maybes), not a technique's pattern. No clock, score or save.
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

import type { CellCoord, FlashCell, NotesGrid } from "../types/sudoku";
import type { Mark } from "../utils/patternMarks";
import type { BoardTheme } from "../utils/preferenceValues";
import type { TechniqueId } from "../utils/sudokuGrader";

import { useTechniquePath } from "../composables/useTechniquePath";
import {
  BASICS,
  BASICS_IDS,
  SOLUTION,
  blockedBy,
  candidatesAt,
  hatchedBy,
  type BasicsId,
} from "../utils/basics";
import { digitLabel } from "../utils/sudokuColors";
import { saveToCloud } from "../utils/wavedash";
import AppIcon from "./AppIcon.vue";
import Numpad from "./Numpad.vue";
import SudokuGrid from "./SudokuGrid.vue";

const props = defineProps<{ id: BasicsId; colorMode: boolean; theme: BoardTheme }>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "basics", id: BasicsId): void;
  (e: "lesson", id: TechniqueId): void;
  (e: "cue", kind: "place" | "hint" | "unlock" | "mistake"): void;
}>();
const { t } = useI18n();

const tasks = BASICS[props.id];
const index = ref(0);
const task = computed(() => tasks[index.value]!);
const answer = computed(() => SOLUTION[task.value.cell.r]![task.value.cell.c]!);
const digit = (n: number) => digitLabel(n, props.colorMode, t);

const board = ref(task.value.board.map((row) => [...row]));
const emptyNotes = (): NotesGrid =>
  Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => Array(10).fill(false)));
const notes = ref<NotesGrid>(emptyNotes());
const selected = ref<CellCoord | null>(null);
const notesMode = ref(false);
const shown = ref(false);
const done = ref(false);
const feedback = ref<{ text: string; ok: boolean } | null>(null);
const flash = ref<FlashCell[]>([]);

function load() {
  const tk = task.value;
  board.value = tk.board.map((row) => [...row]);
  notes.value = emptyNotes();
  if (tk.withNotes)
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        for (const n of candidatesAt(tk.board, { r, c })) notes.value[r]![c]![n] = true;
  selected.value = tk.preselect ? { ...tk.cell } : null;
  notesMode.value = false;
  shown.value = false;
}
load();

const same = (a: CellCoord, b: CellCoord) => a.r === b.r && a.c === b.c;
const say = (key: string, ok: boolean, params: Record<string, unknown> = {}) =>
  (feedback.value = { text: t(key, params), ok });
function reject(cell: CellCoord, key: string, params: Record<string, unknown> = {}) {
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    document.querySelector(`[data-cell="${cell.r}-${cell.c}"]`)?.animate(
      [0, -4, 4, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      {
        duration: 320,
      },
    );
  emit("cue", "mistake");
  say(key, false, params);
}

const wanted = computed(() => candidatesAt(task.value.board, task.value.cell));
const pencilled = computed(() => {
  const { r, c } = task.value.cell;
  return wanted.value.filter((n) => notes.value[r]![c]![n]);
});

// Stored with the path (and cloud-synced, union-merged): the Academy's step 0.
function finish() {
  useTechniquePath().recordBasics(props.id);
  saveToCloud();
  emit("cue", "unlock");
}

function complete() {
  emit("cue", "place");
  if (index.value < tasks.length - 1) {
    index.value++;
    load();
    say("basics.right", true);
    return;
  }
  done.value = true;
  selected.value = null;
  feedback.value = null;
  finish();
}

function input(num: number) {
  if (done.value) return;
  const cell = selected.value;
  if (!cell) return say("lesson.selectFirst", false);
  const tk = task.value;
  if (tk.kind === "notes") return pencil(cell, num);
  if (tk.board[cell.r]![cell.c]) return reject(cell, "basics.miss.filled");
  if (!same(cell, tk.cell)) {
    if (tk.scan) {
      const box = (p: CellCoord) => Math.floor(p.r / 3) * 3 + Math.floor(p.c / 3);
      if (box(cell) !== box(tk.cell)) return reject(cell, "basics.miss.outside");
      const by = hatchedBy(board.value, cell, tk.scan);
      if (by)
        return reject(cell, by.r === cell.r ? "basics.miss.hatchedRow" : "basics.miss.hatchedCol", {
          d: digit(tk.scan),
          n: by.r === cell.r ? by.r + 1 : by.c + 1,
        });
    }
    if (tk.withNotes) {
      const left = notes.value[cell.r]![cell.c]!.filter(Boolean).length;
      return reject(cell, "basics.miss.many", { n: left });
    }
    return reject(cell, "basics.miss.otherCell");
  }
  if (num !== answer.value) {
    if (tk.scan) return reject(cell, "basics.miss.digit", { d: digit(tk.scan) });
    if (tk.withNotes) return reject(cell, "basics.miss.notMark", { d: digit(num) });
    const unit = blockedBy(board.value, cell, num);
    return reject(cell, unit ? `basics.miss.${unit}` : "basics.miss.otherCell", { d: digit(num) });
  }
  board.value[cell.r]![cell.c] = num;
  notes.value[cell.r]![cell.c] = Array(10).fill(false);
  flash.value = [{ ...cell, delay: 0 }];
  complete();
}

// Notes: a maybe that's already in the cell's row, column or box is refused with that reason.
function pencil(cell: CellCoord, num: number) {
  const tk = task.value;
  if (!same(cell, tk.cell)) return say("basics.miss.notesCell", false);
  if (!notesMode.value) return say("basics.notesFirst", false);
  const marks = notes.value[cell.r]![cell.c]!;
  if (marks[num]) {
    marks[num] = false;
    return (feedback.value = null);
  }
  const unit = blockedBy(board.value, cell, num);
  if (unit) return reject(cell, `basics.miss.${unit}`, { d: digit(num) });
  marks[num] = true;
  if (pencilled.value.length === wanted.value.length) finishNotes();
  else say("basics.notesSoFar", true, { d: digit(num) });
}
function finishNotes() {
  say("basics.notesAll", true, { digits: wanted.value.map(digit).join(", ") });
  done.value = true;
  selected.value = null;
  finish();
}

// Show me: points at the cell (and says why); for notes, pencils in the rest.
function showMe() {
  if (done.value) return;
  const tk = task.value;
  emit("cue", "hint");
  if (tk.kind === "notes") {
    const { r, c } = tk.cell;
    for (const n of wanted.value) notes.value[r]![c]![n] = true;
    return finishNotes();
  }
  shown.value = true;
  selected.value = { ...tk.cell };
  say(`basics.show.${tk.prompt}`, true, { d: digit(answer.value) });
}

const prompt = computed(() =>
  t(`basics.task.${task.value.prompt}`, { d: task.value.scan ? digit(task.value.scan) : "" }),
);

// Scanning: each placed copy of the digit draws its row or column across the box, as books do.
const marks = computed<Mark[]>(() => {
  const tk = task.value;
  if (!tk.scan) return [];
  const r0 = tk.cell.r - (tk.cell.r % 3);
  const c0 = tk.cell.c - (tk.cell.c % 3);
  const out: Mark[] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (tk.board[r]![c] !== tk.scan) continue;
      const at = { x: c + 0.5, y: r + 0.5 };
      if (r >= r0 && r < r0 + 3)
        out.push({
          kind: "line",
          a: at,
          b: { x: c < c0 ? c0 + 3 : c0, y: r + 0.5 },
          style: "weak",
        });
      if (c >= c0 && c < c0 + 3)
        out.push({
          kind: "line",
          a: at,
          b: { x: c + 0.5, y: r < r0 ? r0 + 3 : r0 },
          style: "weak",
        });
    }
  return out;
});

const counts = computed(() => {
  const n = Array(10).fill(0);
  for (const row of board.value) for (const v of row) n[v]++;
  return n;
});

const position = BASICS_IDS.indexOf(props.id);
const nextBasics = BASICS_IDS[position + 1] ?? null;
// After the singles lessons, the technique they are a first taste of.
const technique: TechniqueId | null =
  props.id === "single" ? "naked-single" : props.id === "scan" ? "hidden-single" : null;

const keys = computed(() =>
  done.value
    ? [
        { key: "Enter", desc: t("lesson.key.next") },
        { key: "Esc", desc: t("lesson.key.back") },
      ]
    : [
        { key: "↑←↓→", desc: t("lesson.key.move") },
        { key: "1–9", desc: t("lesson.key.place") },
        ...(task.value.kind === "notes" ? [{ key: "N", desc: t("controls.notes") }] : []),
        { key: "H", desc: t("lesson.showMe") },
        { key: "Esc", desc: t("lesson.key.back") },
      ],
);

function next() {
  if (nextBasics) emit("basics", nextBasics);
  else emit("lesson", "naked-single");
}

const STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  w: [-1, 0],
  s: [1, 0],
  a: [0, -1],
  d: [0, 1],
};
const onButton = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest?.("button, select");
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === "Escape") return emit("back");
  if (done.value) {
    if (key === "Enter" && !onButton(e)) {
      e.preventDefault();
      next();
    }
    return;
  }
  const move = STEPS[key];
  if (move) {
    e.preventDefault();
    const cur = selected.value;
    const r = Math.min(8, Math.max(0, (cur?.r ?? 0) + (cur ? move[0] : 0)));
    const c = Math.min(8, Math.max(0, (cur?.c ?? 0) + (cur ? move[1] : 0)));
    selected.value = { r, c };
    nextTick(() => document.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus());
  } else if (key >= "1" && key <= "9") {
    input(Number(key));
  } else if (key === "n") {
    notesMode.value = !notesMode.value;
  } else if (key === "h" && !e.repeat) {
    showMe();
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
        {{ $t("basics.title") }}: {{ $t(`basics.lesson.${id}`) }}
      </h1>
    </div>

    <div
      class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-3 sm:px-5 lg:grid lg:grid-cols-12 lg:gap-6"
    >
      <section
        class="panel order-first flex flex-col gap-3 p-4 lg:order-last lg:col-span-5 lg:self-start"
        data-testid="coach"
      >
        <!-- Which lesson of the four, then which task of this one. -->
        <div class="flex gap-1.5" aria-hidden="true">
          <div
            v-for="(b, i) in BASICS_IDS"
            :key="b"
            :class="i <= position ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-zinc-800'"
            class="h-1 flex-grow rounded-full"
          />
        </div>
        <template v-if="!done">
          <p class="text-xs font-bold text-violet-700 dark:text-violet-300">
            {{ $t("basics.lessonOf", { n: position + 1, total: BASICS_IDS.length }) }}
            <template v-if="tasks.length > 1">
              · {{ $t("basics.taskOf", { n: index + 1, total: tasks.length }) }}</template
            >
          </p>
          <p class="text-base leading-snug font-semibold text-zinc-900 dark:text-zinc-100">
            {{ prompt }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="task.kind === 'notes'"
              @click="notesMode = !notesMode"
              :aria-pressed="notesMode"
              data-testid="basics-notes"
              class="tile px-3 py-1.5 text-xs font-bold"
              :class="notesMode ? 'tile-amber' : ''"
            >
              ✎ {{ $t("controls.notes") }}
            </button>
            <button
              @click="showMe"
              class="tile px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300"
            >
              {{ $t("lesson.showMe") }}
            </button>
          </div>
        </template>
        <template v-else>
          <p class="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {{ $t("lesson.doneTitle") }}
          </p>
          <p class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {{ $t(`basics.done.${id}`) }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              @click="next"
              data-testid="basics-next"
              class="tile tile-primary w-full px-4 py-2.5 text-sm font-bold"
            >
              {{
                nextBasics
                  ? $t("basics.next", { name: $t(`basics.lesson.${nextBasics}`) })
                  : $t("basics.startPath")
              }}
            </button>
            <button
              v-if="technique && nextBasics"
              @click="emit('lesson', technique)"
              class="tile min-w-[8.5rem] flex-1 px-3 py-2 text-sm font-bold"
            >
              {{ $t("basics.learnMore", { name: $t(`hint.move.${technique}.name`) }) }}
            </button>
            <button
              @click="emit('back')"
              class="tile min-w-[8.5rem] flex-1 px-3 py-2 text-sm font-bold"
            >
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
        <ul
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
          :initial-board="task.board"
          :solved-board="SOLUTION"
          :notes-board="notes"
          :selected-cell="selected"
          :active-hint-cell="shown || done || task.kind === 'notes' ? task.cell : null"
          :hint-triggers="[]"
          :hint-eliminations="[]"
          :conflict-cells="[]"
          :color-mode="colorMode"
          :flash-cells="flash"
          :show-errors="false"
          :active-digit="task.scan ?? null"
          :nudge="task.unit ?? null"
          :theme="theme"
          :marks="marks"
          @select-cell="(cell) => (selected = cell)"
        />
        <Numpad v-if="!done" :counts="counts" :color-mode="colorMode" @input-number="input" />
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
