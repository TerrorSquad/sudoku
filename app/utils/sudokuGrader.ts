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

// 1..5 = hardest technique tier required to fully solve.
// STUCK = no implemented technique makes progress (needs guessing / a technique
// we don't model). STUCK puzzles are never accepted for generated games — that
// guarantees the hint engine (a superset of these techniques) can always find a
// real move and never has to fall back to revealing the answer.
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;
export const STUCK: Grade = 6;

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

// --- XYZ-Wing ---
// Pivot has 3 candidates {x,y,z}; two bivalue pincers (peers of pivot) are
// {x,z} and {y,z}. z can be removed from any cell that sees all three.

function eliminateXYZWing(s: SolveState): boolean {
  for (let pivot = 0; pivot < 81; pivot++) {
    if (s.board[pivot] !== 0 || popcount(s.cands[pivot]!) !== 3) continue;
    const pm = s.cands[pivot]!;
    const pincers = PEERS[pivot]!.filter(i =>
      s.board[i] === 0 && popcount(s.cands[i]!) === 2 && (s.cands[i]! & ~pm) === 0
    );
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const ma = s.cands[pincers[a]!]!;
        const mb = s.cands[pincers[b]!]!;
        if ((ma | mb) !== pm) continue;       // together cover all three digits
        const z = ma & mb;                    // shared digit, eliminable
        if (popcount(z) !== 1) continue;
        let changed = false;
        for (let i = 0; i < 81; i++) {
          if (i === pivot || i === pincers[a] || i === pincers[b]) continue;
          if (s.board[i] !== 0 || !(s.cands[i]! & z)) continue;
          if (PEERS[pivot]!.includes(i) && PEERS[pincers[a]!]!.includes(i) && PEERS[pincers[b]!]!.includes(i)) {
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

// ===========================================================================
// Structured hint layer
//
// The boolean technique functions above drive grading (fast, batch). The hint
// engine needs the SAME logic but reported as a single structured move it can
// explain and apply soundly — placements place a logically-forced digit;
// eliminations remove specific candidates (never the answer key). These finders
// are read-only (no mutation) and return the FIRST move of their kind.
// ===========================================================================

export type TechniqueId =
  | 'naked-single' | 'hidden-single'
  | 'pointing' | 'box-line'
  | 'naked-pair' | 'hidden-pair'
  | 'naked-triple' | 'hidden-triple'
  | 'naked-quad' | 'hidden-quad'
  | 'x-wing' | 'swordfish' | 'jellyfish'
  | 'xy-wing' | 'xyz-wing';

export interface CellRC { r: number; c: number; }
export interface DigitAt { r: number; c: number; num: number; }

export interface SolveMove {
  technique: TechniqueId;
  tier: Grade;
  placement?: DigitAt;        // present for single techniques
  eliminations: DigitAt[];    // candidates removed (elimination techniques)
  triggers: CellRC[];         // the pattern cells that justify the move
  digits: number[];           // the digit(s) the technique is about
}

const rc = (i: number): CellRC => ({ r: Math.floor(i / 9), c: i % 9 });
const idx = (r: number, c: number) => r * 9 + c;

function findNakedSingleMove(s: SolveState): SolveMove | null {
  for (let i = 0; i < 81; i++) {
    if (s.board[i] === 0 && popcount(s.cands[i]!) === 1) {
      const num = maskDigits(s.cands[i]!)[0]!;
      const triggers = PEERS[i]!.filter(p => s.board[p] !== 0).map(rc);
      return { technique: 'naked-single', tier: 1, placement: { ...rc(i), num }, eliminations: [], triggers, digits: [num] };
    }
  }
  return null;
}

function findHiddenSingleMove(s: SolveState): SolveMove | null {
  for (const unit of ALL_UNITS) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      let only = -1; let count = 0;
      for (const i of unit) {
        if (s.board[i] === 0 && (s.cands[i]! & b)) { only = i; if (++count > 1) break; }
      }
      if (count === 1) {
        const triggers = unit.filter(i => i !== only && s.board[i] !== 0).map(rc);
        return { technique: 'hidden-single', tier: 1, placement: { ...rc(only), num: v }, eliminations: [], triggers, digits: [v] };
      }
    }
  }
  return null;
}

function findBoxLineMove(s: SolveState): SolveMove | null {
  // Pointing: digit confined to one row/col within a box → clear it from the line
  for (const box of BOXES) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const cells = box.filter(i => s.board[i] === 0 && (s.cands[i]! & b));
      if (cells.length < 2) continue;
      const rows = new Set(cells.map(i => Math.floor(i / 9)));
      const cols = new Set(cells.map(i => i % 9));
      const line = rows.size === 1 ? ROWS[[...rows][0]!]! : cols.size === 1 ? COLS[[...cols][0]!]! : null;
      if (!line) continue;
      const elims = line.filter(i => !box.includes(i) && s.board[i] === 0 && (s.cands[i]! & b));
      if (elims.length) {
        return { technique: 'pointing', tier: 2, eliminations: elims.map(i => ({ ...rc(i), num: v })), triggers: cells.map(rc), digits: [v] };
      }
    }
  }
  // Claiming: digit confined to one box within a row/col → clear it from the box
  for (const lineSet of [...ROWS, ...COLS]) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const cells = lineSet.filter(i => s.board[i] === 0 && (s.cands[i]! & b));
      if (cells.length < 2) continue;
      const boxes = new Set(cells.map(i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)));
      if (boxes.size !== 1) continue;
      const box = BOXES[[...boxes][0]!]!;
      const elims = box.filter(i => !lineSet.includes(i) && s.board[i] === 0 && (s.cands[i]! & b));
      if (elims.length) {
        return { technique: 'box-line', tier: 2, eliminations: elims.map(i => ({ ...rc(i), num: v })), triggers: cells.map(rc), digits: [v] };
      }
    }
  }
  return null;
}

