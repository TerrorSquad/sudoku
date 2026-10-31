import type { Grid, CellCoord } from "../types/sudoku";

// Pure sudoku logic: no Vue, no i18n — unit-testable and reusable
// (engine composable, daily puzzle, difficulty grader).

export type Rng = () => number;

/** Mulberry32 seeded PRNG — deterministic for a given seed. */
export function makeRng(seed: number): Rng {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export function seedFromString(str: string): number {
  return str.split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 1);
}

export function cloneGrid(board: Grid): Grid {
  return board.map((row) => [...row]);
}

export function isValidPlacement(board: Grid, row: number, col: number, num: number): boolean {
  for (let x = 0; x < 9; x++) {
    if (x !== col && board[row]![x] === num) return false;
    if (x !== row && board[x]![col] === num) return false;
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const r = startRow + i;
      const c = startCol + j;
      if ((r !== row || c !== col) && board[r]![c] === num) return false;
    }
  }
  return true;
}

/** Cells already containing `num` that conflict with placing it at (row, col). */
export function getConflictCells(board: Grid, row: number, col: number, num: number): CellCoord[] {
  const conflicts: CellCoord[] = [];
  if (num === 0) return conflicts;

  for (let x = 0; x < 9; x++) {
    if (x !== col && board[row]![x] === num) conflicts.push({ r: row, c: x });
    if (x !== row && board[x]![col] === num) conflicts.push({ r: x, c: col });
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const r = startRow + i;
      const c = startCol + j;
      if ((r !== row || c !== col) && board[r]![c] === num) {
        if (!conflicts.some((item) => item.r === r && item.c === c)) {
          conflicts.push({ r, c });
        }
      }
    }
  }
  return conflicts;
}

/** Candidate digits per empty cell (empty array for filled cells). */
export function getGridCandidates(board: Grid): number[][][] {
  const candidates: number[][][] = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => [] as number[]),
  );
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r]![c] === 0) {
        for (let val = 1; val <= 9; val++) {
          if (isValidPlacement(board, r, c, val)) candidates[r]![c]!.push(val);
        }
      }
    }
  }
  return candidates;
}

function popcount(x: number): number {
  let count = 0;
  while (x) {
    x &= x - 1;
    count++;
  }
  return count;
}

const boxIndex = (r: number, c: number) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

interface Masks {
  rows: number[];
  cols: number[];
  boxes: number[];
}

/** Build bitmasks of used digits per row/col/box. Returns null if givens conflict. */
function buildMasks(board: Grid): Masks | null {
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r]![c]!;
      if (v === 0) continue;
      const bit = 1 << (v - 1);
      const b = boxIndex(r, c);
      if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) return null;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
    }
  }
  return { rows, cols, boxes };
}

/**
 * Count solutions of a puzzle, stopping early at `limit`.
 * Uses MRV (fewest-candidates-first) backtracking with bitmasks.
 */
export function countSolutions(board: Grid, limit = 2): number {
  return countFlat(Uint8Array.from(board.flat()), limit);
}

// Unit of each of the 81 cells, and the bit count of every 9-bit mask: the solver's hot loop
// only indexes typed arrays.
const ROW = Uint8Array.from({ length: 81 }, (_, i) => Math.floor(i / 9));
const COL = Uint8Array.from({ length: 81 }, (_, i) => i % 9);
const BOX = Uint8Array.from({ length: 81 }, (_, i) => boxIndex(ROW[i]!, COL[i]!));
const BITS = new Uint8Array(512);
for (let m = 1; m < 512; m++) BITS[m] = BITS[m >> 1]! + (m & 1);

/**
 * `countSolutions` on a flat board (81 digits, 0 = empty). `banCell`/`banBit` keep one cell
 * off one digit, which is how `generatePuzzle` asks "is there another solution?" in one search.
 */
