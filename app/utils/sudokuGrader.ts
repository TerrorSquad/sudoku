import type { Grid } from '../types/sudoku';
import { cloneGrid, generatePuzzle, type Rng, type GeneratedPuzzle } from './sudokuCore';

// Logical solver used to grade puzzles by the hardest technique required,
// instead of guessing difficulty from clue count alone.
//
// Grade tiers:
//   1 — singles only (naked/hidden single)
//   2 — pairs: naked/hidden pair, pointing, claiming
//   3 — naked/hidden triple, X-Wing
//   4 — naked/hidden quad, Swordfish, XY-Wing
//   5 — not solvable with the above (chains/guessing territory)

export type Grade = 1 | 2 | 3 | 4 | 5;

const bit = (v: number) => 1 << (v - 1);
const ALL_MASK = 0x1FF;

function popcount(x: number): number {
  let count = 0;
  while (x) { x &= x - 1; count++; }
  return count;
}

function maskDigits(mask: number): number[] {
  const out: number[] = [];
  for (let v = 1; v <= 9; v++) if (mask & bit(v)) out.push(v);
  return out;
}

// Precomputed units (rows, cols, boxes) and peers as 81-cell indices.
const ROWS: number[][] = [];
const COLS: number[][] = [];
const BOXES: number[][] = [];
for (let u = 0; u < 9; u++) {
  ROWS.push(Array.from({ length: 9 }, (_, i) => u * 9 + i));
  COLS.push(Array.from({ length: 9 }, (_, i) => i * 9 + u));
  const br = Math.floor(u / 3) * 3;
  const bc = (u % 3) * 3;
  const box: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push((br + r) * 9 + bc + c);
  BOXES.push(box);
}
const ALL_UNITS = [...ROWS, ...COLS, ...BOXES];

const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  const set = new Set<number>([...ROWS[r]!, ...COLS[c]!, ...BOXES[b]!]);
  set.delete(i);
  return [...set];
});

function* combos(items: number[], k: number, start = 0, acc: number[] = []): Generator<number[]> {
  if (acc.length === k) { yield [...acc]; return; }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i]!);
    yield* combos(items, k, i + 1, acc);
    acc.pop();
  }
}

interface SolveState {
  board: number[];   // 81 cells, 0 = empty
  cands: number[];   // candidate bitmask per cell, 0 for filled
}

function initState(puzzle: Grid): SolveState {
  const board = new Array<number>(81).fill(0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) board[r * 9 + c] = puzzle[r]![c]!;
  const cands = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    let mask = ALL_MASK;
    for (const p of PEERS[i]!) {
      if (board[p] !== 0) mask &= ~bit(board[p]!);
    }
    cands[i] = mask;
  }
  return { board, cands };
}

function place(s: SolveState, i: number, v: number): void {
  s.board[i] = v;
  s.cands[i] = 0;
  for (const p of PEERS[i]!) s.cands[p]! &= ~bit(v);
}

// --- Tier 1: singles ---

function placeNakedSingles(s: SolveState): boolean {
  let placed = false;
  for (let i = 0; i < 81; i++) {
    if (s.board[i] === 0 && popcount(s.cands[i]!) === 1) {
      place(s, i, maskDigits(s.cands[i]!)[0]!);
      placed = true;
    }
  }
  return placed;
}

function placeHiddenSingles(s: SolveState): boolean {
  let placed = false;
  for (const unit of ALL_UNITS) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      let only = -1;
      let count = 0;
      for (const i of unit) {
        if (s.board[i] === 0 && (s.cands[i]! & b)) {
          only = i;
          if (++count > 1) break;
        }
      }
      if (count === 1) {
        place(s, only, v);
        placed = true;
      }
    }
  }
  return placed;
}

// --- Tier 2: pointing / claiming (box-line interactions) ---