const NAKED_SUBSET_TECH: Record<number, TechniqueId> = { 2: 'naked-pair', 3: 'naked-triple', 4: 'naked-quad' };
const HIDDEN_SUBSET_TECH: Record<number, TechniqueId> = { 2: 'hidden-pair', 3: 'hidden-triple', 4: 'hidden-quad' };
const SUBSET_TIER: Record<number, Grade> = { 2: 2, 3: 3, 4: 4 };

function findNakedSubsetMove(s: SolveState, k: number): SolveMove | null {
  for (const unit of ALL_UNITS) {
    const empty = unit.filter(i => s.board[i] === 0 && popcount(s.cands[i]!) <= k && popcount(s.cands[i]!) >= 2);
    if (empty.length < k) continue;
    for (const combo of combos(empty, k)) {
      let union = 0;
      for (const i of combo) union |= s.cands[i]!;
      if (popcount(union) !== k) continue;
      const elims: DigitAt[] = [];
      for (const i of unit) {
        if (s.board[i] === 0 && !combo.includes(i) && (s.cands[i]! & union)) {
          for (const num of maskDigits(s.cands[i]! & union)) elims.push({ ...rc(i), num });
        }
      }
      if (elims.length) {
        return { technique: NAKED_SUBSET_TECH[k]!, tier: SUBSET_TIER[k]!, eliminations: elims, triggers: combo.map(rc), digits: maskDigits(union) };
      }
    }
  }
  return null;
}

function findHiddenSubsetMove(s: SolveState, k: number): SolveMove | null {
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
      const elims: DigitAt[] = [];
      for (const i of holders) {
        if (s.cands[i]! & ~comboMask) {
          for (const num of maskDigits(s.cands[i]! & ~comboMask)) elims.push({ ...rc(i), num });
        }
      }
      if (elims.length) {
        return { technique: HIDDEN_SUBSET_TECH[k]!, tier: SUBSET_TIER[k]!, eliminations: elims, triggers: holders.map(rc), digits: combo };
      }
    }
  }
  return null;
}

const FISH_TECH: Record<number, TechniqueId> = { 2: 'x-wing', 3: 'swordfish', 4: 'jellyfish' };
const FISH_TIER: Record<number, Grade> = { 2: 3, 3: 4, 4: 5 };

