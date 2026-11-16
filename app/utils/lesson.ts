// Guided technique lessons: the moment in a real puzzle where a technique is the next logical
// move, with what the player has to find and do there. Pure; unit-tested in tests/lesson.test.ts.
//
// The solver tries the easiest technique first, so at the lesson's position nothing simpler
// applies: the technique is genuinely the way forward, not just one of several.

import type { Grid, NotesGrid } from "../types/sudoku";

import { ACADEMY_EXAMPLES } from "./academyExamples";
import { generatePracticePuzzle } from "./practice";
import { RARE_IN_PUZZLES } from "./progression";
import { cloneGrid, getGridCandidates, type Rng } from "./sudokuCore";
import {
  nextHint,
  type BoardUnit,
  type CellRC,
  type DigitAt,
  type SolveMove,
  type TechniqueId,
} from "./sudokuGrader";

export interface Lesson {
  technique: TechniqueId;
  /** The position; every filled cell is fixed. */
  board: Grid;
  /** Pencil marks for every empty cell: its candidates, less what earlier steps ruled out. */
  notes: number[][][];
  /** Step 1: the cells to find (for a placement, the cell it fills). */
  pattern: CellRC[];
  /** Step 2: the digit to place, or else the pencil marks to remove. */
  placement: DigitAt | null;
  eliminations: DigitAt[];
  digits: number[];
  /** The one row, column or box to look in, when the pattern sits in one. */
  unit: BoardUnit | null;
  move: SolveMove;
}

/** The lesson's pencil marks as a board's NotesGrid. */
export const notesGrid = (L: Lesson): NotesGrid =>
  L.notes.map((row) => row.map((ns) => Array.from({ length: 10 }, (_, n) => ns.includes(n))));

type Kind = BoardUnit["kind"];
const inUnit = (kind: Kind, a: CellRC, p: CellRC) =>
  kind === "row"
    ? a.r === p.r
    : kind === "col"
      ? a.c === p.c
      : Math.floor(a.r / 3) === Math.floor(p.r / 3) && Math.floor(a.c / 3) === Math.floor(p.c / 3);
const ALL_CELLS: CellRC[] = Array.from({ length: 81 }, (_, i) => ({
  r: Math.floor(i / 9),
  c: i % 9,
}));

/** Where to look, for the techniques whose pattern lives in one unit. */
const UNIT_KINDS: Partial<Record<TechniqueId, Kind[]>> = {
  "naked-single": ["box", "row", "col"],
  pointing: ["box"],
  "box-line": ["row", "col"],
  "naked-pair": ["row", "col", "box"],
  "naked-triple": ["row", "col", "box"],
  "naked-quad": ["row", "col", "box"],
  "hidden-pair": ["row", "col", "box"],
  "hidden-triple": ["row", "col", "box"],
  "hidden-quad": ["row", "col", "box"],
};

function unitOf(move: SolveMove, pattern: CellRC[], notes: number[][][]): BoardUnit | null {
  const at = pattern[0]!;
  if (move.technique === "hidden-single") return { kind: move.unit!, r: at.r, c: at.c };
  const kinds = UNIT_KINDS[move.technique];
  if (!kinds) return null;
  const tech = move.technique;
  const kind = kinds.find((k) => {
    const cells = ALL_CELLS.filter((p) => inUnit(k, at, p));
    const isPattern = (p: CellRC) => pattern.some((q) => q.r === p.r && q.c === p.c);
    // A naked single: no other cell of the unit is down to one candidate, so "the cell" is clear.
    if (tech === "naked-single")
      return cells.every((p) => isPattern(p) || notes[p.r]![p.c]!.length !== 1);
    if (!pattern.every((p) => inUnit(k, at, p))) return false;
    // A naked subset clears the rest of this unit; a hidden one holds its digits only here.
    if (tech.startsWith("naked")) return move.eliminations.every((p) => inUnit(k, at, p));
    return cells.every(
      (p) => isPattern(p) || !move.digits.some((d) => notes[p.r]![p.c]!.includes(d)),
    );
  });
  return kind ? { kind, r: at.r, c: at.c } : null;
}

const uniqueCells = (cells: CellRC[]) =>
  cells.filter((p, i) => cells.findIndex((q) => q.r === p.r && q.c === p.c) === i);