function eliminateBoxLine(s: SolveState): boolean {
  let changed = false;
  // Pointing: digit confined to one row/col within a box → remove from rest of that line
  for (const box of BOXES) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const cells = box.filter(i => s.board[i] === 0 && (s.cands[i]! & b));
      if (cells.length < 2) continue;
      const rows = new Set(cells.map(i => Math.floor(i / 9)));
      const cols = new Set(cells.map(i => i % 9));
      if (rows.size === 1) {
        const r = [...rows][0]!;
        for (const i of ROWS[r]!) {
          if (!box.includes(i) && (s.cands[i]! & b)) { s.cands[i]! &= ~b; changed = true; }
        }
      }
      if (cols.size === 1) {
        const c = [...cols][0]!;
        for (const i of COLS[c]!) {
          if (!box.includes(i) && (s.cands[i]! & b)) { s.cands[i]! &= ~b; changed = true; }
        }
      }
    }
  }
  // Claiming: digit confined to one box within a row/col → remove from rest of that box
  for (const line of [...ROWS, ...COLS]) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const cells = line.filter(i => s.board[i] === 0 && (s.cands[i]! & b));
      if (cells.length < 2) continue;
      const boxes = new Set(cells.map(i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)));
      if (boxes.size === 1) {
        const boxIdx = [...boxes][0]!;
        for (const i of BOXES[boxIdx]!) {
          if (!line.includes(i) && (s.cands[i]! & b)) { s.cands[i]! &= ~b; changed = true; }
        }
      }
    }
  }
  return changed;
}

// --- Naked / hidden subsets of size k ---

function eliminateNakedSubset(s: SolveState, k: number): boolean {
  let changed = false;
  for (const unit of ALL_UNITS) {
    const empty = unit.filter(i => s.board[i] === 0 && popcount(s.cands[i]!) <= k);
    if (empty.length < k) continue;
    for (const combo of combos(empty, k)) {
      let union = 0;
      for (const i of combo) union |= s.cands[i]!;
      if (popcount(union) !== k) continue;
      for (const i of unit) {
        if (s.board[i] === 0 && !combo.includes(i) && (s.cands[i]! & union)) {
          s.cands[i]! &= ~union;
          changed = true;
        }
      }
    }
  }
  return changed;
}

function eliminateHiddenSubset(s: SolveState, k: number): boolean {
  let changed = false;
  for (const unit of ALL_UNITS) {
    const empty = unit.filter(i => s.board[i] === 0);
    if (empty.length <= k) continue;
    let present = 0;
    for (const i of empty) present |= s.cands[i]!;
    const digits = maskDigits(present);
    if (digits.length <= k) continue;
    for (const combo of combos(digits, k)) {
      let comboMask = 0;
      for (const v of combo) comboMask |= bit(v);
      const holders = empty.filter(i => s.cands[i]! & comboMask);
      if (holders.length !== k) continue;
      for (const i of holders) {
        if (s.cands[i]! & ~comboMask) {
          s.cands[i]! &= comboMask;
          changed = true;
        }
      }
    }
  }
  return changed;
}

// --- Fish (X-Wing k=2, Swordfish k=3) on rows and columns ---

function eliminateFish(s: SolveState, k: number): boolean {
  let changed = false;
  for (const [base, cover] of [[ROWS, COLS], [COLS, ROWS]] as const) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const baseSets: { unit: number; positions: number[] }[] = [];
      for (let u = 0; u < 9; u++) {
        const positions = base[u]!
          .map((i, pos) => ({ i, pos }))
          .filter(({ i }) => s.board[i] === 0 && (s.cands[i]! & b))
          .map(({ pos }) => pos);
        if (positions.length >= 2 && positions.length <= k) baseSets.push({ unit: u, positions });
      }
      if (baseSets.length < k) continue;
      for (const combo of combos(baseSets.map((_, idx) => idx), k)) {
        const cols = new Set<number>();
        for (const idx of combo) for (const p of baseSets[idx]!.positions) cols.add(p);
        if (cols.size !== k) continue;
        const baseUnits = new Set(combo.map(idx => baseSets[idx]!.unit));
        for (const c of cols) {
          for (let u = 0; u < 9; u++) {
            if (baseUnits.has(u)) continue;
            const i = base[u]![c]!;
            if (s.board[i] === 0 && (s.cands[i]! & b)) {
              s.cands[i]! &= ~b;
              changed = true;
            }
          }
        }
      }
    }
  }
  return changed;
}

// --- XY-Wing ---

