<script setup lang="ts">
import type { Grid, NotesGrid, CellCoord, FlashCell } from "../types/sudoku";
import type { Mark } from "../utils/patternMarks";
import type { BoardTheme } from "../utils/preferenceValues";
import type { BoardUnit } from "../utils/sudokuGrader";

const props = defineProps<{
  currentBoard: Grid;
  initialBoard: Grid;
  solvedBoard: Grid;
  notesBoard: NotesGrid;
  selectedCell: CellCoord | null;
  /** The cell the active hint fills (green); null for a removal-only hint. */
  activeHintCell: CellCoord | null;
  hintTriggers: CellCoord[];
  hintEliminations: CellCoord[];
  conflictCells: CellCoord[];
  colorMode: boolean;
  flashCells: FlashCell[];
  showErrors: boolean;
  /** Digit-first input: highlights this digit and where it can still go. */
  activeDigit?: number | null;
  /** Outline the empty cells where the focused digit can still go. */
  showCandidates?: boolean;
  /** Pencil marks never mark the focused digit (Settings). */
  plainNotes?: boolean;
  /** "Nudge first" hints: the row, column or box to point at (a lesson's Show me: several). */
  nudge?: BoardUnit | BoardUnit[] | null;
  /** Board style from Settings: colours and digit face, see the styles below. */
  theme?: BoardTheme;
  /** A technique's pattern drawn in pen over the board; a new `marksKey` draws it again. */
  marks?: Mark[];
  marksKey?: number;
  /** X-Sudoku: both long diagonals are units, shaded, and count as peers and for candidates. */
  diagonal?: boolean;
}>();

// Which long diagonals (r = c, r + c = 8) a cell is on, as bits; none outside X-Sudoku.
const diagBits = (r: number, c: number) =>
  props.diagonal ? (r === c ? 1 : 0) | (r + c === 8 ? 2 : 0) : 0;

const emit = defineEmits<{
  /** `note`: the pencil mark tapped, if the tap landed on one. */
  (e: "select-cell", coord: CellCoord, note?: number): void;
}>();

function isCellHighlighted(r: number, c: number): boolean {
  if (!props.selectedCell) return false;
  const { r: selR, c: selC } = props.selectedCell;
  const inSameBox =
    Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3);
  return r === selR || c === selC || inSameBox || !!(diagBits(r, c) & diagBits(selR, selC));
}

function flashFor(r: number, c: number): FlashCell | undefined {
  return props.flashCells.find((cell) => cell.r === r && cell.c === c);
}

// The digit the board is about right now: the armed one, else the one in the selected cell.
const focusDigit = computed(() => {
  if (props.activeDigit) return props.activeDigit;
  const sel = props.selectedCell;
  return sel ? props.currentBoard[sel.r]![sel.c]! : 0;
});

function isSameValue(r: number, c: number): boolean {
  return focusDigit.value !== 0 && props.currentBoard[r]![c] === focusDigit.value;
}

// An empty cell where the focused digit doesn't already appear in its row, column or box, and
// that the player's own notes (if any) haven't ruled it out of.
function isCandidate(r: number, c: number): boolean {
  const d = focusDigit.value;
  if (!props.showCandidates || !d || props.currentBoard[r]![c] !== 0) return false;
  const notes = props.notesBoard[r]![c]!;
  if (notes.some(Boolean) && !notes[d]) return false;
  const b = props.currentBoard;
  for (let i = 0; i < 9; i++) if (b[r]![i] === d || b[i]![c] === d) return false;
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) if (b[br + i]![bc + j] === d) return false;
  const diag = diagBits(r, c);
  if (diag)
    for (let i = 0; i < 9; i++) {
      if (diag & 1 && b[i]![i] === d) return false;
      if (diag & 2 && b[i]![8 - i] === d) return false;
    }
  return true;
}

// Every empty cell still pencilled with the focused digit shows it as a chip.
function noteDigit(r: number, c: number): number {
  const d = props.plainNotes ? 0 : focusDigit.value;
  return d && props.currentBoard[r]![c] === 0 && props.notesBoard[r]![c]![d] ? d : 0;
}

function isNudged(r: number, c: number): boolean {
  const units = props.nudge ? [props.nudge].flat() : [];
  return units.some((n) =>
    n.kind === "row"
      ? n.r === r
      : n.kind === "col"
        ? n.c === c
        : n.kind === "diag"
          ? r === c
          : n.kind === "anti"
            ? r + c === 8
            : Math.floor(n.r / 3) === Math.floor(r / 3) &&
              Math.floor(n.c / 3) === Math.floor(c / 3),
  );
}

function hasConflict(r: number, c: number): boolean {
  return props.conflictCells.some((cell) => cell.r === r && cell.c === c);
}
</script>