/** The lesson for `move`, found on `board` after the removals in `elims`. */
function lessonAt(board: Grid, elims: DigitAt[], move: SolveMove): Lesson {
  const notes = getGridCandidates(board).map((row, r) =>
    row.map((cands, c) =>
      cands.filter((n) => !elims.some((e) => e.r === r && e.c === c && e.num === n)),
    ),
  );
  // A single's (or BUG+1's) "pattern" in the solver is every filled cell around it; the player
  // finds the cell itself.
  const p = move.placement;
  const pattern = p
    ? [{ r: p.r, c: p.c }]
    : uniqueCells(move.triggers.map(({ r, c }) => ({ r, c })));
  return {
    technique: move.technique,
    board: cloneGrid(board),
    notes,
    pattern,
    placement: p ?? null,
    eliminations: move.eliminations,
    digits: move.digits,
    unit: unitOf(move, pattern, notes),
    move,
  };
}

/**
 * Replays the solver over `puzzle` to where `technique` is next. Prefers an occurrence that sits
 * in one named unit, so "look in box 4" points at exactly one instance.
 */
export function lessonFromPuzzle(puzzle: Grid, technique: TechniqueId): Lesson | null {
  const board = cloneGrid(puzzle);
  const elims: DigitAt[] = [];
  let first: Lesson | null = null;
  for (let step = 0; step < 600; step++) {
    const move = nextHint(board, elims);
    if (!move) break;
    if (move.technique === technique) {
      const lesson = lessonAt(board, elims, move);
      if (lesson.unit || !UNIT_KINDS[technique]) return lesson;
      first ??= lesson;
    }
    if (move.placement) board[move.placement.r]![move.placement.c] = move.placement.num;
    else elims.push(...move.eliminations);
  }
  return first;
}

/** The Academy's worked example as a lesson: its pencil marks are the removals made so far. */
export function lessonFromExample(technique: TechniqueId): Lesson | null {
  const ex = ACADEMY_EXAMPLES[technique];
  if (!ex) return null;
  const cands = getGridCandidates(ex.board);
  const elims = Object.entries(ex.notes).flatMap(([key, kept]) => {
    const [r, c] = key.split("-").map(Number) as [number, number];
    return cands[r]![c]!.filter((n) => !kept.includes(n)).map((num) => ({ r, c, num }));
  });
  const replayed = nextHint(ex.board, elims);
  if (replayed?.technique === technique) return lessonAt(ex.board, elims, replayed);
  // The example only notes the pattern's cells, so elsewhere the solver may see something simpler
  // first: take the move as harvested. A hidden subset clears the other digits from its cells;
  // every other technique clears its digits from the cells it eliminates in.
  const kept = (r: number, c: number) => ex.notes[`${r}-${c}`] ?? cands[r]![c]!;
  const hidden = technique.startsWith("hidden");
  const move: SolveMove = {
    technique,
    tier: 4,
    placement: ex.placement ?? undefined,
    eliminations: ex.elimination.flatMap(({ r, c }) =>
      kept(r, c)
        .filter((n) => ex.digits.includes(n) !== hidden)
        .map((num) => ({ r, c, num })),
    ),
    triggers: ex.trigger,
    digits: ex.digits,
  };
  return lessonAt(ex.board, elims, move);
}

/** A fresh position from a puzzle that needs the technique, else the Academy's example. */
export async function generateLesson(
  technique: TechniqueId,
  rng: Rng = Math.random,
): Promise<Lesson> {
  const p = await generatePracticePuzzle(technique, rng);
  const lesson =
    (p.kind === "puzzle" ? lessonFromPuzzle(p.board, technique) : null) ??
    lessonFromExample(technique);
  if (!lesson) throw new Error(`No lesson for technique: ${technique}`);
  // The example is one fixed position; a symmetry of it keeps "Another example" from repeating.
  return p.kind === "puzzle" ? lesson : shuffleLesson(lesson, rng);
}

/**
 * A position for the Spot it drill: as generateLesson, but the techniques a puzzle search almost
 * never finds go straight to a shuffle of the Academy example instead of searching first.
 */
export async function quickLesson(technique: TechniqueId, rng: Rng = Math.random): Promise<Lesson> {
  const example = RARE_IN_PUZZLES.has(technique) ? lessonFromExample(technique) : null;
  return example ? shuffleLesson(example, rng) : generateLesson(technique, rng);
}

// ---- Variations ----------------------------------------------------------------------------

/**
 * The same lesson under a sudoku symmetry: digits relabelled, maybe transposed, the bands and the
 * rows (columns) inside them reordered. Every deduction survives, so a technique whose only
 * source is the Academy's one example still gets a fresh-looking position each time.
 */
