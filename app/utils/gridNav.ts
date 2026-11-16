import { nextTick } from "vue";

import type { CellCoord } from "../types/sudoku";

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

/**
 * The cell `key` (a letter lower-cased) moves to from `cur`, clamped at the edges, or null when
 * it isn't a move key. With nothing selected, the first press lands on the top-left cell.
 */
export function stepCell(cur: CellCoord | null, key: string): CellCoord | null {
  const step = STEPS[key];
  if (!step) return null;
  return cur ? { r: clamp(cur.r + step[0]), c: clamp(cur.c + step[1]) } : { r: 0, c: 0 };
}

/** Focus follows the selection (once it has rendered) so screen readers announce the cell. */
export function focusCell({ r, c }: CellCoord) {
  nextTick(() => document.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus());
}
