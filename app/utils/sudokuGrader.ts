import type { Grid, Variant } from "../types/sudoku";

import { cloneGrid, generatePuzzle, type Rng, type GeneratedPuzzle } from "./sudokuCore";

// Logical solver used to grade puzzles by the hardest technique required,
// instead of guessing difficulty from clue count alone.
//
// Grade tiers:
//   1 — singles only (naked/hidden single)
//   2 — pairs: naked/hidden pair, pointing, claiming
//   3 — naked/hidden triple, X-Wing
//   4 — naked/hidden quad, Swordfish, Skyscraper, 2-String Kite, Empty Rectangle,
//       Finned X-Wing, Unique Rectangle, XY-Wing, W-Wing
//   5 — Jellyfish, Finned Swordfish, XYZ-Wing, Simple Coloring, BUG+1, XY-Chain

// 1..5 = hardest technique tier required to fully solve.
// STUCK = no implemented technique makes progress (needs guessing / a technique
// we don't model). STUCK puzzles are never accepted for generated games — that
// guarantees the hint engine (a superset of these techniques) can always find a
// real move and never has to fall back to revealing the answer.
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;
export const STUCK: Grade = 6;

const bit = (v: number) => 1 << (v - 1);
const ALL_MASK = 0x1ff;

function popcount(x: number): number {
  let count = 0;
  while (x) {
    x &= x - 1;
    count++;
  }
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

// X-Sudoku adds the two long diagonals as units (main r = c, then anti r + c = 8): more units for
// singles, subsets and box-diagonal intersections, and more peers for every technique that asks
// whether two cells see each other. Extra constraints never undo a sound deduction.
const DIAGS: number[][] = [
  Array.from({ length: 9 }, (_, i) => i * 10),
  Array.from({ length: 9 }, (_, i) => i * 9 + 8 - i),
];
const X_UNITS = [...ALL_UNITS, ...DIAGS];
const X_PEERS: number[][] = PEERS.map((peers, i) => {
  const set = new Set(peers);
  for (const d of DIAGS) if (d.includes(i)) for (const j of d) if (j !== i) set.add(j);
  return [...set];
});

function* combos(items: number[], k: number, start = 0, acc: number[] = []): Generator<number[]> {
  if (acc.length === k) {
    yield [...acc];
    return;
  }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i]!);
    yield* combos(items, k, i + 1, acc);
    acc.pop();
  }
}

interface SolveState {
  board: number[]; // 81 cells, 0 = empty
  cands: number[]; // candidate bitmask per cell, 0 for filled
  x: boolean; // X-Sudoku
  units: number[][]; // every unit, the diagonals last in X
  peers: number[][];
}

function initState(puzzle: Grid, variant: Variant = "classic"): SolveState {
  const x = variant === "x";
  const peers = x ? X_PEERS : PEERS;
  const board = Array.from({ length: 81 }, () => 0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) board[r * 9 + c] = puzzle[r]![c]!;
  const cands = Array.from({ length: 81 }, () => 0);
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    let mask = ALL_MASK;
    for (const p of peers[i]!) {
      if (board[p] !== 0) mask &= ~bit(board[p]!);
    }
    cands[i] = mask;
  }
  return { board, cands, x, units: x ? X_UNITS : ALL_UNITS, peers };
}

function place(s: SolveState, i: number, v: number): void {
  s.board[i] = v;
  s.cands[i] = 0;
  for (const p of s.peers[i]!) s.cands[p]! &= ~bit(v);
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
  for (const unit of s.units) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      let only = -1;
      let count = 0;
      for (const i of unit) {
        if (s.board[i] === 0 && s.cands[i]! & b) {
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
      const cells = box.filter((i) => s.board[i] === 0 && s.cands[i]! & b);
      if (cells.length < 2) continue;
      const rows = new Set(cells.map((i) => Math.floor(i / 9)));
      const cols = new Set(cells.map((i) => i % 9));
      if (rows.size === 1) {
        const r = [...rows][0]!;
        for (const i of ROWS[r]!) {
          if (!box.includes(i) && s.cands[i]! & b) {
            s.cands[i]! &= ~b;
            changed = true;
          }
        }
      }
      if (cols.size === 1) {
        const c = [...cols][0]!;
        for (const i of COLS[c]!) {
          if (!box.includes(i) && s.cands[i]! & b) {
            s.cands[i]! &= ~b;
            changed = true;
          }
        }
      }
    }
  }
  // Claiming: digit confined to one box within a row/col → remove from rest of that box
  for (const line of [...ROWS, ...COLS]) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const cells = line.filter((i) => s.board[i] === 0 && s.cands[i]! & b);
      if (cells.length < 2) continue;
      const boxes = new Set(
        cells.map((i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)),
      );
      if (boxes.size === 1) {
        const boxIdx = [...boxes][0]!;
        for (const i of BOXES[boxIdx]!) {
          if (!line.includes(i) && s.cands[i]! & b) {
            s.cands[i]! &= ~b;
            changed = true;
          }
        }
      }
    }
  }
  if (s.x && applyMove(s, findDiagonalBoxMove(s))) changed = true;
  return changed;
}

// --- Naked / hidden subsets of size k ---

