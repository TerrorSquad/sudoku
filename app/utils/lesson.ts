// Guided technique lessons: the moment in a real puzzle where a technique is the next logical
// move, with what the player has to find and do there. Pure; unit-tested in tests/lesson.test.ts.
//
// The solver tries the easiest technique first, so at the lesson's position nothing simpler
// applies: the technique is genuinely the way forward, not just one of several.

import type { Grid, NotesGrid } from "../types/sudoku";

import { ACADEMY_EXAMPLES } from "./academyExamples";
import {
  boxOf,
  unitCells,
  colorSets,
  finnedSides,
  fishSides,
  lineKind,
  wordList,
  sees,
  spotsIn,
} from "./explain";
import { generatePracticePuzzle } from "./practice";
import { RARE_IN_PUZZLES, type Level } from "./progression";
import { isStuckPosition, type StuckPosition } from "./review";
import {
  cloneGrid,
  getGridCandidates,
  hasUniqueSolution,
  isValidPlacement,
  solveBoard,
  type Rng,
} from "./sudokuCore";
import {
  nextHint,
  patternCells,
  unitNumber,
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
  const p = move.placement;
  const pattern = patternCells(move);
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
 * in one named unit, so "look in box 4" points at exactly one instance. `made`: removals already
 * made on `puzzle`.
 */
export function lessonFromPuzzle(
  puzzle: Grid,
  technique: TechniqueId,
  made: readonly DigitAt[] = [],
): Lesson | null {
  const board = cloneGrid(puzzle);
  const elims: DigitAt[] = [...made];
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

/**
 * A position the player needed a hint at in a game (review.ts's StuckPosition), replayed to where
 * `technique` is next, as lessonFromPuzzle does. Null when it isn't sound: a board that breaks a
 * rule or hasn't exactly one solution, a removal of a filled cell or of its answer, or no
 * `technique` on the way. It comes from storage, so it may be from an import or another version.
 */
export function lessonFromPosition(p: StuckPosition, technique: TechniqueId): Lesson | null {
  if (!isStuckPosition(p)) return null;
  const board: Grid = Array.from({ length: 9 }, (_, r) =>
    Array.from(p.board.slice(r * 9, r * 9 + 9), Number),
  );
  const clash = board.some((row, r) => row.some((v, c) => v && !isValidPlacement(board, r, c, v)));
  if (clash || !hasUniqueSolution(board)) return null;
  const solution = solveBoard(board)!;
  const elims = (p.elims.match(/.../g) ?? []).map((s) => ({ r: +s[0]!, c: +s[1]!, num: +s[2]! }));
  if (elims.some(({ r, c, num }) => board[r]![c] || solution[r]![c] === num)) return null;
  return lessonFromPuzzle(board, technique, elims);
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

/**
 * A fresh position from a puzzle that needs the technique, else the Academy's example; for a
 * `level`, turned the way that level wants it (turnFor).
 */
export async function generateLesson(
  technique: TechniqueId,
  rng: Rng = Math.random,
  level?: Level,
): Promise<Lesson> {
  const p = await generatePracticePuzzle(technique, rng);
  const lesson =
    (p.kind === "puzzle" ? lessonFromPuzzle(p.board, technique) : null) ??
    lessonFromExample(technique);
  if (!lesson) throw new Error(`No lesson for technique: ${technique}`);
  // The example is one fixed position; a symmetry of it keeps "Another example" from repeating.
  // A puzzle's position is shuffled only when the level wants it the other way round: the same
  // symmetry, transposed (its digits relabelled and its bands reordered as well).
  const turn = turnFor(lesson, level);
  return p.kind === "puzzle" && !turn ? lesson : shuffleLesson(lesson, rng, turn);
}

/**
 * A position for the Spot it drill: as generateLesson, but the techniques a puzzle search almost
 * never finds go straight to a shuffle of the Academy example instead of searching first.
 */
export async function quickLesson(technique: TechniqueId, rng: Rng = Math.random): Promise<Lesson> {
  const example = RARE_IN_PUZZLES.has(technique) ? lessonFromExample(technique) : null;
  return example ? shuffleLesson(example, rng) : generateLesson(technique, rng);
}

// ---- Levels --------------------------------------------------------------------------------

/** Built along rows or columns (lineKind): level 2 is level 1's help, the other way round. */
const ALONG = new Set<TechniqueId>([
  "pointing",
  "box-line",
  "x-wing",
  "swordfish",
  "jellyfish",
  "finned-x-wing",
  "finned-swordfish",
  "skyscraper",
  "empty-rectangle",
]);

/**
 * How much a level's step 1 tells, by family ("marked": the prompt names the rows, columns and
 * boxes to look in, and the board marks them; "named": the prompt names its one unit, as before
 * levels; "digit": only the digit; "none": only the technique):
 *
 *   family                                1             2                     3
 *   built along lines (ALONG)             marked, rows  marked, columns       none
 *   in one unit (singles, subsets)        marked, row   named, column         none
 *   spread out (kite, wings, chains, UR)  marked        digit                 none
 *
 * Rows and columns are where the position has a way round (turnFor); a box stays a box.
 */
export function guideOf(
  technique: TechniqueId,
  level: Level,
): "marked" | "named" | "digit" | "none" {
  if (level === 3) return "none";
  if (level === 1 || ALONG.has(technique)) return "marked";
  return UNIT_KINDS[technique] || technique === "hidden-single" ? "named" : "digit";
}

/**
 * Whether `level` wants `L` transposed: levels 1 and 2 put a pattern built along lines, or sitting
 * in one row or column, on rows, then on columns. Undefined when either way will do.
 */
export function turnFor(L: Lesson, level?: Level): boolean | undefined {
  const way = lineKind(L.move) ?? (L.unit && L.unit.kind !== "box" ? L.unit.kind : null);
  if (!way || !level || level === 3) return undefined;
  return way !== (level === 1 ? "row" : "col");
}

// ---- Variations ----------------------------------------------------------------------------

/**
 * The same lesson under a sudoku symmetry: digits relabelled, maybe transposed, the bands and the
 * rows (columns) inside them reordered. Every deduction survives, so a technique whose only
 * source is the Academy's one example still gets a fresh-looking position each time. `turn`
 * decides the transpose instead of a coin toss.
 */
export function shuffleLesson(L: Lesson, rng: Rng = Math.random, turn?: boolean): Lesson {
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
  const coin = rng() < 0.5; // tossed either way, so a seed deals the same board as before levels
  const flip = turn ?? coin;
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

/** One way to finish step 1: the cells to find, the marks step 2 then removes, and its move. */
export interface Instance {
  pattern: CellRC[];
  eliminations: DigitAt[];
  /** The move it makes: the lesson's own, or one like it on these cells and digits. */
  move: SolveMove;
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
 * Every pattern step 1 accepts: the lesson's own, plus for a fish (or an XY-Chain) any other one on
 * the same digit with as many cells (the prompt names the digit and the count) that also clears
 * something. A player who spots that one first has found a real one, so it counts. Level 3 names
 * neither, so there any instance of the technique on the board counts (anyInstances).
 */
export function instancesOf(L: Lesson, level?: Level): Instance[] {
  const main = { pattern: L.pattern, eliminations: L.eliminations, move: L.move };
  if (level === 3)
    return [main, ...anyInstances(L)].filter(
      (x, i, all) => all.findIndex((y) => sameCells(x.pattern, y.pattern)) === i,
    );
  if (L.technique === "xy-chain") return [main, ...otherXYChains(L)];
  const k = FISH_SIZE[L.technique];
  return k ? [main, ...fishes(L, L.digits[0]!, k, L.pattern.length)] : [main];
}

/** The fish of size k on d (with n cells, when given) that clear something, but the lesson's. */
function fishes(L: Lesson, d: number, k: number, n?: number): Instance[] {
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
      if ((n && pattern.length !== n) || sameCells(pattern, L.pattern)) continue;
      const base = new Set(combo.map((b) => b.u));
      const eliminations = [...cover].flatMap((p) =>
        nine.filter((u) => !base.has(u) && has(at(u, p))).map((u) => ({ ...at(u, p), num: d })),
      );
      const move = { ...L.move, triggers: pattern, eliminations, digits: [d] };
      if (eliminations.length) others.push({ pattern, eliminations, move });
    }
  }
  return others;
}

const SUBSET_SIZE: Partial<Record<TechniqueId, number>> = {
  "naked-pair": 2,
  "naked-triple": 3,
  "naked-quad": 4,
  "hidden-pair": 2,
  "hidden-triple": 3,
  "hidden-quad": 4,
};
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
// Each unit's empty cells: rows, columns, then boxes.
const unitsOf = (L: Lesson) =>
  (["row", "col", "box"] as const).flatMap((kind) =>
    Array.from({ length: 9 }, (_, i) =>
      unitCells(
        kind,
        kind === "row"
          ? { r: i, c: 0 }
          : kind === "col"
            ? { r: 0, c: i }
            : { r: Math.floor(i / 3) * 3, c: (i % 3) * 3 },
      ).filter((p) => !L.board[p.r]![p.c]),
    ).map((cells) => ({ kind, cells })),
  );

/**
 * Every instance of the lesson's technique on its board (as the lesson's own, from its marks),
 * for level 3, where the prompt names no digit, unit or count.
 */
function anyInstances(L: Lesson): Instance[] {
  const t = L.technique;
  const marks = ({ r, c }: CellRC) => L.notes[r]![c]!;
  const spots = (cells: CellRC[], d: number) => cells.filter((p) => marks(p).includes(d));
  const among = (p: CellRC, cells: CellRC[]) => cells.some((q) => q.r === p.r && q.c === p.c);
  const make = (pattern: CellRC[], eliminations: DigitAt[], move: Partial<SolveMove>) => ({
    pattern,
    eliminations,
    move: { ...L.move, placement: undefined, triggers: pattern, eliminations, ...move },
  });
  const units = unitsOf(L);
  const k = FISH_SIZE[t] ?? SUBSET_SIZE[t];
  if (t === "naked-single")
    return ALL_CELLS.filter((p) => !L.board[p.r]![p.c] && marks(p).length === 1).map((p) =>
      make([p], [], { placement: { ...p, num: marks(p)[0]! }, digits: [marks(p)[0]!] }),
    );
  if (t === "hidden-single")
    return units.flatMap(({ kind, cells }) =>
      DIGITS.flatMap((d) => {
        const [p, ...more] = spots(cells, d);
        return p && !more.length
          ? [make([p], [], { placement: { ...p, num: d }, digits: [d], unit: kind })]
          : [];
      }),
    );
  // Pointing: a box's spots on one line clear the rest of it; box-line: a line's in one box, the box.
  if (t === "pointing" || t === "box-line")
    return units
      .filter(({ kind }) => (kind === "box") === (t === "pointing"))
      .flatMap(({ cells }) =>
        DIGITS.flatMap((d) => {
          const s = spots(cells, d);
          // The unit the spots share as well: a line for a box's, the box for a line's.
          const other = (t === "pointing" ? (["row", "col"] as const) : (["box"] as const)).find(
            (u) => s.length >= 2 && s.every((p) => inUnit(u, s[0]!, p)),
          );
          if (!other) return [];
          const eliminations = spots(unitCells(other, s[0]!), d)
            .filter((p) => !among(p, s))
            .map((p) => ({ ...p, num: d }));
          return eliminations.length ? [make(s, eliminations, { digits: [d] })] : [];
        }),
      );
  if (FISH_SIZE[t]) return DIGITS.flatMap((d) => fishes(L, d, k!));
  if (t.startsWith("naked-") && k)
    return units.flatMap(({ cells }) =>
      choose(
        cells.filter((p) => marks(p).length >= 2 && marks(p).length <= k),
        k,
      ).flatMap((cs) => {
        const ds = DIGITS.filter((d) => cs.some((p) => marks(p).includes(d)));
        if (ds.length !== k) return [];
        // Cleared from every unit the cells share.
        const shared = (["row", "col", "box"] as const).filter((u) =>
          cs.every((p) => inUnit(u, cs[0]!, p)),
        );
        const eliminations = ALL_CELLS.filter(
          (p) => !among(p, cs) && shared.some((u) => inUnit(u, cs[0]!, p)),
        ).flatMap((p) =>
          marks(p)
            .filter((n) => ds.includes(n))
            .map((num) => ({ ...p, num })),
        );
        return eliminations.length ? [make(cs, eliminations, { digits: ds })] : [];
      }),
    );
  if (t.startsWith("hidden-") && k)
    return units.flatMap(({ cells }) =>
      choose(
        DIGITS.filter((d) => spots(cells, d).length >= 2 && spots(cells, d).length <= k),
        k,
      ).flatMap((ds) => {
        const cs = uniqueCells(ds.flatMap((d) => spots(cells, d)));
        if (cs.length !== k) return [];
        const eliminations = cs.flatMap((p) =>
          marks(p)
            .filter((n) => !ds.includes(n))
            .map((num) => ({ ...p, num })),
        );
        return eliminations.length ? [make(cs, eliminations, { digits: ds })] : [];
      }),
    );
  // ponytail: wings, chains, colouring, the kite and the uniqueness patterns count only the
  // lesson's own (and an XY-Chain's twins) at level 3; search them like the rest if players find
  // other real ones first.
  return t === "xy-chain" ? otherXYChains(L) : [];
}

/**
 * The other XY-Chains on the lesson's z with as many cells: from a two-mark cell holding z, step to
 * a two-mark cell that sees the last one and holds its other digit, ending on a cell whose other
 * digit is z. Each removes z from the cells (off the chain) that see both ends.
 */
function otherXYChains(L: Lesson): Instance[] {
  const z = L.digits[0]!;
  const marks = ({ r, c }: CellRC) => L.notes[r]![c]!;
  const same = (a: CellRC, b: CellRC) => a.r === b.r && a.c === b.c;
  const bivalue = ALL_CELLS.filter((p) => marks(p).length === 2);
  const out: Instance[] = [];
  const walk = (chain: CellRC[], d: number) => {
    const last = chain.at(-1)!;
    if (chain.length === L.pattern.length) {
      if (d !== z || sameCells(chain, L.pattern) || out.some((i) => sameCells(i.pattern, chain)))
        return;
      const eliminations = ALL_CELLS.filter(
        (p) =>
          marks(p).includes(z) &&
          !chain.some((q) => same(p, q)) &&
          sees(p, chain[0]!) &&
          sees(p, last),
      ).map((p) => ({ ...p, num: z }));
      const move = { ...L.move, triggers: chain, eliminations };
      if (eliminations.length) out.push({ pattern: chain, eliminations, move });
      return;
    }
    for (const p of bivalue)
      if (sees(last, p) && marks(p).includes(d) && !chain.some((q) => same(p, q)))
        walk(
          [...chain, p],
          marks(p).find((n) => n !== d)!,
        );
  };
  for (const p of bivalue)
    if (marks(p).includes(z))
      walk(
        [p],
        marks(p).find((n) => n !== z)!,
      );
  return out;
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
  "empty-rectangle",
  "finned-x-wing",
  "finned-swordfish",
  "simple-coloring",
]);

export interface Miss {
  /** An i18n key under lesson.why.*, or lesson.miss when no quick check explains it. */
  key: string;
  /** d, x, y, z are digits and marks a list of them; other lists are line numbers. */
  params?: Record<string, number | number[]>;
}

/**
 * Why a tapped cell isn't part of the pattern, from the cheapest checks that can tell. Each check
 * only fires on a cell that no pattern of this kind could use, or (where the lesson has only one
 * instance to find) that this one doesn't, so the reason is never wrong.
 */
export function missReason(L: Lesson, { r, c }: CellRC, level?: Level): Miss {
  if (L.board[r]![c]) return { key: "lesson.why.filled" };
  // On your own, any instance counts: a reason naming the lesson's digit or unit would give it away.
  if (level === 3)
    return L.technique === "naked-single" && L.notes[r]![c]!.length > 1
      ? { key: "lesson.why.manyMarks", params: { n: L.notes[r]![c]!.length } }
      : { key: "lesson.miss" };
  // A cell of some instance (missed only for not going with the cells found so far): no reason.
  const instances = instancesOf(L);
  if (instances.some((i) => i.pattern.some((p) => p.r === r && p.c === c)))
    return { key: "lesson.miss" };
  const marks = L.notes[r]![c]!;
  const d = L.digits[0]!;
  const t = L.technique;
  if (t === "naked-single" && marks.length > 1)
    return { key: "lesson.why.manyMarks", params: { n: marks.length } };
  if (ON_DIGIT.has(t) && !marks.includes(d)) return { key: "lesson.why.noDigit", params: { d } };
  // Every cell of an XY-Chain holds exactly two candidates.
  if (t === "xy-chain" && marks.length > 2)
    return { key: "lesson.why.manyMarks", params: { n: marks.length } };
  const subset = t !== "naked-single" && t !== "hidden-single";
  if (subset && t.startsWith("hidden-") && !marks.some((n) => L.digits.includes(n)))
    return { key: "lesson.why.noneOfDigits" };
  const other = marks.find((n) => !L.digits.includes(n));
  if (subset && t.startsWith("naked-") && other)
    return { key: "lesson.why.otherDigit", params: { d: other } };
  if (L.unit && !inUnit(L.unit.kind, L.unit, { r, c })) return { key: "lesson.why.outside" };
  const cell = { r, c };
  const R = { r: r + 1, c: c + 1, b: boxOf(cell) + 1 };
  const count = (kind: Kind, n = d) => spotsIn(has(L), kind, cell, n).length;
  // The digit's spots along the cell's row (as columns) or column (as rows).
  const along = (kind: "row" | "col") =>
    spotsIn(has(L), kind, cell, d).map((p) => (kind === "row" ? p.c : p.r) + 1);
  // A cell the pattern clears, not one that makes it.
  if (instances.some((i) => i.eliminations.some((e) => e.r === r && e.c === c)))
    return { key: "lesson.why.target" };
  const k = FISH_SIZE[t];
  if (k) {
    const row = count("row");
    const col = count("col");
    if (row > k && col > k) return { key: "lesson.why.fishLines", params: { d, row, col, k } };
    // instancesOf lists every fish of this size and cell count on the digit that clears something.
    return {
      key: "lesson.why.fishNone",
      params: { ...R, d, n: L.pattern.length, cols: along("row"), rows: along("col") },
    };
  }
  const row = count("row");
  const col = count("col");
  const box = count("box");
  switch (t) {
    case "skyscraper":
    case "two-string-kite": {
      if (row !== 2 && col !== 2)
        return { key: "lesson.why.noLink", params: { ...R, d, row, col } };
      // This skyscraper's links are rows (or columns): one with more spots can't be one of them.
      const kind = lineKind(L.move);
      if (t === "skyscraper" && kind && (kind === "row" ? row : col) !== 2)
        return {
          key: `lesson.why.skyLine.${kind}`,
          params: { ...R, d, n: kind === "row" ? row : col, at: along(kind) },
        };
      break;
    }
    case "simple-coloring":
      if (row !== 2 && col !== 2 && box !== 2)
        return { key: "lesson.why.noLink3", params: { ...R, d, row, col, box } };
      break;
    case "empty-rectangle": {
      if (row !== 2 && col !== 2 && !emptyRectangleBox(L, cell))
        return { key: "lesson.why.erNone", params: { ...R, d } };
      // Every box cell is in the pattern, so this one could only be an end of its link: a row
      // (or column) with exactly two spots.
      const kind = lineKind(L.move);
      const n = kind === "row" ? row : col;
      if (kind && n !== 2)
        return { key: `lesson.why.linkLine.${kind}`, params: { ...R, d, n, at: along(kind) } };
      break;
    }
    case "finned-x-wing":
    case "finned-swordfish": {
      const size = t === "finned-x-wing" ? 2 : 3;
      // A base line: at most `size` spots in the cover lines, the rest (the fin) in one box.
      const fits = (kind: "row" | "col") => {
        const ps = along(kind).map((n) => n - 1);
        return [0, 3, 6].some((s) => ps.filter((p) => p < s || p > s + 2).length <= size);
      };
      if (!fits("row") && !fits("col"))
        return {
          key: "lesson.why.finLines",
          params: { ...R, d, k: size, cols: along("row"), rows: along("col") },
        };
      // Every spot of the digit in a base line is part of the pattern, so this line isn't one.
      const kind = lineKind(L.move);
      if (kind)
        return {
          key: `lesson.why.notBase.${kind}`,
          params: { ...R, d, at: along(kind) },
        };
      break;
    }
    case "xy-wing":
    case "xyz-wing": {
      const xyz = t === "xyz-wing";
      if (marks.length !== 2 && !(xyz && marks.length === 3))
        return {
          key: xyz ? "lesson.why.xyzMarks" : "lesson.why.wingMarks",
          params: { n: marks.length },
        };
      const pivot = L.move.triggers[0]!;
      const P = { pr: pivot.r + 1, pc: pivot.c + 1 };
      if (marks.length === 3) {
        // A pivot needs two two-candidate cells it sees, sharing one digit, holding its three.
        const pincers = ALL_CELLS.filter(
          (q) =>
            sees(cell, q) &&
            L.notes[q.r]![q.c]!.length === 2 &&
            L.notes[q.r]![q.c]!.every((n) => marks.includes(n)),
        ).map((q) => L.notes[q.r]![q.c]!);
        const pair = pincers.some((a) =>
          pincers.some((b) => a.filter((n) => b.includes(n)).length === 1),
        );
        if (!pair) return { key: "lesson.why.noPincers", params: { marks } };
        break;
      }
      if (!sees(cell, pivot)) return { key: "lesson.why.notPivot", params: P };
      const pm = L.notes[pivot.r]![pivot.c]!;
      if (xyz && !marks.every((n) => pm.includes(n)))
        return { key: "lesson.why.notAmong", params: { ...P, marks: pm } };
      if (!xyz && !marks.some((n) => pm.includes(n)))
        return { key: "lesson.why.noShare", params: P };
      if (!xyz && marks.every((n) => pm.includes(n)))
        return { key: "lesson.why.samePair", params: P };
      break;
    }
    case "w-wing": {
      const pair = L.notes[L.move.triggers[0]!.r]![L.move.triggers[0]!.c]!;
      const x = pair.find((n) => n !== d)!;
      if (!marks.includes(x)) return { key: "lesson.why.wNoX", params: { x } };
      const isPair = marks.length === 2 && marks.includes(d);
      if (!isPair && count("row", x) !== 2 && count("col", x) !== 2 && count("box", x) !== 2)
        return { key: "lesson.why.wNoLink", params: { x, y: d } };
      break;
    }
    case "unique-rectangle":
      if (marks.length !== 2 || !marks.every((n) => L.digits.includes(n)))
        return { key: "lesson.why.urMarks", params: { marks, x: L.digits[0]!, y: L.digits[1]! } };
      break;
    case "bug-plus-one":
      if (marks.length === 2) return { key: "lesson.why.bugTwo" };
      break;
    case "xy-chain":
      // instancesOf lists every chain of this length on z that clears something.
      return { key: "lesson.why.chainNone", params: { z: d, n: L.pattern.length } };
  }
  return { key: "lesson.miss" };
}

const has = (L: Lesson) => (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);

/** The box's spots for the lesson's digit sit on one row and one column, and not just one line. */
function emptyRectangleBox(L: Lesson, p: CellRC): boolean {
  const spots = spotsIn(has(L), "box", p, L.digits[0]!);
  if (new Set(spots.map((q) => q.r)).size < 2 || new Set(spots.map((q) => q.c)).size < 2)
    return false;
  // The row and column may cross at any of the box's cells, as the grader tries them.
  return unitCells("box", p).some((h) => spots.every((q) => q.r === h.r || q.c === h.c));
}

/**
 * Step 2: why crossing out `num` in `cell` isn't part of the move (the mark is there, but the
 * instance doesn't remove it), naming the lines that decide it where a quick check can.
 */
export function removalReason(L: Lesson, inst: Instance, cell: CellRC, num: number): Miss {
  const at = (p: CellRC) => ({ r: p.r + 1, c: p.c + 1 });
  const removed = [...new Set(inst.eliminations.map((e) => e.num))].toSorted((a, b) => a - b);
  if (!removed.includes(num))
    return { key: "lesson.why.onlyRemoves", params: { num, marks: removed } };
  if (inst.pattern.some((p) => p.r === cell.r && p.c === cell.c))
    return { key: "lesson.why.inPattern" };
  const d = num;
  const t = L.technique;
  const tr = inst.pattern;
  // Patterns whose removals see two (or three) of its cells: name one this cell doesn't see.
  const ends: CellRC[] | null =
    t === "skyscraper" || t === "two-string-kite"
      ? [tr[1]!, tr[3]!]
      : t === "xy-wing"
        ? [tr[1]!, tr[2]!]
        : t === "xyz-wing"
          ? [tr[0]!, tr[1]!, tr[2]!]
          : t === "w-wing"
            ? [tr[0]!, tr[1]!]
            : t === "xy-chain"
              ? [tr[0]!, tr.at(-1)!]
              : null;
  if (ends) {
    const seen = ends.filter((e) => sees(cell, e));
    const missed = ends.find((e) => !sees(cell, e));
    if (!missed) return { key: "lesson.notThisCell" };
    if (seen.length)
      return {
        key: "lesson.why.seesOne",
        params: { d, ...at(seen[0]!), mr: missed.r + 1, mc: missed.c + 1 },
      };
    return {
      key: "lesson.why.seesNone",
      params: { d, ...at(ends[0]!), mr: ends[1]!.r + 1, mc: ends[1]!.c + 1 },
    };
  }
  const k = FISH_SIZE[t];
  if (k) {
    const { kind, cover } = fishSides(tr, inst.eliminations);
    const line = kind === "row" ? cell.c : cell.r;
    if (!cover.includes(line))
      return { key: `lesson.why.offCover.${kind}`, params: { d, cover: cover.map((u) => u + 1) } };
  }
  if (t === "finned-x-wing" || t === "finned-swordfish") {
    const size = t === "finned-x-wing" ? 2 : 3;
    const f = finnedSides({ ...inst.move, triggers: tr, eliminations: inst.eliminations }, size);
    if (f)
      return {
        key: `lesson.why.offFin.${f.kind}`,
        params: { d, cover: f.cover.map((u) => u + 1), b: f.box + 1 },
      };
  }
  if (t === "simple-coloring") {
    const { sets, wrap } = colorSets({
      ...inst.move,
      triggers: tr,
      eliminations: inst.eliminations,
    });
    if (!wrap && !sets.every((s) => s.some((q) => sees(cell, q))))
      return { key: "lesson.why.seesOneSet", params: { d } };
  }
  // A line or a box the move clears: a cell outside it keeps its mark.
  const unit =
    t === "pointing"
      ? lineOf(tr)
      : t === "box-line"
        ? "box"
        : t.startsWith("naked-")
          ? (["row", "col", "box"] as Kind[]).find((u) =>
              [...tr, ...inst.eliminations].every((p) => inUnit(u, tr[0]!, p)),
            )
          : null;
  // Sharing another unit with the whole pattern, the cell could be cleared by it just as well.
  const alsoIn = (["row", "col", "box"] as Kind[]).some((u) => tr.every((p) => inUnit(u, p, cell)));
  if (unit && !inUnit(unit, tr[0]!, cell) && !alsoIn) {
    const n = unit === "row" ? tr[0]!.r + 1 : unit === "col" ? tr[0]!.c + 1 : boxOf(tr[0]!) + 1;
    return { key: `lesson.why.offUnit.${unit}`, params: { n, marks: removed } };
  }
  return { key: "lesson.notThisCell" };
}

const lineOf = (cells: CellRC[]): Kind => (cells.every((p) => p.r === cells[0]!.r) ? "row" : "col");

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

/** "in row 4", "in box 2", or "on this board" when the pattern has no one unit. */
function unitLabel(L: Lesson, t: Translate): string {
  const u = L.unit;
  if (!u) return t("lesson.where.here");
  return t(`lesson.where.${u.kind}`, { n: unitNumber(u) });
}

/** "in rows 2 and 7", "in row 2, column 5 and box 3": a level's marked units, by kind. */
function linesLabel(units: BoardUnit[], t: Translate): string {
  const parts = (["row", "col", "box"] as const).flatMap((k) => {
    const ns = units
      .filter((u) => u.kind === k)
      .map(unitNumber)
      .toSorted((a, b) => a - b);
    if (!ns.length) return [];
    return [t(`lesson.lines.${k}${ns.length > 1 ? "Many" : ""}`, { n: wordList(ns, t) })];
  });
  return t("lesson.where.lines", { lines: wordList(parts, t) });
}

/**
 * Step 1's prompt: what to look for and where, as much as `level` tells (guideOf; none given:
 * as before levels, which Spot it keeps). `digit` renders a digit (or its colour).
 */
export function findPrompt(
  L: Lesson,
  t: Translate,
  digit: (n: number) => string,
  level?: Level,
): string {
  const guide = level && guideOf(L.technique, level);
  const technique = t(`hint.move.${L.technique}.name`);
  if (guide === "none")
    return t(L.placement ? "lesson.find.ownCell" : "lesson.find.own", { technique });
  const where = guide === "marked" ? linesLabel(guideUnits(L), t) : unitLabel(L, t);
  const digits = L.digits.map(digit).join(", ");
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
  level?: Level,
): string {
  return reasonText(L, missReason(L, cell, level), t, digit);
}

const DIGIT_PARAMS = new Set(["d", "x", "y", "z", "num"]);
/** A Miss as text: its digits rendered (colour mode may turn them into words), lists joined. */
export function reasonText(
  L: Lesson,
  miss: Miss,
  t: Translate,
  digit: (n: number) => string,
): string {
  const params = Object.fromEntries(
    Object.entries(miss.params ?? {}).map(([k, v]) => [
      k,
      Array.isArray(v)
        ? wordList(k === "marks" ? v.map(digit) : v, t)
        : DIGIT_PARAMS.has(k)
          ? digit(v)
          : v,
    ]),
  );
  return t(miss.key, {
    where: unitLabel(L, t),
    technique: t(`hint.move.${L.technique}.name`),
    digits: L.digits.map(digit).join(", "),
    ...params,
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

/**
 * The units a "marked" level names and marks from the start: lessonUnits, less the lines across a
 * pattern built along the other way (a fish's cover lines would give its corners away), plus the
 * line a pointing pair points along (its box alone wouldn't say which way).
 */
export function guideUnits(L: Lesson): BoardUnit[] {
  const way = lineKind(L.move);
  const units = lessonUnits(L).filter(
    (u) => !way || u.kind === way || (u.kind === "box" && !FISH_SIZE[L.technique]),
  );
  return L.technique === "pointing" && way ? [...units, { kind: way, ...L.pattern[0]! }] : units;
}
