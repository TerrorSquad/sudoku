import { nextTick } from "vue";

import type { CellCoord, NotesGrid } from "../types/sudoku";

// Arrows and WASD both walk the grid, so no board puts another shortcut on W, A, S or D.
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

const clamp = (n: number) => Math.min(8, Math.max(0, n));

export const sameCell = (a: CellCoord, b: CellCoord) => a.r === b.r && a.c === b.c;

/** A board with no pencil marks (index 0 unused, so a mark's index is its digit). */
export const emptyNotes = (): NotesGrid =>
  Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => Array(10).fill(false)));

/** The key came from a focused button (or select), whose own Enter or Space it is. */
export const onButton = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement).closest?.("button, select");

/**
 * The key a board's keydown handler acts on (a letter lower-cased), or null when it should
 * ignore it: a modifier is held (Alt+← is the browser's Back), or it was Escape, which calls onBack.
 */
export function boardKey(e: KeyboardEvent, onBack: () => void): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key !== "Escape") return key;
  onBack();
  return null;
}

/**
 * The cell `key` (a letter lower-cased) moves to from `cur`, clamped at the edges, or null when
 * it isn't a move key. With nothing selected, the first press lands on the top-left cell.
 */
export function stepCell(cur: CellCoord | null, key: string): CellCoord | null {
  const step = STEPS[key];
  if (!step) return null;
  return cur ? { r: clamp(cur.r + step[0]), c: clamp(cur.c + step[1]) } : { r: 0, c: 0 };
}

/** A wrong tap's shake; none with reduced motion. */
export function shakeCell({ r, c }: CellCoord) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelector(`[data-cell="${r}-${c}"]`)?.animate(
    [0, -4, 4, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 320 },
  );
}

/** Focus follows the selection (once it has rendered) so screen readers announce the cell. */
export function focusCell({ r, c }: CellCoord) {
  nextTick(() => document.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus());
}