function findFishMove(s: SolveState, k: number): SolveMove | null {
  for (const [base] of [[ROWS, COLS], [COLS, ROWS]] as const) {
    const baseIsRow = base === ROWS;
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
      for (const combo of combos(baseSets.map((_, i) => i), k)) {
        const lines = new Set<number>();
        for (const ci of combo) for (const p of baseSets[ci]!.positions) lines.add(p);
        if (lines.size !== k) continue;
        const baseUnits = new Set(combo.map(ci => baseSets[ci]!.unit));
        const elims: DigitAt[] = [];
        const triggers: CellRC[] = [];
        for (const ci of combo) {
          for (const p of baseSets[ci]!.positions) {
            const i = baseIsRow ? idx(baseSets[ci]!.unit, p) : idx(p, baseSets[ci]!.unit);
            triggers.push(rc(i));
          }
        }
        for (const p of lines) {
          for (let u = 0; u < 9; u++) {
            if (baseUnits.has(u)) continue;
            const i = baseIsRow ? idx(u, p) : idx(p, u);
            if (s.board[i] === 0 && (s.cands[i]! & b)) elims.push({ ...rc(i), num: v });
          }
        }
        if (elims.length) {
          return { technique: FISH_TECH[k]!, tier: FISH_TIER[k]!, eliminations: elims, triggers, digits: [v] };
        }
      }
    }
  }
  return null;
}

function findXYWingMove(s: SolveState): SolveMove | null {
  const bivalue: number[] = [];
  for (let i = 0; i < 81; i++) if (s.board[i] === 0 && popcount(s.cands[i]!) === 2) bivalue.push(i);
  for (const pivot of bivalue) {
    const pm = s.cands[pivot]!;
    const pincers = PEERS[pivot]!.filter(i =>
      s.board[i] === 0 && popcount(s.cands[i]!) === 2 && (s.cands[i]! & pm) && s.cands[i]! !== pm
    );
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const ma = s.cands[pincers[a]!]!;
        const mb = s.cands[pincers[b]!]!;
        const z = ma & mb & ~pm;
        if (popcount(z) !== 1) continue;
        if (((ma | mb) & pm) !== pm) continue;
        const zNum = maskDigits(z)[0]!;
        const elims: DigitAt[] = [];
        for (const i of PEERS[pincers[a]!]!) {
          if (i === pivot || i === pincers[b]) continue;
          if (s.board[i] === 0 && (s.cands[i]! & z) && PEERS[pincers[b]!]!.includes(i)) elims.push({ ...rc(i), num: zNum });
        }
        if (elims.length) {
          return { technique: 'xy-wing', tier: 4, eliminations: elims, triggers: [rc(pivot), rc(pincers[a]!), rc(pincers[b]!)], digits: [zNum] };
        }
      }
    }
  }
  return null;
}

function findXYZWingMove(s: SolveState): SolveMove | null {
  for (let pivot = 0; pivot < 81; pivot++) {
    if (s.board[pivot] !== 0 || popcount(s.cands[pivot]!) !== 3) continue;
    const pm = s.cands[pivot]!;
    const pincers = PEERS[pivot]!.filter(i =>
      s.board[i] === 0 && popcount(s.cands[i]!) === 2 && (s.cands[i]! & ~pm) === 0
    );
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const ma = s.cands[pincers[a]!]!;
        const mb = s.cands[pincers[b]!]!;
        if ((ma | mb) !== pm) continue;
        const z = ma & mb;
        if (popcount(z) !== 1) continue;
        const zNum = maskDigits(z)[0]!;
        const elims: DigitAt[] = [];
        for (let i = 0; i < 81; i++) {
          if (i === pivot || i === pincers[a] || i === pincers[b]) continue;
          if (s.board[i] !== 0 || !(s.cands[i]! & z)) continue;
          if (PEERS[pivot]!.includes(i) && PEERS[pincers[a]!]!.includes(i) && PEERS[pincers[b]!]!.includes(i)) {
            elims.push({ ...rc(i), num: zNum });
          }
        }
        if (elims.length) {
          return { technique: 'xyz-wing', tier: 5, eliminations: elims, triggers: [rc(pivot), rc(pincers[a]!), rc(pincers[b]!)], digits: [zNum] };
        }
      }
    }
  }
  return null;
}