<template>
  <div
    role="grid"
    :aria-label="$t('a11y.board')"
    :data-theme="theme ?? 'tiles'"
    class="board @container relative grid aspect-square w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-xl border-[0.1875rem] select-none lg:mx-auto lg:max-w-[calc(100vh-18.75rem)]"
  >
    <!-- display: contents keeps the visual grid flat while giving screen readers real rows. -->
    <div v-for="(row, r) in 9" :key="r" role="row" class="contents">
      <SudokuCell
        v-for="(col, c) in 9"
        :key="`${r}-${c}`"
        :row="r"
        :col="c"
        :value="currentBoard[r]![c]!"
        :is-initial="initialBoard[r]![c]! !== 0"
        :is-correct="currentBoard[r]![c]! === solvedBoard[r]![c]!"
        :has-conflict="hasConflict(r, c)"
        :is-selected="selectedCell?.r === r && selectedCell?.c === c"
        :is-hint-target="activeHintCell?.r === r && activeHintCell?.c === c"
        :is-highlighted="isCellHighlighted(r, c)"
        :is-same-value="isSameValue(r, c)"
        :notes="notesBoard[r]![c]!"
        :color-mode="colorMode"
        :is-flashing="!!flashFor(r, c)"
        :flash-delay="flashFor(r, c)?.delay ?? 0"
        :show-errors="showErrors"
        :is-candidate="isCandidate(r, c)"
        :is-nudged="isNudged(r, c)"
        :is-diagonal="!!diagBits(r, c)"
        :note-digit="noteDigit(r, c)"
        :tab-stop="selectedCell ? selectedCell.r === r && selectedCell.c === c : r === 0 && c === 0"
        :is-hint-trigger="hintTriggers.some((h) => h.r === r && h.c === c)"
        :is-hint-elimination="hintEliminations.some((h) => h.r === r && h.c === c)"
        @click="(note?: number) => emit('select-cell', { r, c }, note)"
      />
    </div>
    <PatternOverlay v-if="marks?.length" :key="marksKey ?? 0" :marks="marks" />
  </div>
</template>

<!-- Non-scoped: the .dark ancestor lives on <html>. Unlayered, so these beat the plain Tailwind
     utilities, while the !important highlight utilities (selection, hints, conflicts) still win. -->
<style>
/* Graph paper (the default; stored as "tiles"): white squares, pale-blue rules, navy box lines,
   the printed puzzle in navy and your entries in pen blue. Dark: chalk on slate. */
.board[data-theme="tiles"] {
  --cell-bg: #fdfdfb;
  --cell-peer: #e3ebf7;
  --cell-diag: #eff1f5;
  --cell-line: #b9c8de;
  --cell-box: #17294a;
  --cell-frame: #17294a;
  --cell-given: #17294a;
  --cell-entry: #2a52a8;
  --cell-note: #55657a;
}
.dark .board[data-theme="tiles"] {
  --cell-bg: #222c36;
  --cell-peer: #2e3a47;
  --cell-diag: #28313c;
  --cell-line: #3d4a59;
  --cell-box: #cdd5de;
  --cell-frame: #e6eaef;
  --cell-given: #f4f6f8;
  --cell-entry: #9cbcf0;
  --cell-note: #a9b5c3;
}
/* Newsprint: ink on grey paper, a ballpoint for your entries, serif digits like the puzzle page. */
.board[data-theme="newsprint"] {
  --cell-bg: #f1f0ec;
  --cell-peer: #e2dfd6;
  --cell-diag: #e9e7e1;
  --cell-line: #b7b3a8;
  --cell-box: #2b2a27;
  --cell-frame: #1e1d1a;
  --cell-given: #1e1d1a;
  --cell-entry: #1f4fa8;
  --cell-note: #5d594f;
}
.dark .board[data-theme="newsprint"] {
  --cell-bg: #22211e;
  --cell-peer: #34322d;
  --cell-diag: #2b2a26;
  --cell-line: #47443d;
  --cell-box: #b8b2a4;
  --cell-frame: #cfc9bb;
  --cell-given: #ece7dc;
  --cell-entry: #8fb4ff;
  --cell-note: #b0aa9c;
}
.board[data-theme="newsprint"] .font-game {
  font-family: ui-serif, Georgia, "Times New Roman", serif;
}
/* High contrast: pure black and white, the strongest lines. */
.board[data-theme="contrast"] {
  --cell-bg: #ffffff;
  --cell-peer: #e3e3e3;
  --cell-diag: #f0f0f0;
  --cell-line: #6b6b6b;
  --cell-box: #000000;
  --cell-frame: #000000;
  --cell-given: #000000;
  --cell-entry: #0033b8;
  --cell-note: #1f1f1f;
}
.dark .board[data-theme="contrast"] {
  --cell-bg: #000000;
  --cell-peer: #2b2b2b;
  --cell-diag: #161616;
  --cell-line: #8a8a8a;
  --cell-box: #ffffff;
  --cell-frame: #ffffff;
  --cell-given: #ffffff;
  --cell-entry: #8cb8ff;
  --cell-note: #ececec;
}

.board {
  border-color: var(--cell-frame);
}
.board .cell {
  background-color: var(--cell-bg);
  border-color: var(--cell-line);
}
/* X-Sudoku's diagonals: a shade between the paper and the peer highlight, which wins over it. */
.board .cell-diag {
  background-color: var(--cell-diag);
}
.board .cell-peer {
  background-color: var(--cell-peer);
}
.board .cell-box-r {
  border-right-color: var(--cell-box);
}
.board .cell-box-b {
  border-bottom-color: var(--cell-box);
}
.board .cell-given {
  color: var(--cell-given);
}
.board .cell-entry {
  color: var(--cell-entry);
}
.board .cell-note {
  color: var(--cell-note);
  font-family: var(--font-sans);
}
</style>