export function shuffleLesson(L: Lesson, rng: Rng = Math.random): Lesson {
  const shuffle = <T>(xs: T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  // to[old line] = new line: bands move as blocks, lines move inside their band.
  const lineMap = () => {
    const to: number[] = [];
    shuffle([0, 1, 2])
      .flatMap((b) => shuffle([0, 1, 2]).map((i) => b * 3 + i))
      .forEach((old, k) => (to[old] = k));
    return to;
  };
  const R = lineMap();
  const C = lineMap();
  const sigma = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])];
  const flip = rng() < 0.5;
  const cell = ({ r, c }: CellRC): CellRC => {
    const [a, b] = flip ? [c, r] : [r, c];
    return { r: R[a]!, c: C[b]! };
  };
  const at = (x: DigitAt): DigitAt => ({ ...cell(x), num: sigma[x.num]! });
  const kind = (k: Kind): Kind => (!flip || k === "box" ? k : k === "row" ? "col" : "row");
  const board: Grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
  const notes: number[][][] = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const p = cell({ r, c });
      board[p.r]![p.c] = sigma[L.board[r]![c]!]!;
      notes[p.r]![p.c] = L.notes[r]![c]!.map((d) => sigma[d]!).toSorted((x, y) => x - y);
    }
  const m = L.move;
  return {
    technique: L.technique,
    board,
    notes,
    pattern: L.pattern.map(cell),
    placement: L.placement && at(L.placement),
    eliminations: L.eliminations.map(at),
    digits: L.digits.map((d) => sigma[d]!),
    unit: L.unit && { kind: kind(L.unit.kind), ...cell(L.unit) },
    move: {
      ...m,
      placement: m.placement && at(m.placement),
      eliminations: m.eliminations.map(at),
      triggers: m.triggers.map(cell),
      digits: m.digits.map((d) => sigma[d]!),
      unit: m.unit && kind(m.unit),
    },
  };
}

// ---- Step 1: what counts, and why a cell doesn't --------------------------------------------

/** One way to finish step 1: the cells to find, and the marks step 2 then removes. */
export interface Instance {
  pattern: CellRC[];
  eliminations: DigitAt[];
}

const FISH_SIZE: Partial<Record<TechniqueId, number>> = { "x-wing": 2, swordfish: 3, jellyfish: 4 };
const sameCells = (a: CellRC[], b: CellRC[]) =>
  a.length === b.length && a.every((p) => b.some((q) => q.r === p.r && q.c === p.c));

/** Every k-item subset (at most C(9,4) = 126 here). */
function choose<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((x, i) => choose(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]));
}

/**
 * Every pattern step 1 accepts: the lesson's own, plus for a fish any other fish on the same digit
 * with as many cells (the prompt names the digit and the count) that also clears something. A
 * player who spots that one first has found a real one, so it counts.
 */
export function instancesOf(L: Lesson): Instance[] {
  const main = { pattern: L.pattern, eliminations: L.eliminations };
  const k = FISH_SIZE[L.technique];
  if (!k) return [main];
  const d = L.digits[0]!;
  const has = ({ r, c }: CellRC) => L.notes[r]![c]!.includes(d);
  const nine = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const others: Instance[] = [];
  for (const byRow of [true, false]) {
    const at = (u: number, p: number): CellRC => (byRow ? { r: u, c: p } : { r: p, c: u });
    const bases: { u: number; ps: number[] }[] = nine
      .map((u) => ({ u, ps: nine.filter((p) => has(at(u, p))) }))
      .filter((b) => b.ps.length >= 2 && b.ps.length <= k);
    const combos: (typeof bases)[] = choose(bases, k);
    for (const combo of combos) {
      const cover = new Set<number>(combo.flatMap((b) => b.ps));
      if (cover.size !== k) continue;
      const pattern = combo.flatMap((b) => b.ps.map((p) => at(b.u, p)));
      if (pattern.length !== L.pattern.length || sameCells(pattern, L.pattern)) continue;
      const base = new Set(combo.map((b) => b.u));
      const eliminations = [...cover].flatMap((p) =>
        nine.filter((u) => !base.has(u) && has(at(u, p))).map((u) => ({ ...at(u, p), num: d })),
      );
      if (eliminations.length) others.push({ pattern, eliminations });
    }
  }
  return [main, ...others];
}

/** Techniques whose every pattern cell holds the lesson's (first) digit as a pencil mark. */
const ON_DIGIT = new Set<TechniqueId>([
  "hidden-single",
  "pointing",
  "box-line",
  "x-wing",
  "swordfish",
  "jellyfish",
  "skyscraper",
  "two-string-kite",
  "finned-x-wing",
  "simple-coloring",
]);

interface Miss {
  /** An i18n key under lesson.why.*, or lesson.miss when no quick check explains it. */
  key: string;
  params?: Record<string, number>;
}

/**
 * Why a tapped cell isn't part of the pattern, from the cheapest checks that can tell. Each check
 * only fires on a cell that no pattern of this kind could use, so the reason is never wrong.
 */