// Easiest-first dispatch — mirrors the grading tier order.
function findNextMove(s: SolveState): SolveMove | null {
  return findNakedSingleMove(s)
    ?? findHiddenSingleMove(s)
    ?? findBoxLineMove(s)
    ?? findNakedSubsetMove(s, 2)
    ?? findHiddenSubsetMove(s, 2)
    ?? findNakedSubsetMove(s, 3)
    ?? findHiddenSubsetMove(s, 3)
    ?? findFishMove(s, 2)
    ?? findNakedSubsetMove(s, 4)
    ?? findHiddenSubsetMove(s, 4)
    ?? findFishMove(s, 3)
    ?? findXYWingMove(s)
    ?? findFishMove(s, 4)
    ?? findXYZWingMove(s);
}

/**
 * The next logically-justified move for the current board, or null if no
 * implemented technique applies. `appliedEliminations` are candidate removals
 * already shown to the player in earlier hint steps — replayed so an
 * elimination chain progresses to the placement it unlocks.
 */
export function nextHint(board: Grid, appliedEliminations: DigitAt[] = []): SolveMove | null {
  const s = initState(board);
  for (const e of appliedEliminations) {
    const i = idx(e.r, e.c);
    if (s.board[i] === 0) s.cands[i]! &= ~bit(e.num);
  }
  return findNextMove(s);
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
    { tier: 5, run: () => eliminateFish(s, 4) || eliminateXYZWing(s) },
  ];

  outer: while (s.board.some(v => v === 0)) {
    for (const { tier, run } of tiers) {
      if (run()) {
        if (tier > grade) grade = tier;
        continue outer;
      }
    }
    grade = STUCK;
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
  min: Grade;   // lowest acceptable tier (inclusive)
  max: Grade;   // highest acceptable tier (inclusive)
  ideal: Grade; // preferred tier; closest-to-ideal solved board is the fallback
}

// All targets are SOLVED tiers (1..5) — STUCK is never acceptable, so every
// generated board is fully solvable by logic alone. Random digging yields
// mostly easy boards even at high clue counts, so harder tiers rely on the
// retry loop keeping the closest-to-ideal solved board.
const DIFFICULTY_TARGETS: Record<string, DifficultyTarget> = {
  beginner: { removeTarget: 38, min: 1, max: 1, ideal: 1 },
  easy: { removeTarget: 44, min: 1, max: 2, ideal: 1 },
  medium: { removeTarget: 50, min: 2, max: 3, ideal: 2 },
  hard: { removeTarget: 56, min: 3, max: 4, ideal: 3 },
  expert: { removeTarget: 58, min: 4, max: 5, ideal: 4 },
  master: { removeTarget: 60, min: 4, max: 5, ideal: 5 },
};

/**
 * Generate a puzzle matching the requested difficulty. Always returns a board
 * that is fully solvable by logic (never STUCK): the first attempt whose grade
 * lands in [min, max] wins; otherwise the closest-to-ideal SOLVED board seen is
 * returned, so difficulty degrades gracefully rather than ever shipping a
 * guess-only puzzle.
 */
export function generateGradedPuzzle(difficulty: string, rng: Rng = Math.random, maxAttempts = 60): GradedPuzzle {
  const target = DIFFICULTY_TARGETS[difficulty] ?? { removeTarget: 42, min: 1 as Grade, max: STUCK, ideal: 3 as Grade };
  const removeTarget = target.removeTarget;

  let best: GradedPuzzle | null = null;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const gp = generatePuzzle(removeTarget, rng);
    const grade = gradePuzzle(gp.puzzle);
    const graded: GradedPuzzle = { ...gp, puzzle: cloneGrid(gp.puzzle), grade };
    if (grade >= target.min && grade <= target.max) return graded;
    // Only solved boards (grade < STUCK) are eligible fallbacks.
    if (grade < STUCK) {
      const dist = Math.abs(grade - target.ideal);
      if (dist < bestDist) {
        bestDist = dist;
        best = graded;
      }
    }
  }

  if (best) return best;

  // No solved board appeared (pathological for deep digs). Fall back to a
  // shallow dig, which is virtually always singles-solvable, and keep digging
  // until one grades as solvable so we never return a STUCK board.
  for (;;) {
    const gp = generatePuzzle(30, rng);
    const grade = gradePuzzle(gp.puzzle);
    if (grade < STUCK) return { ...gp, puzzle: cloneGrid(gp.puzzle), grade };
  }
}