function countFlat(cells: Uint8Array, limit: number, banCell = -1, banBit = 0): number {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  const empty: number[] = [];
  for (let i = 0; i < 81; i++) {
    const v = cells[i]!;
    if (v === 0) {
      empty.push(i);
      continue;
    }
    const bit = 1 << (v - 1);
    if ((rows[ROW[i]!]! | cols[COL[i]!]! | boxes[BOX[i]!]!) & bit) return 0;
    rows[ROW[i]!]! |= bit;
    cols[COL[i]!]! |= bit;
    boxes[BOX[i]!]! |= bit;
  }
  let count = 0;

  // Fill empty[depth..] most-constrained cell first; the cell chosen is swapped to `depth`.
  function search(depth: number): void {
    if (depth === empty.length) {
      count++;
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let k = depth; k < empty.length; k++) {
      const i = empty[k]!;
      let mask = ~(rows[ROW[i]!]! | cols[COL[i]!]! | boxes[BOX[i]!]!) & 0x1ff;
      if (i === banCell) mask &= ~banBit;
      const n = BITS[mask]!;
      if (n === 0) return; // dead end
      if (n < bestCount) {
        bestCount = n;
        best = k;
        bestMask = mask;
        if (n === 1) break;
      }
    }
    const i = empty[best]!;
    empty[best] = empty[depth]!;
    empty[depth] = i;
    const r = ROW[i]!;
    const c = COL[i]!;
    const b = BOX[i]!;
    for (let m = bestMask; m; m &= m - 1) {
      const bit = m & -m;
      rows[r]! |= bit;
      cols[c]! |= bit;
      boxes[b]! |= bit;
      search(depth + 1);
      rows[r]! ^= bit;
      cols[c]! ^= bit;
      boxes[b]! ^= bit;
      if (count >= limit) return;
    }
  }

  search(0);
  return Math.min(count, limit);
}

export function hasUniqueSolution(board: Grid): boolean {
  return countSolutions(board, 2) === 1;
}

/** Solve a puzzle; returns a solved copy or null if unsolvable. */
export function solveBoard(board: Grid): Grid | null {
  const b = cloneGrid(board);
  const masks = buildMasks(b);
  if (!masks) return null;
  const { rows, cols, boxes } = masks;

  function search(): boolean {
    let bestR = -1;
    let bestC = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r]![c] !== 0) continue;
        const mask = ~(rows[r]! | cols[c]! | boxes[boxIndex(r, c)]!) & 0x1ff;
        const n = popcount(mask);
        if (n === 0) return false;
        if (n < bestCount) {
          bestCount = n;
          bestR = r;
          bestC = c;
          bestMask = mask;
          if (n === 1) {
            r = 9;
            break;
          }
        }
      }
    }
    if (bestR === -1) return true;

    const bIdx = boxIndex(bestR, bestC);
    for (let v = 0; v < 9; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      b[bestR]![bestC] = v + 1;
      rows[bestR]! |= bit;
      cols[bestC]! |= bit;
      boxes[bIdx]! |= bit;
      if (search()) return true;
      b[bestR]![bestC] = 0;
      rows[bestR]! &= ~bit;
      cols[bestC]! &= ~bit;
      boxes[bIdx]! &= ~bit;
    }
    return false;
  }

  return search() ? b : null;
}

function shuffled<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Generate a random fully-solved grid via randomized backtracking. */
export function generateSolvedGrid(rng: Rng = Math.random): Grid {
  const b: Grid = Array(9)
    .fill(null)
    .map(() => Array(9).fill(0));

  function fill(idx: number): boolean {
    if (idx === 81) return true;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      if (isValidPlacement(b, r, c, v)) {
        b[r]![c] = v;
        if (fill(idx + 1)) return true;
        b[r]![c] = 0;
      }
    }
    return false;
  }

  fill(0);
  return b;
}

export interface GeneratedPuzzle {
  puzzle: Grid;
  solution: Grid;
  removed: number;
}

/**
 * Generate a puzzle with a guaranteed unique solution.
 * Digs up to `removeTarget` cells from a random solved grid, skipping any
 * removal that would allow a second solution. May remove fewer than the
 * target when uniqueness can't be preserved (common above ~55 removals).
 */
export function generatePuzzle(removeTarget: number, rng: Rng = Math.random): GeneratedPuzzle {
  const solution = generateSolvedGrid(rng);
  const puzzle = cloneGrid(solution);
  const cells = Uint8Array.from(solution.flat());
  const order = shuffled(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  );

  let removed = 0;
  for (const idx of order) {
    if (removed >= removeTarget) break;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    // The board is unique so far, so any second solution after the dig must put another digit
    // here: one search with this cell's digit banned answers it.
    const saved = cells[idx]!;
    cells[idx] = 0;
    if (countFlat(cells, 1, idx, 1 << (saved - 1)) === 0) {
      puzzle[r]![c] = 0;
      removed++;
    } else {
      cells[idx] = saved;
    }
  }

  return { puzzle, solution, removed };
}