export function missReason(L: Lesson, { r, c }: CellRC): Miss {
  if (L.board[r]![c]) return { key: "lesson.why.filled" };
  const marks = L.notes[r]![c]!;
  const d = L.digits[0]!;
  const t = L.technique;
  if (t === "naked-single" && marks.length > 1)
    return { key: "lesson.why.manyMarks", params: { n: marks.length } };
  if (ON_DIGIT.has(t) && !marks.includes(d)) return { key: "lesson.why.noDigit", params: { d } };
  const subset = t !== "naked-single" && t !== "hidden-single";
  if (subset && t.startsWith("hidden-") && !marks.some((n) => L.digits.includes(n)))
    return { key: "lesson.why.noneOfDigits" };
  const other = marks.find((n) => !L.digits.includes(n));
  if (subset && t.startsWith("naked-") && other)
    return { key: "lesson.why.otherDigit", params: { d: other } };
  if (L.unit && !inUnit(L.unit.kind, L.unit, { r, c })) return { key: "lesson.why.outside" };
  const k = FISH_SIZE[t];
  if (k) {
    const row = L.notes[r]!.filter((ns) => ns.includes(d)).length;
    const col = L.notes.filter((line) => line[c]!.includes(d)).length;
    if (row > k && col > k) return { key: "lesson.why.fishLines", params: { d, row, col, k } };
  }
  return { key: "lesson.miss" };
}

/** What step 1 makes of a tap: a miss, or the cells found so far and the instance they complete. */
type TapResult = { miss: true } | { miss: false; found: CellRC[]; complete: Instance | null };

/** Step 1's verdict on tapping `cell` with `found` already marked. */
export function tapPattern(instances: Instance[], found: CellRC[], cell: CellRC): TapResult {
  const sofar = [...found, cell];
  const live = instances.filter((i) =>
    sofar.every((f) => i.pattern.some((p) => p.r === f.r && p.c === f.c)),
  );
  if (!live.length) return { miss: true };
  return {
    miss: false,
    found: sofar,
    complete: live.find((i) => i.pattern.length === sofar.length) ?? null,
  };
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** A unit's 1-based number: its row, column or box (boxes count across, then down). */
export const unitNumber = (u: BoardUnit): number =>
  u.kind === "row"
    ? u.r + 1
    : u.kind === "col"
      ? u.c + 1
      : Math.floor(u.r / 3) * 3 + Math.floor(u.c / 3) + 1;

/** "in row 4", "in box 2", or "on this board" when the pattern has no one unit. */
function unitLabel(L: Lesson, t: Translate): string {
  const u = L.unit;
  if (!u) return t("lesson.where.here");
  return t(`lesson.where.${u.kind}`, { n: unitNumber(u) });
}

/** Step 1's prompt: what to look for and where. `digit` renders a digit (or its colour). */
export function findPrompt(L: Lesson, t: Translate, digit: (n: number) => string): string {
  const where = unitLabel(L, t);
  const digits = L.digits.map(digit).join(", ");
  const technique = t(`hint.move.${L.technique}.name`);
  if (L.technique === "naked-single") return t("lesson.find.nakedSingle", { where });
  if (L.technique === "hidden-single") return t("lesson.find.hiddenSingle", { num: digits, where });
  if (L.placement) return t("lesson.find.cell", { technique, where });
  return t("lesson.find.pattern", { technique, digits, where, count: L.pattern.length });
}

/** Why a tap missed, as text: missReason's key with its digits rendered. */
export function missText(
  L: Lesson,
  cell: CellRC,
  t: Translate,
  digit: (n: number) => string,
): string {
  const miss = missReason(L, cell);
  const d = miss.params?.d;
  return t(miss.key, {
    ...miss.params,
    ...(d && { d: digit(d) }),
    where: unitLabel(L, t),
    digits: L.digits.map(digit).join(", "),
  });
}

/**
 * The rows, columns and boxes the pattern works through, for Show me's second stage: the one unit
 * when it has one, else every line or box two of its cells share (a fish's rows and columns, a
 * wing's links), else the box of its only cell.
 */
export function lessonUnits(L: Lesson): BoardUnit[] {
  if (L.unit) return [L.unit];
  const units: BoardUnit[] = [];
  const add = (u: BoardUnit) => {
    if (!units.some((v) => v.kind === u.kind && inUnit(u.kind, u, v))) units.push(u);
  };
  for (const [i, a] of L.pattern.entries())
    for (const b of L.pattern.slice(i + 1)) {
      if (a.r === b.r) add({ kind: "row", ...a });
      else if (a.c === b.c) add({ kind: "col", ...a });
      else if (inUnit("box", a, b)) add({ kind: "box", ...a });
    }
  return units.length ? units : [{ kind: "box", ...L.pattern[0]! }];
}