function eliminateNakedSubset(s: SolveState, k: number): boolean {
  let changed = false;
  for (const unit of s.units) {
    const empty = unit.filter((i) => s.board[i] === 0 && popcount(s.cands[i]!) <= k);
    if (empty.length < k) continue;
    for (const combo of combos(empty, k)) {
      let union = 0;
      for (const i of combo) union |= s.cands[i]!;
      if (popcount(union) !== k) continue;
      for (const i of unit) {
        if (s.board[i] === 0 && !combo.includes(i) && s.cands[i]! & union) {
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
  for (const unit of s.units) {
    const empty = unit.filter((i) => s.board[i] === 0);
    if (empty.length <= k) continue;
    let present = 0;
    for (const i of empty) present |= s.cands[i]!;
    const digits = maskDigits(present);
    if (digits.length <= k) continue;
    for (const combo of combos(digits, k)) {
      let comboMask = 0;
      for (const v of combo) comboMask |= bit(v);
      const holders = empty.filter((i) => s.cands[i]! & comboMask);
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
  for (const [base, _cover] of [
    [ROWS, COLS],
    [COLS, ROWS],
  ] as const) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const baseSets: { unit: number; positions: number[] }[] = [];
      for (let u = 0; u < 9; u++) {
        const positions = base[u]!.map((i, pos) => ({ i, pos }))
          .filter(({ i }) => s.board[i] === 0 && s.cands[i]! & b)
          .map(({ pos }) => pos);
        if (positions.length >= 2 && positions.length <= k) baseSets.push({ unit: u, positions });
      }
      if (baseSets.length < k) continue;
      for (const combo of combos(
        baseSets.map((_, idx) => idx),
        k,
      )) {
        const cols = new Set<number>();
        for (const idx of combo) for (const p of baseSets[idx]!.positions) cols.add(p);
        if (cols.size !== k) continue;
        const baseUnits = new Set(combo.map((idx) => baseSets[idx]!.unit));
        for (const c of cols) {
          for (let u = 0; u < 9; u++) {
            if (baseUnits.has(u)) continue;
            const i = base[u]![c]!;
            if (s.board[i] === 0 && s.cands[i]! & b) {
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
    const pincers = s.peers[pivot]!.filter(
      (i) =>
        s.board[i] === 0 && popcount(s.cands[i]!) === 2 && s.cands[i]! & pm && s.cands[i]! !== pm,
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
        for (const i of s.peers[pincers[a]!]!) {
          if (i === pivot || i === pincers[b]) continue;
          if (s.board[i] === 0 && s.cands[i]! & z && s.peers[pincers[b]!]!.includes(i)) {
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
    const pincers = s.peers[pivot]!.filter(
      (i) => s.board[i] === 0 && popcount(s.cands[i]!) === 2 && (s.cands[i]! & ~pm) === 0,
    );
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const ma = s.cands[pincers[a]!]!;
        const mb = s.cands[pincers[b]!]!;
        if ((ma | mb) !== pm) continue; // together cover all three digits
        const z = ma & mb; // shared digit, eliminable
        if (popcount(z) !== 1) continue;
        let changed = false;
        for (let i = 0; i < 81; i++) {
          if (i === pivot || i === pincers[a] || i === pincers[b]) continue;
          if (s.board[i] !== 0 || !(s.cands[i]! & z)) continue;
          if (
            s.peers[pivot]!.includes(i) &&
            s.peers[pincers[a]!]!.includes(i) &&
            s.peers[pincers[b]!]!.includes(i)
          ) {
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
  | "naked-single"
  | "hidden-single"
  | "pointing"
  | "box-line"
  | "naked-pair"
  | "hidden-pair"
  | "naked-triple"
  | "hidden-triple"
  | "naked-quad"
  | "hidden-quad"
  | "x-wing"
  | "swordfish"
  | "jellyfish"
  | "xy-wing"
  | "xyz-wing"
  | "skyscraper"
  | "two-string-kite"
  | "empty-rectangle"
  | "unique-rectangle"
  | "simple-coloring"
  | "finned-x-wing"
  | "finned-swordfish"
  | "w-wing"
  | "bug-plus-one"
  | "xy-chain";

export interface CellRC {
  r: number;
  c: number;
}
export interface DigitAt {
  r: number;
  c: number;
  num: number;
}

export interface SolveMove {
  technique: TechniqueId;
  tier: Grade;
  placement?: DigitAt; // present for single techniques
  eliminations: DigitAt[]; // candidates removed (elimination techniques)
  triggers: CellRC[]; // the pattern cells that justify the move
  digits: number[]; // the digit(s) the technique is about
  unit?: BoardUnit["kind"]; // a hidden single: the kind of unit it is the only spot in
}

const rc = (i: number): CellRC => ({ r: Math.floor(i / 9), c: i % 9 });
const idx = (r: number, c: number) => r * 9 + c;

function findNakedSingleMove(s: SolveState): SolveMove | null {
  for (let i = 0; i < 81; i++) {
    if (s.board[i] === 0 && popcount(s.cands[i]!) === 1) {
      const num = maskDigits(s.cands[i]!)[0]!;
      const triggers = s.peers[i]!.filter((p) => s.board[p] !== 0).map(rc);
      return {
        technique: "naked-single",
        tier: 1,
        placement: { ...rc(i), num },
        eliminations: [],
        triggers,
        digits: [num],
      };
    }
  }
  return null;
}

function findHiddenSingleMove(s: SolveState): SolveMove | null {
  for (const [u, unit] of s.units.entries()) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      let only = -1;
      let count = 0;
      for (const i of unit) {
        if (s.board[i] === 0 && s.cands[i]! & b) {
          only = i;
          if (++count > 1) break;
        }
      }
      if (count === 1) {
        const triggers = unit.filter((i) => i !== only && s.board[i] !== 0).map(rc);
        return {
          technique: "hidden-single",
          tier: 1,
          placement: { ...rc(only), num: v },
          eliminations: [],
          triggers,
          digits: [v],
          unit: u < 9 ? "row" : u < 18 ? "col" : u < 27 ? "box" : u === 27 ? "diag" : "anti",
        };
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
      const cells = box.filter((i) => s.board[i] === 0 && s.cands[i]! & b);
      if (cells.length < 2) continue;
      const rows = new Set(cells.map((i) => Math.floor(i / 9)));
      const cols = new Set(cells.map((i) => i % 9));
      const line =
        rows.size === 1 ? ROWS[[...rows][0]!]! : cols.size === 1 ? COLS[[...cols][0]!]! : null;
      if (!line) continue;
      const elims = line.filter((i) => !box.includes(i) && s.board[i] === 0 && s.cands[i]! & b);
      if (elims.length) {
        return {
          technique: "pointing",
          tier: 2,
          eliminations: elims.map((i) => Object.assign(rc(i), { num: v })),
          triggers: cells.map(rc),
          digits: [v],
        };
      }
    }
  }
  // Claiming: digit confined to one box within a row/col → clear it from the box
  for (const lineSet of [...ROWS, ...COLS]) {
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const cells = lineSet.filter((i) => s.board[i] === 0 && s.cands[i]! & b);
      if (cells.length < 2) continue;
      const boxes = new Set(
        cells.map((i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)),
      );
      if (boxes.size !== 1) continue;
      const box = BOXES[[...boxes][0]!]!;
      const elims = box.filter((i) => !lineSet.includes(i) && s.board[i] === 0 && s.cands[i]! & b);
      if (elims.length) {
        return {
          technique: "box-line",
          tier: 2,
          eliminations: elims.map((i) => Object.assign(rc(i), { num: v })),
          triggers: cells.map(rc),
          digits: [v],
        };
      }
    }
  }
  return s.x ? findDiagonalBoxMove(s) : null;
}

// X-Sudoku: a diagonal crosses three boxes in three cells each, and the same two moves work
// there. A row or column meets a diagonal in one cell only, which is a hidden single's business.
function findDiagonalBoxMove(s: SolveState): SolveMove | null {
  for (const diag of DIAGS) {
    for (const box of BOXES) {
      const shared = box.filter((i) => diag.includes(i));
      if (!shared.length) continue;
      for (let v = 1; v <= 9; v++) {
        const has = (i: number) => s.board[i] === 0 && !!(s.cands[i]! & bit(v));
        for (const [technique, from, to] of [
          ["pointing", box, diag],
          ["box-line", diag, box],
        ] as const) {
          const cells = from.filter(has);
          if (cells.length < 2 || !cells.every((i) => shared.includes(i))) continue;
          const elims = to.filter((i) => !shared.includes(i) && has(i));
          if (elims.length) {
            return {
              technique,
              tier: 2,
              eliminations: elims.map((i) => ({ ...rc(i), num: v })),
              triggers: cells.map(rc),
              digits: [v],
            };
          }
        }
      }
    }
  }
  return null;
}

const NAKED_SUBSET_TECH: Record<number, TechniqueId> = {
  2: "naked-pair",
  3: "naked-triple",
  4: "naked-quad",
};
const HIDDEN_SUBSET_TECH: Record<number, TechniqueId> = {
  2: "hidden-pair",
  3: "hidden-triple",
  4: "hidden-quad",
};
const SUBSET_TIER: Record<number, Grade> = { 2: 2, 3: 3, 4: 4 };

function findNakedSubsetMove(s: SolveState, k: number): SolveMove | null {
  for (const unit of s.units) {
    const empty = unit.filter(
      (i) => s.board[i] === 0 && popcount(s.cands[i]!) <= k && popcount(s.cands[i]!) >= 2,
    );
    if (empty.length < k) continue;
    for (const combo of combos(empty, k)) {
      let union = 0;
      for (const i of combo) union |= s.cands[i]!;
      if (popcount(union) !== k) continue;
      const elims: DigitAt[] = [];
      for (const i of unit) {
        if (s.board[i] === 0 && !combo.includes(i) && s.cands[i]! & union) {
          for (const num of maskDigits(s.cands[i]! & union)) elims.push({ ...rc(i), num });
        }
      }
      if (elims.length) {
        return {
          technique: NAKED_SUBSET_TECH[k]!,
          tier: SUBSET_TIER[k]!,
          eliminations: elims,
          triggers: combo.map(rc),
          digits: maskDigits(union),
        };
      }
    }
  }
  return null;
}

function findHiddenSubsetMove(s: SolveState, k: number): SolveMove | null {
  for (const unit of s.units) {
    const empty = unit.filter((i) => s.board[i] === 0);
    if (empty.length <= k) continue;
    let present = 0;
    for (const i of empty) present |= s.cands[i]!;
    const digits = maskDigits(present);
    if (digits.length <= k) continue;
    for (const combo of combos(digits, k)) {
      let comboMask = 0;
      for (const v of combo) comboMask |= bit(v);
      const holders = empty.filter((i) => s.cands[i]! & comboMask);
      if (holders.length !== k) continue;
      const elims: DigitAt[] = [];
      for (const i of holders) {
        if (s.cands[i]! & ~comboMask) {
          for (const num of maskDigits(s.cands[i]! & ~comboMask)) elims.push({ ...rc(i), num });
        }
      }
      if (elims.length) {
        return {
          technique: HIDDEN_SUBSET_TECH[k]!,
          tier: SUBSET_TIER[k]!,
          eliminations: elims,
          triggers: holders.map(rc),
          digits: combo,
        };
      }
    }
  }
  return null;
}

const FISH_TECH: Record<number, TechniqueId> = { 2: "x-wing", 3: "swordfish", 4: "jellyfish" };
const FISH_TIER: Record<number, Grade> = { 2: 3, 3: 4, 4: 5 };

function findFishMove(s: SolveState, k: number): SolveMove | null {
  for (const [base] of [
    [ROWS, COLS],
    [COLS, ROWS],
  ] as const) {
    const baseIsRow = base === ROWS;
    for (let v = 1; v <= 9; v++) {
      const b = bit(v);
      const baseSets: { unit: number; positions: number[] }[] = [];
      for (let u = 0; u < 9; u++) {
        const positions = base[u]!.map((i, pos) => ({ i, pos }))
          .filter(({ i }) => s.board[i] === 0 && s.cands[i]! & b)
          .map(({ pos }) => pos);
        if (positions.length >= 2 && positions.length <= k) baseSets.push({ unit: u, positions });
      }
      if (baseSets.length < k) continue;
      for (const combo of combos(
        baseSets.map((_, i) => i),
        k,
      )) {
        const lines = new Set<number>();
        for (const ci of combo) for (const p of baseSets[ci]!.positions) lines.add(p);
        if (lines.size !== k) continue;
        const baseUnits = new Set(combo.map((ci) => baseSets[ci]!.unit));
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
            if (s.board[i] === 0 && s.cands[i]! & b) elims.push({ ...rc(i), num: v });
          }
        }
        if (elims.length) {
          return {
            technique: FISH_TECH[k]!,
            tier: FISH_TIER[k]!,
            eliminations: elims,
            triggers,
            digits: [v],
          };
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
    const pincers = s.peers[pivot]!.filter(
      (i) =>
        s.board[i] === 0 && popcount(s.cands[i]!) === 2 && s.cands[i]! & pm && s.cands[i]! !== pm,
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
        for (const i of s.peers[pincers[a]!]!) {
          if (i === pivot || i === pincers[b]) continue;
          if (s.board[i] === 0 && s.cands[i]! & z && s.peers[pincers[b]!]!.includes(i))
            elims.push({ ...rc(i), num: zNum });
        }
        if (elims.length) {
          return {
            technique: "xy-wing",
            tier: 4,
            eliminations: elims,
            triggers: [rc(pivot), rc(pincers[a]!), rc(pincers[b]!)],
            digits: [zNum],
          };
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
    const pincers = s.peers[pivot]!.filter(
      (i) => s.board[i] === 0 && popcount(s.cands[i]!) === 2 && (s.cands[i]! & ~pm) === 0,
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
          if (
            s.peers[pivot]!.includes(i) &&
            s.peers[pincers[a]!]!.includes(i) &&
            s.peers[pincers[b]!]!.includes(i)
          ) {
            elims.push({ ...rc(i), num: zNum });
          }
        }
        if (elims.length) {
          return {
            technique: "xyz-wing",
            tier: 5,
            eliminations: elims,
            triggers: [rc(pivot), rc(pincers[a]!), rc(pincers[b]!)],
            digits: [zNum],
          };
        }
      }
    }
  }
  return null;
}

const sees = (s: SolveState, a: number, b: number) => a !== b && s.peers[a]!.includes(b);
const boxOf = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

/** Every unit where digit v has exactly two candidates: its strong links, as cell pairs. */
function strongLinks(
  s: SolveState,
  v: number,
): { kind: "row" | "col" | "box"; a: number; b: number }[] {
  const b = bit(v);
  const links: { kind: "row" | "col" | "box"; a: number; b: number }[] = [];
  for (const [kind, units] of [
    ["row", ROWS],
    ["col", COLS],
    ["box", BOXES],
  ] as const) {
    for (const unit of units) {
      const cells = unit.filter((i) => s.board[i] === 0 && s.cands[i]! & b);
      if (cells.length === 2) links.push({ kind, a: cells[0]!, b: cells[1]! });
    }
  }
  return links;
}

/** Empty cells holding v that see every cell in `of` (and are none of them). */
function seeingAll(s: SolveState, v: number, of: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (s.board[i] !== 0 || !(s.cands[i]! & bit(v)) || of.includes(i)) continue;
    if (of.every((o) => sees(s, i, o))) out.push(i);
  }
  return out;
}

// --- Skyscraper / 2-String Kite ---
// Two strong links on one digit whose near ends see each other: the near ends can't both be v,
// so one of the far ends is. Any cell seeing both far ends loses v.
//   Skyscraper: two row links (or two column links) whose near ends share a column (row).
//   2-String Kite: a row link and a column link whose near ends share a box.
function findTurbotMove(s: SolveState, kite: boolean): SolveMove | null {
  for (let v = 1; v <= 9; v++) {
    const links = strongLinks(s, v).filter((l) => l.kind !== "box");
    for (let x = 0; x < links.length; x++) {
      for (let y = x + 1; y < links.length; y++) {
        const l1 = links[x]!;
        const l2 = links[y]!;
        if (kite ? l1.kind === l2.kind : l1.kind !== l2.kind) continue;
        for (const [n1, f1] of [
          [l1.a, l1.b],
          [l1.b, l1.a],
        ] as const) {
          for (const [n2, f2] of [
            [l2.a, l2.b],
            [l2.b, l2.a],
          ] as const) {
            if (new Set([n1, f1, n2, f2]).size !== 4) continue;
            if (kite) {
              if (boxOf(n1) !== boxOf(n2) || boxOf(f1) === boxOf(n1) || boxOf(f2) === boxOf(n2))
                continue;
            } else {
              // Near ends on one line across the links, far ends off it (else it's an X-Wing).
              const line =
                l1.kind === "row" ? (i: number) => i % 9 : (i: number) => Math.floor(i / 9);
              if (line(n1) !== line(n2) || line(f1) === line(f2)) continue;
            }
            const elims = seeingAll(s, v, [f1, f2]).filter((i) => i !== n1 && i !== n2);
            if (elims.length) {
              return {
                technique: kite ? "two-string-kite" : "skyscraper",
                tier: 4,
                eliminations: elims.map((i) => ({ ...rc(i), num: v })),
                triggers: [n1, f1, n2, f2].map(rc),
                digits: [v],
              };
            }
          }
        }
      }
    }
  }
  return null;
}

// --- Empty Rectangle ---
// In a box, v's spots all lie on one row r and one column c of it (an L or a cross, not a single
// line). Take a strong link on v in a column outside the box with one end on row r: if the cell
// where the link's other end's row meets column c were v, the link's row-r end would be v too, and
// between them they'd leave the box no spot for v. So that cell loses v. Likewise with a row link
// and one end on column c.
function findEmptyRectangleMove(s: SolveState): SolveMove | null {
  const row = (i: number) => Math.floor(i / 9);
  const col = (i: number) => i % 9;
  const band = (n: number) => Math.floor(n / 3);
  for (let v = 1; v <= 9; v++) {
    const links = strongLinks(s, v).filter((l) => l.kind !== "box");
    for (const [bx, box] of BOXES.entries()) {
      const cells = box.filter((i) => s.board[i] === 0 && s.cands[i]! & bit(v));
      if (cells.length < 2) continue;
      for (const hinge of box) {
        const r = row(hinge);
        const c = col(hinge);
        if (!cells.every((i) => row(i) === r || col(i) === c)) continue;
        if (cells.every((i) => row(i) === r) || cells.every((i) => col(i) === c)) continue;
        for (const l of links) {
          const byCol = l.kind === "col";
          for (const [near, far] of [
            [l.a, l.b],
            [l.b, l.a],
          ] as const) {
            // The near end on the box's row (column), outside the box; the far end off its band.
            const fits = byCol
              ? row(near) === r && band(row(far)) !== band(r)
              : col(near) === c && band(col(far)) !== band(c);
            if (!fits || boxOf(near) === bx) continue;
            const target = byCol ? idx(row(far), c) : idx(r, col(far));
            if (s.board[target] !== 0 || !(s.cands[target]! & bit(v))) continue;
            return {
              technique: "empty-rectangle",
              tier: 4,
              eliminations: [{ ...rc(target), num: v }],
              // The link's ends first (near, far), then the box's cells: patternMarks reads them so.
              triggers: [near, far, ...cells].map(rc),
              digits: [v],
            };
          }
        }
      }
    }
  }
  return null;
}

// --- Unique Rectangle (type 1) ---
// Four cells on two rows, two columns and two boxes. If three hold exactly {x, y}, the fourth
// can't be x or y: that would leave a rectangle that swaps freely, i.e. two solutions.
function findUniqueRectangleMove(s: SolveState): SolveMove | null {
  // X-Sudoku: a diagonal through a corner can forbid the swap, so the argument fails there.
  if (s.x) return null;
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          // Exactly two boxes: the rows share a band or the columns share a stack, not both.
          const sameBand = Math.floor(r1 / 3) === Math.floor(r2 / 3);
          const sameStack = Math.floor(c1 / 3) === Math.floor(c2 / 3);
          if (sameBand === sameStack) continue;
          const corners = [idx(r1, c1), idx(r1, c2), idx(r2, c1), idx(r2, c2)];
          if (corners.some((i) => s.board[i] !== 0)) continue;
          const pairs = corners.filter((i) => popcount(s.cands[i]!) === 2);
          if (pairs.length !== 3) continue;
          const xy = s.cands[pairs[0]!]!;
          if (pairs.some((i) => s.cands[i] !== xy)) continue;
          const odd = corners.find((i) => !pairs.includes(i))!;
          if ((s.cands[odd]! & xy) === 0) continue;
          return {
            technique: "unique-rectangle",
            tier: 4,
            eliminations: maskDigits(s.cands[odd]! & xy).map((num) => ({ ...rc(odd), num })),
            triggers: pairs.map(rc),
            digits: maskDigits(xy),
          };
        }
      }
    }
  }
  return null;
}

// --- Simple Coloring ---
// Follow one digit's strong links into a chain and colour it in two alternating colours: exactly
// one colour is the true one. Two cells of one colour seeing each other make that colour false
// (wrap); a cell outside the chain that sees both colours can't hold the digit (trap).
function findSimpleColoringMove(s: SolveState): SolveMove | null {
  for (let v = 1; v <= 9; v++) {
    const links = strongLinks(s, v);
    const adj = new Map<number, number[]>();
    for (const { a, b } of links) {
      adj.set(a, [...(adj.get(a) ?? []), b]);
      adj.set(b, [...(adj.get(b) ?? []), a]);
    }
    const color = new Map<number, 0 | 1>();
    for (const start of adj.keys()) {
      if (color.has(start)) continue;
      const chain: number[] = [];
      color.set(start, 0);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        chain.push(cur);
        for (const next of adj.get(cur)!) {
          if (color.has(next)) continue;
          color.set(next, color.get(cur) === 0 ? 1 : 0);
          queue.push(next);
        }
      }
      if (chain.length < 4) continue; // shorter chains are pointing/claiming in disguise
      const side = [
        chain.filter((i) => color.get(i) === 0),
        chain.filter((i) => color.get(i) === 1),
      ];
      let elims: number[] = [];
      for (const cells of side) {
        if (cells.some((a) => cells.some((b) => sees(s, a, b)))) elims = cells;
      }
      if (!elims.length) {
        for (let i = 0; i < 81; i++) {
          if (s.board[i] !== 0 || !(s.cands[i]! & bit(v)) || color.has(i)) continue;
          if (side[0]!.some((a) => sees(s, i, a)) && side[1]!.some((b) => sees(s, i, b)))
            elims.push(i);
        }
      }
      if (elims.length) {
        return {
          technique: "simple-coloring",
          tier: 5,
          eliminations: elims.map((i) => ({ ...rc(i), num: v })),
          triggers: chain.filter((i) => !elims.includes(i)).map(rc),
          digits: [v],
        };
      }
    }
  }
  return null;
}

// --- Finned X-Wing / Finned Swordfish (and Sashimi) ---
// A fish on v in k rows (or columns), except for extra candidates, the fin, all in one box.
// If no fin cell is v, the fish is real and clears v from its k cover columns; if one is, v is
// gone from the rest of the fin's box. Cover-column cells inside that box, off the base rows, lose v
// either way. Sashimi (a corner already missing) follows the same logic.
function findFinnedFishMove(s: SolveState, k: 2 | 3): SolveMove | null {
  for (const baseIsRow of [true, false]) {
    const cell = (u: number, p: number) => (baseIsRow ? idx(u, p) : idx(p, u));
    for (let v = 1; v <= 9; v++) {
      const pos = Array.from({ length: 9 }, (_, u) =>
        [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(
          (p) => s.board[cell(u, p)] === 0 && s.cands[cell(u, p)]! & bit(v),
        ),
      );
      const lines = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((u) => pos[u]!.length >= 2);
      const mask = pos.map((ps) => ps.reduce((m, p) => m | (1 << p), 0));
      for (const base of combos(lines, k)) {
        // k columns is a plain fish; fins fit in one box, so at most three more columns, and at
        // most k columns outside the fin's stack. Checked on bitmasks first: this runs often.
        let m = 0;
        for (const u of base) m |= mask[u]!;
        const n = popcount(m);
        if (n <= k || n > k + 3) continue;
        if ([0o7, 0o70, 0o700].every((stack) => popcount(m & ~stack) > k)) continue;
        const union = [...new Set(base.flatMap((u) => pos[u]!))];
        for (const cover of combos(union, k)) {
          let c = 0;
          for (const p of cover) c |= 1 << p;
          if (!base.every((u) => mask[u]! & c)) continue;
          // Fins in one box: in one stack of columns, on base rows of one band.
          const fin = m & ~c;
          if ([0o7, 0o70, 0o700].every((stack) => fin & ~stack)) continue;
          const finRows = base.filter((u) => mask[u]! & fin);
          if (finRows.some((u) => Math.floor(u / 3) !== Math.floor(finRows[0]! / 3))) continue;
          const isCover = (p: number) => (c >> p) & 1;
          const fins = base.flatMap((u) =>
            pos[u]!.filter((p) => !isCover(p)).map((p) => cell(u, p)),
          );
          const finBox = boxOf(fins[0]!);
          const elims: DigitAt[] = [];
          for (const p of cover) {
            for (let u = 0; u < 9; u++) {
              const i = cell(u, p);
              if (base.includes(u) || boxOf(i) !== finBox) continue;
              if (s.board[i] === 0 && s.cands[i]! & bit(v)) elims.push({ ...rc(i), num: v });
            }
          }
          if (elims.length) {
            return {
              technique: k === 2 ? "finned-x-wing" : "finned-swordfish",
              tier: k === 2 ? 4 : 5,
              eliminations: elims,
              triggers: base.flatMap((u) => pos[u]!.map((p) => rc(cell(u, p)))),
              digits: [v],
            };
          }
        }
      }
    }
  }
  return null;
}

// --- W-Wing ---
// Two cells holding only {x, y} that don't see each other, and a strong link on x (a unit where x
// has two spots) with one end seen by each cell. If neither cell were y, both would be x and the
// link would lose x at both ends, so one of them is y: any cell seeing both loses y.
function findWWingMove(s: SolveState): SolveMove | null {
  const bivalue: number[] = [];
  for (let i = 0; i < 81; i++) if (s.board[i] === 0 && popcount(s.cands[i]!) === 2) bivalue.push(i);
  const linksOf: ReturnType<typeof strongLinks>[] = [];
  for (const [a, b] of combos(bivalue, 2) as Iterable<[number, number]>) {
    if (s.cands[a] !== s.cands[b] || sees(s, a, b)) continue;
    for (const x of maskDigits(s.cands[a]!)) {
      const y = maskDigits(s.cands[a]! & ~bit(x))[0]!;
      const elims = seeingAll(s, y, [a, b]);
      if (!elims.length) continue;
      for (const link of (linksOf[x] ??= strongLinks(s, x))) {
        // sees() rules out the link ending on a or b, since a and b don't see each other.
        const ends =
          sees(s, a, link.a) && sees(s, b, link.b)
            ? [link.a, link.b]
            : sees(s, a, link.b) && sees(s, b, link.a)
              ? [link.b, link.a]
              : null;
        if (!ends) continue;
        return {
          technique: "w-wing",
          tier: 4,
          eliminations: elims.map((i) => ({ ...rc(i), num: y })),
          triggers: [a, b, ...ends].map(rc),
          digits: [y],
        };
      }
    }
  }
  return null;
}

// --- BUG+1 (bivalue universal grave + 1) ---
// Every empty cell holds two candidates except one, which holds three. Take away the right one of
// its three and each digit would sit in exactly two cells of every unit that lacks it: a "grave"
// where switching every cell to its other candidate is a second solution. The puzzle has one
// solution, so the cell must be that digit (the one it adds a third copy of in its units).
function findBugPlusOneMove(s: SolveState): SolveMove | null {
  if (s.x) return null; // like the Unique Rectangle: the diagonals can forbid the switch
  let odd = -1;
  for (let i = 0; i < 81; i++) {
    if (s.board[i] !== 0 || popcount(s.cands[i]!) === 2) continue;
    if (popcount(s.cands[i]!) !== 3 || odd !== -1) return null;
    odd = i;
  }
  if (odd === -1) return null;
  for (const v of maskDigits(s.cands[odd]!)) {
    const mask = (i: number) => (i === odd ? s.cands[i]! & ~bit(v) : s.cands[i]!);
    const grave = ALL_UNITS.every((unit) =>
      maskDigits(ALL_MASK).every((d) => {
        const n = unit.filter((i) => s.board[i] === 0 && mask(i) & bit(d)).length;
        return n === 0 || n === 2;
      }),
    );
    if (grave) {
      const rest: number[] = [];
      for (let i = 0; i < 81; i++) if (s.board[i] === 0 && i !== odd) rest.push(i);
      return {
        technique: "bug-plus-one",
        tier: 5,
        placement: { ...rc(odd), num: v },
        eliminations: [],
        triggers: rest.map(rc),
        digits: [v],
      };
    }
  }
  return null;
}

// --- XY-Chain ---
// Cells holding exactly two candidates, each seeing the next and sharing a digit with it. The
// first cell holds z: if it isn't z it's its other digit, so the next cell isn't that digit and is
// its own other one, and so on down the chain. If the last cell's other digit is z, one of the two
// ends is z, and any cell seeing both loses it. Breadth-first from every start, so the shortest
// chain wins; capped at 8 cells for speed. Three cells is an XY-Wing, which is tried first.
const XY_CHAIN_MAX = 8;
function findXYChainMove(s: SolveState): SolveMove | null {
  const bivalue: number[] = [];
  for (let i = 0; i < 81; i++) if (s.board[i] === 0 && popcount(s.cands[i]!) === 2) bivalue.push(i);
  const next = new Map(bivalue.map((i) => [i, bivalue.filter((j) => sees(s, i, j))]));
  const other = (i: number, d: number) => maskDigits(s.cands[i]! & ~bit(d))[0]!;
  let best: SolveMove | null = null;
  for (const start of bivalue) {
    for (const z of maskDigits(s.cands[start]!)) {
      // Each path: its cells, and the digit its last cell must be when the first isn't z.
      let paths = [{ cells: [start], d: other(start, z) }];
      const seen = new Set([`${start}-${paths[0]!.d}`]);
      for (let len = 2; len <= XY_CHAIN_MAX && paths.length; len++) {
        if (best && len >= best.triggers.length) break;
        const grown: typeof paths = [];
        for (const { cells, d } of paths) {
          for (const i of next.get(cells.at(-1)!)!) {
            if (!(s.cands[i]! & bit(d)) || cells.includes(i)) continue;
            const e = other(i, d);
            if (seen.has(`${i}-${e}`)) continue;
            seen.add(`${i}-${e}`);
            const chain = [...cells, i];
            if (e === z && len >= 3) {
              const elims = s.peers[start]!.filter(
                (p) => p !== i && s.board[p] === 0 && s.cands[p]! & bit(z) && sees(s, p, i),
              );
              if (elims.length && (!best || len < best.triggers.length))
                best = {
                  technique: "xy-chain",
                  tier: 5,
                  eliminations: elims.map((p) => ({ ...rc(p), num: z })),
                  // The chain's cells in order, from one z end to the other: patternMarks reads them so.
                  triggers: chain.map(rc),
                  digits: [z],
                };
            }
            grown.push({ cells: chain, d: e });
          }
        }
        paths = grown;
      }
    }
  }
  return best;
}

// Easiest-first dispatch — mirrors the grading tier order.
const FINDERS: ((s: SolveState) => SolveMove | null)[] = [
  findNakedSingleMove,
  findHiddenSingleMove,
  findBoxLineMove,
  (s) => findNakedSubsetMove(s, 2),
  (s) => findHiddenSubsetMove(s, 2),
  (s) => findNakedSubsetMove(s, 3),
  (s) => findHiddenSubsetMove(s, 3),
  (s) => findFishMove(s, 2),
  (s) => findNakedSubsetMove(s, 4),
  (s) => findHiddenSubsetMove(s, 4),
  (s) => findFishMove(s, 3),
  (s) => findTurbotMove(s, false),
  (s) => findTurbotMove(s, true),
  (s) => findFinnedFishMove(s, 2),
  findUniqueRectangleMove,
  findXYWingMove,
  findWWingMove,
  findEmptyRectangleMove,
  (s) => findFishMove(s, 4),
  (s) => findFinnedFishMove(s, 3),
  findXYZWingMove,
  findSimpleColoringMove,
  findBugPlusOneMove,
  findXYChainMove,
];
function findNextMove(s: SolveState): SolveMove | null {
  for (const find of FINDERS) {
    const move = find(s);
    if (move) return move;
  }
  return null;
}

/** Grading runs the structured finders too: apply a found move's placement or eliminations. */
function applyMove(s: SolveState, move: SolveMove | null): boolean {
  if (!move) return false;
  if (move.placement) place(s, idx(move.placement.r, move.placement.c), move.placement.num);
  for (const e of move.eliminations) s.cands[idx(e.r, e.c)]! &= ~bit(e.num);
  return true;
}

function stateWith(board: Grid, eliminations: DigitAt[], variant: Variant): SolveState {
  const s = initState(board, variant);
  for (const e of eliminations) {
    const i = idx(e.r, e.c);
    if (s.board[i] === 0) s.cands[i]! &= ~bit(e.num);
  }
  return s;
}

/**
 * The next logically-justified move for the current board, or null if no
 * implemented technique applies. `appliedEliminations` are candidate removals
 * already shown to the player in earlier hint steps — replayed so an
 * elimination chain progresses to the placement it unlocks.
 */
export function nextHint(
  board: Grid,
  appliedEliminations: DigitAt[] = [],
  variant: Variant = "classic",
): SolveMove | null {
  const s = stateWith(board, appliedEliminations, variant);
  return findNextMove(s);
}

/**
 * Every technique that applies to the board right now, easiest first: what the game's side panel
 * lists, names only. Same candidates as `nextHint`.
 */
// ponytail: one finder covers pointing and box-line and returns the first it meets, so a board
// with both lists only pointing; split findBoxLineMove if that matters.
export function availableTechniques(
  board: Grid,
  appliedEliminations: DigitAt[] = [],
  variant: Variant = "classic",
): TechniqueId[] {
  return [...new Set(movesNow(board, appliedEliminations, variant).map((m) => m.technique))];
}

/** The first move of every kind the finders see on the board, easiest first. */
export function movesNow(
  board: Grid,
  appliedEliminations: DigitAt[] = [],
  variant: Variant = "classic",
): SolveMove[] {
  const s = stateWith(board, appliedEliminations, variant);
  return FINDERS.map((find) => find(s)).filter((m) => m !== null);
}

/**
 * The technique a player just finished by hand: taking pencil mark `removed` out of `notes` (the
 * notes before it goes) was the last removal of a move the finders see on the board those notes
 * show. Removal moves past the singles only: those are the ones worth naming.
 */
// ponytail: each finder reports its first instance only, so a second X-Wing done by hand while
// another stands untouched goes unnamed; collect every instance per finder if that matters.
export function spottedMove(
  board: Grid,
  notes: boolean[][][],
  removed: DigitAt,
  variant: Variant = "classic",
): SolveMove | null {
  const moves = movesNow(board, notesEliminations(board, notes), variant);
  return (
    moves.find(
      (m) =>
        m.tier >= 2 &&
        !m.placement &&
        m.eliminations.length === 1 &&
        m.eliminations[0]!.r === removed.r &&
        m.eliminations[0]!.c === removed.c &&
        m.eliminations[0]!.num === removed.num,
    ) ?? null
  );
}

/**
 * What it took to place `cell` from `board`: the hardest technique the solver used on its way
 * there, or null when it was a single (or the solver got stuck first).
 */
// ponytail: the solver goes easiest-first across the whole board, so a detour it takes elsewhere
// can overstate a placement; replay from the cell's own units if that shows.
export function techniqueFor(
  board: Grid,
  cell: CellRC,
  variant: Variant = "classic",
): TechniqueId | null {
  const s = initState(board, variant);
  let hardest: SolveMove | null = null;
  while (!s.board[idx(cell.r, cell.c)]) {
    const move = findNextMove(s);
    if (!move) return null;
    if (!hardest || move.tier > hardest.tier) hardest = move;
    applyMove(s, move);
  }
  return hardest && hardest.tier > 1 ? hardest.technique : null;
}

/**
 * What a player's pencil marks rule out: in an empty cell with notes, every digit they don't show
 * (a cell without notes rules out nothing). For `availableTechniques`, so its list matches the
 * board the player sees; never fed to hints, which don't take a note's gap as a deduction.
 */
export function notesEliminations(board: Grid, notes: boolean[][][]): DigitAt[] {
  const out: DigitAt[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const n = notes[r]![c]!;
      if (board[r]![c] || !n.some(Boolean)) continue;
      for (let num = 1; num <= 9; num++) if (!n[num]) out.push({ r, c, num });
    }
  }
  return out;
}

/**
 * Every empty cell in an order where each is a naked or hidden single at its turn, or null when
 * singles run dry first. Behind the Finish button: it only finishes what logic plainly forces.
 */
export function singlesPath(board: Grid, variant: Variant = "classic"): DigitAt[] | null {
  const b = cloneGrid(board);
  const path: DigitAt[] = [];
  while (b.some((row) => row.includes(0))) {
    const move = nextHint(b, [], variant); // tries singles first, so anything else means they ran dry
    if (!move?.placement || move.tier !== 1) return null;
    path.push(move.placement);
    b[move.placement.r]![move.placement.c] = move.placement.num;
  }
  return path;
}

/** A row, column or box (or in X-Sudoku a diagonal: main r = c, anti r + c = 8), named by any of its cells. */
export interface BoardUnit extends CellRC {
  kind: "row" | "col" | "box" | "diag" | "anti";
}

/**
 * Where a move's pattern lives, for a nudge: the one row, column or box holding all its cells,
 * else (a single, a fish, a wing) the box the move acts in.
 */
export function patternUnit(move: SolveMove, variant: Variant = "classic"): BoardUnit {
  const act = move.placement ?? move.eliminations[0] ?? move.triggers[0] ?? { r: 0, c: 0 };
  if (move.unit) return { kind: move.unit, r: act.r, c: act.c };
  const cells: CellRC[] = [...move.triggers, ...move.eliminations, act];
  const x = variant === "x"; // a classic pattern may lie on a diagonal by chance
  const kind = cells.every((p) => p.r === act.r)
    ? "row"
    : cells.every((p) => p.c === act.c)
      ? "col"
      : x && cells.every((p) => p.r === p.c)
        ? "diag"
        : x && cells.every((p) => p.r + p.c === 8)
          ? "anti"
          : "box";
  return { kind, r: act.r, c: act.c };
}

/** A unit's 1-based number: its row, column or box (boxes count across, then down). */
export const unitNumber = (u: BoardUnit): number =>
  u.kind === "row"
    ? u.r + 1
    : u.kind === "col"
      ? u.c + 1
      : Math.floor(u.r / 3) * 3 + Math.floor(u.c / 3) + 1;

interface LogicalSolveResult {
  grade: Grade;
  solved: boolean;
  board: Grid;
}

/** Solve as far as pure logic allows; grade = hardest tier that was needed. */
export function solveLogically(puzzle: Grid, variant: Variant = "classic"): LogicalSolveResult {
  const s = initState(puzzle, variant);
  let grade: Grade = 1;

  const tiers: { tier: Grade; run: () => boolean }[] = [
    { tier: 1, run: () => placeNakedSingles(s) || placeHiddenSingles(s) },
    {
      tier: 2,
      run: () => eliminateBoxLine(s) || eliminateNakedSubset(s, 2) || eliminateHiddenSubset(s, 2),
    },
    {
      tier: 3,
      run: () => eliminateNakedSubset(s, 3) || eliminateHiddenSubset(s, 3) || eliminateFish(s, 2),
    },
    {
      tier: 4,
      run: () =>
        eliminateNakedSubset(s, 4) ||
        eliminateHiddenSubset(s, 4) ||
        eliminateFish(s, 3) ||
        applyMove(s, findTurbotMove(s, false)) ||
        applyMove(s, findTurbotMove(s, true)) ||
        applyMove(s, findFinnedFishMove(s, 2)) ||
        applyMove(s, findUniqueRectangleMove(s)) ||
        eliminateXYWing(s) ||
        applyMove(s, findWWingMove(s)) ||
        applyMove(s, findEmptyRectangleMove(s)),
    },
    {
      tier: 5,
      run: () =>
        eliminateFish(s, 4) ||
        applyMove(s, findFinnedFishMove(s, 3)) ||
        eliminateXYZWing(s) ||
        applyMove(s, findSimpleColoringMove(s)) ||
        applyMove(s, findBugPlusOneMove(s)) ||
        applyMove(s, findXYChainMove(s)),
    },
  ];

  outer: while (s.board.some((v) => v === 0)) {
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
  return { grade, solved: s.board.every((v) => v !== 0), board };
}

export function gradePuzzle(puzzle: Grid, variant: Variant = "classic"): Grade {
  return solveLogically(puzzle, variant).grade;
}

interface GradedPuzzle extends GeneratedPuzzle {
  grade: Grade;
}

interface DifficultyTarget {
  removeTarget: number;
  min: Grade; // lowest acceptable tier (inclusive)
  max: Grade; // highest acceptable tier (inclusive)
  ideal: Grade; // preferred tier; closest-to-ideal solved board is the fallback
  attempts?: number; // digs to try before falling back (default 60)
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
  // Only ~8% of 60-cell digs grade 5 (1.2% before XY-Chain), so Master digs longer to find one.
  master: { removeTarget: 60, min: 5, max: 5, ideal: 5, attempts: 150 },
};
// X-Sudoku: the diagonals give more away, so the same tiers come from different digs, and it
// grades differently: tier 3 almost never decides a board (Hard is mostly tier 4) and STUCK is
// common. 300 X digs of 58 cells graded 1/2/3/4/5/STUCK 28/10/0/16/7/40%. Master takes ~60 ms.
const X_TARGETS: Record<string, DifficultyTarget> = {
  beginner: { removeTarget: 46, min: 1, max: 1, ideal: 1 },
  easy: { removeTarget: 52, min: 1, max: 2, ideal: 1 },
  medium: { removeTarget: 56, min: 2, max: 3, ideal: 2 },
  hard: { removeTarget: 56, min: 3, max: 4, ideal: 3 },
  expert: { removeTarget: 58, min: 4, max: 5, ideal: 4 },
  master: { removeTarget: 58, min: 5, max: 5, ideal: 5, attempts: 150 },
};

/**
 * Generate a puzzle matching the requested difficulty. Always returns a board
 * that is fully solvable by logic (never STUCK): the first attempt whose grade
 * lands in [min, max] wins; otherwise the closest-to-ideal SOLVED board seen is
 * returned, so difficulty degrades gracefully rather than ever shipping a
 * guess-only puzzle.
 */
export function generateGradedPuzzle(
  difficulty: string,
  rng: Rng = Math.random,
  maxAttempts?: number,
  variant: Variant = "classic",
): GradedPuzzle {
  const target = (variant === "x" ? X_TARGETS : DIFFICULTY_TARGETS)[difficulty] ?? {
    removeTarget: 42,
    min: 1 as Grade,
    max: STUCK,
    ideal: 3 as Grade,
  };
  const removeTarget = target.removeTarget;
  maxAttempts ??= target.attempts ?? 60;

  let best: GradedPuzzle | null = null;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const gp = generatePuzzle(removeTarget, rng, variant);
    const grade = gradePuzzle(gp.puzzle, variant);
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
    const gp = generatePuzzle(30, rng, variant);
    const grade = gradePuzzle(gp.puzzle, variant);
    if (grade < STUCK) return { ...gp, puzzle: cloneGrid(gp.puzzle), grade };
  }
}

/**
 * Every technique the logical solver needs to finish `puzzle`, easiest-first
 * (so a technique appears only if the easier ones ran dry before it), or null
 * when logic alone can't solve the board.
 */
export function techniquesRequired(
  puzzle: Grid,
  variant: Variant = "classic",
): Set<TechniqueId> | null {
  const board = cloneGrid(puzzle);
  const elims: DigitAt[] = [];
  const used = new Set<TechniqueId>();
  // 81 cells; eliminations add a handful of steps each, so this cap is never the limiter.
  for (let step = 0; step < 600; step++) {
    if (board.every((row) => row.every((v) => v !== 0))) return used;
    const move = nextHint(board, elims, variant);
    if (!move) return null;
    used.add(move.technique);
    if (move.placement) board[move.placement.r]![move.placement.c] = move.placement.num;
    else elims.push(...move.eliminations);
  }
  return null;
}

// findNextMove's dispatch order, easiest first (pointing and box-line share one finder).
// `satisfies` makes tsc fail when a TechniqueId is added without a rank here.
const SOLVER_RANK = {
  "naked-single": 0,
  "hidden-single": 1,
  pointing: 2,
  "box-line": 3,
  "naked-pair": 4,
  "hidden-pair": 5,
  "naked-triple": 6,
  "hidden-triple": 7,
  "x-wing": 8,
  "naked-quad": 9,
  "hidden-quad": 10,
  swordfish: 11,
  skyscraper: 12,
  "two-string-kite": 13,
  "finned-x-wing": 14,
  "unique-rectangle": 15,
  "xy-wing": 16,
  "w-wing": 17,
  "empty-rectangle": 18,
  jellyfish: 19,
  "finned-swordfish": 20,
  "xyz-wing": 21,
  "simple-coloring": 22,
  "bug-plus-one": 23,
  "xy-chain": 24,
} satisfies Record<TechniqueId, number>;

/**
 * The distinct techniques `puzzle`'s givens need, hardest first, for the win screen. Singles are
 * left out unless nothing harder was needed; empty when logic alone can't finish the board.
 */
export function neededTechniques(puzzle: Grid, variant: Variant = "classic"): TechniqueId[] {
  const used = techniquesRequired(puzzle, variant);
  if (!used) return [];
  const all = [...used].toSorted((a, b) => SOLVER_RANK[b] - SOLVER_RANK[a]);
  const hard = all.filter((id) => id !== "naked-single" && id !== "hidden-single");
  return hard.length ? hard : all;
}