function eliminateXYWing(s: SolveState): boolean {
  const bivalue = [];
  for (let i = 0; i < 81; i++) {
    if (s.board[i] === 0 && popcount(s.cands[i]!) === 2) bivalue.push(i);
  }
  for (const pivot of bivalue) {
    const pm = s.cands[pivot]!;
    const pincers = PEERS[pivot]!.filter(i =>
      s.board[i] === 0 && popcount(s.cands[i]!) === 2 && (s.cands[i]! & pm) && s.cands[i]! !== pm
    );
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const ma = s.cands[pincers[a]!]!;
        const mb = s.cands[pincers[b]!]!;
        // pincers must share exactly one digit z not in the pivot, and cover both pivot digits
        const z = ma & mb & ~pm;
        if (popcount(z) !== 1) continue;
        if (((ma | mb) & pm) !== pm) continue;
        let changed = false;
        for (const i of PEERS[pincers[a]!]!) {
          if (i === pivot || i === pincers[b]) continue;
          if (s.board[i] === 0 && (s.cands[i]! & z) && PEERS[pincers[b]!]!.includes(i)) {
            s.cands[i]! &= ~z;
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
  }
  return false;
}

export interface LogicalSolveResult {
  grade: Grade;
  solved: boolean;
  board: Grid;
}

/** Solve as far as pure logic allows; grade = hardest tier that was needed. */
export function solveLogically(puzzle: Grid): LogicalSolveResult {
  const s = initState(puzzle);
  let grade: Grade = 1;

  const tiers: { tier: Grade; run: () => boolean }[] = [
    { tier: 1, run: () => placeNakedSingles(s) || placeHiddenSingles(s) },
    { tier: 2, run: () => eliminateBoxLine(s) || eliminateNakedSubset(s, 2) || eliminateHiddenSubset(s, 2) },
    { tier: 3, run: () => eliminateNakedSubset(s, 3) || eliminateHiddenSubset(s, 3) || eliminateFish(s, 2) },
    { tier: 4, run: () => eliminateNakedSubset(s, 4) || eliminateHiddenSubset(s, 4) || eliminateFish(s, 3) || eliminateXYWing(s) },
  ];

  outer: while (s.board.some(v => v === 0)) {
    for (const { tier, run } of tiers) {
      if (run()) {
        if (tier > grade) grade = tier;
        continue outer;
      }
    }
    grade = 5;
    break;
  }

  const board: Grid = [];
  for (let r = 0; r < 9; r++) board.push(s.board.slice(r * 9, r * 9 + 9));
  return { grade, solved: s.board.every(v => v !== 0), board };
}

export function gradePuzzle(puzzle: Grid): Grade {
  return solveLogically(puzzle).grade;
}

export interface GradedPuzzle extends GeneratedPuzzle {
  grade: Grade;
}

interface DifficultyTarget {
  removeTarget: number;
  accepts: (g: Grade) => boolean;
  ideal: Grade;
}

// Dig targets and grade ranges tuned against measured grade distributions:
// random digging yields mostly singles-solvable puzzles at ANY clue count,
// so harder difficulties need deep digs plus retry-until-grade-matches.
const DIFFICULTY_TARGETS: Record<string, DifficultyTarget> = {
  beginner: { removeTarget: 20, accepts: g => g === 1, ideal: 1 },
  easy: { removeTarget: 32, accepts: g => g === 1, ideal: 1 },
  medium: { removeTarget: 54, accepts: g => g === 2, ideal: 2 },
  hard: { removeTarget: 56, accepts: g => g === 3 || g === 4, ideal: 3 },
  expert: { removeTarget: 58, accepts: g => g >= 4, ideal: 4 },
  master: { removeTarget: 62, accepts: g => g === 5, ideal: 5 },
};

/**
 * Generate a puzzle whose required techniques match the requested difficulty.
 * Retries generation up to `maxAttempts`; falls back to the closest grade
 * seen so the call always returns a unique-solution puzzle.
 */
export function generateGradedPuzzle(difficulty: string, rng: Rng = Math.random, maxAttempts = 30): GradedPuzzle {
  const target = DIFFICULTY_TARGETS[difficulty] ?? { removeTarget: 42, accepts: () => true, ideal: 3 as Grade };
  const removeTarget = target.removeTarget;

  let best: GradedPuzzle | null = null;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const gp = generatePuzzle(removeTarget, rng);
    const grade = gradePuzzle(gp.puzzle);
    const graded: GradedPuzzle = { ...gp, puzzle: cloneGrid(gp.puzzle), grade };
    if (target.accepts(grade)) return graded;
    const dist = Math.abs(grade - target.ideal);
    if (dist < bestDist) {
      bestDist = dist;
      best = graded;
    }
  }

  return best!;
}
