// A move told about the board it's on: the real rows, columns and boxes of this instance, in short
// sentences, for the lesson's "why", the in-game hint and the Academy's worked examples. Each
// sentence is tagged with the Watch it beat it belongs to (the pattern's cells, its links, the
// result), so a step's words match what it draws. Pure; unit-tested in tests/explain.test.ts.

import type { CellRC, SolveMove } from "./sudokuGrader";

type Kind = "row" | "col" | "box";
export type Translate = (key: string, params?: Record<string, unknown>) => string;
/** Whether (r, c) has pencil mark n; empty or filled cells have none. */
export type HasMark = (r: number, c: number, n: number) => boolean;
type Move = Pick<
  SolveMove,
  "technique" | "triggers" | "eliminations" | "placement" | "digits" | "unit"
>;

export interface Sentence {
  step: "cells" | "links" | "result";
  text: string;
  /** Names the cell the move changes: a lesson keeps it for Show me, a hint for its last step. */
  answer?: true;
}

// ---- Board geometry ----------------------------------------------------------------------------

export const boxOf = (p: CellRC) => Math.floor(p.r / 3) * 3 + Math.floor(p.c / 3);
const same = (a: CellRC, b: CellRC) => a.r === b.r && a.c === b.c;
/** Two different cells in one row, column or box. */
export const sees = (a: CellRC, b: CellRC) =>
  !same(a, b) && (a.r === b.r || a.c === b.c || boxOf(a) === boxOf(b));
const unitKey = (k: Kind, p: CellRC) => (k === "row" ? p.r : k === "col" ? p.c : boxOf(p));
export const unitCells = (k: Kind, p: CellRC): CellRC[] =>
  Array.from({ length: 9 }, (_, i) =>
    k === "row"
      ? { r: p.r, c: i }
      : k === "col"
        ? { r: i, c: p.c }
        : { r: p.r - (p.r % 3) + Math.floor(i / 3), c: p.c - (p.c % 3) + (i % 3) },
  );
/** The cells of p's row, column or box that still have mark d. */
export const spotsIn = (has: HasMark, k: Kind, p: CellRC, d: number) =>
  unitCells(k, p).filter((q) => has(q.r, q.c, d));
const uniq = (cells: CellRC[]) =>
  cells.filter((p, i) => cells.findIndex((q) => same(p, q)) === i).map(({ r, c }) => ({ r, c }));
const sharedUnit = (cells: CellRC[], order: Kind[] = ["row", "col", "box"]) =>
  order.find((k) => cells.every((p) => unitKey(k, p) === unitKey(k, cells[0]!))) ?? null;
const sorted = (ns: number[]) => [...new Set(ns)].toSorted((a, b) => a - b);
function choose<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((x, i) => choose(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]));
}

/** A fish's sides: the base lines its digit is confined to, the cover lines it then fills. */
export function fishSides(corners: CellRC[], elims: CellRC[]) {
  const rows = new Set(corners.map((p) => p.r));
  const cols = new Set(corners.map((p) => p.c));
  // The base is the side the eliminations are off: they sit in the cover lines.
  const baseRows = elims.length
    ? elims.every((e) => cols.has(e.c) && !rows.has(e.r))
    : rows.size <= cols.size;
  return {
    kind: (baseRows ? "row" : "col") as "row" | "col",
    base: sorted([...(baseRows ? rows : cols)]),
    cover: sorted([...(baseRows ? cols : rows)]),
  };
}

/** A finned fish: its base and cover lines (k of each), its fin cells and the fins' box. */
export function finnedSides(move: Move, k: number) {
  const t = uniq(move.triggers);
  const elims = move.eliminations;
  const finBox = elims[0] ? boxOf(elims[0]) : -1;
  for (const kind of ["row", "col"] as const) {
    const [b, c] = kind === "row" ? (["r", "c"] as const) : (["c", "r"] as const);
    const base = sorted(t.map((p) => p[b]));
    if (base.length !== k) continue;
    for (const cover of choose(sorted(t.map((p) => p[c])), k)) {
      const fins = t.filter((p) => !cover.includes(p[c]));
      if (!fins.length || fins.some((f) => boxOf(f) !== finBox)) continue;
      if (!elims.every((e) => cover.includes(e[c]))) continue;
      return { kind, base, cover, fins, box: finBox };
    }
  }
  return null;
}

/**
 * Simple colouring's chain in its two sets. A colour wraps when two of its cells see each other:
 * the grader then clears that whole set and keeps the other as the triggers, whose cells never see
 * each other. Else (a trap) any two chain cells that see each other are opposite colours, so the
 * triggers 2-colour by "sees".
 */
export function colorSets(move: Move): { sets: [CellRC[], CellRC[]]; wrap: boolean } {
  const tr = uniq(move.triggers);
  const wrap = !tr.some((a) => tr.some((b) => sees(a, b)));
  if (wrap) return { sets: [tr, uniq(move.eliminations)], wrap };
  const tone = new Map<number, 0 | 1>();
  for (let s = 0; s < tr.length; s++) {
    if (tone.has(s)) continue;
    tone.set(s, 0);
    const queue = [s];
    while (queue.length) {
      const i = queue.shift()!;
      tr.forEach((q, j) => {
        if (!tone.has(j) && sees(tr[i]!, q)) {
          tone.set(j, tone.get(i) === 0 ? 1 : 0);
          queue.push(j);
        }
      });
    }
  }
  const sets = [0, 1].map((s) => tr.filter((_, i) => tone.get(i) === s)) as [CellRC[], CellRC[]];
  return { sets, wrap };
}

/**
 * Whether the instance is built on rows or on columns (a fish's base, a skyscraper's links, the
 * line of a pointing pair or box-line), or null when it isn't one or the other.
 */
export function lineKind(move: Move): "row" | "col" | null {
  const t = uniq(move.triggers);
  switch (move.technique) {
    case "pointing":
    case "box-line":
      return sharedUnit(t, ["row", "col"]) as "row" | "col" | null;
    case "x-wing":
    case "swordfish":
    case "jellyfish":
      return fishSides(t, move.eliminations).kind;
    case "finned-x-wing":
      return finnedSides(move, 2)?.kind ?? null;
    case "finned-swordfish":
      return finnedSides(move, 3)?.kind ?? null;
    case "skyscraper":
      return t[0] && t[1] && t[0].r === t[1].r ? "row" : "col";
    case "empty-rectangle":
      return t[0] && t[1] && t[0].c === t[1].c ? "col" : "row";
  }
  return null;
}

// ---- Words ---------------------------------------------------------------------------------------

/** "3", "3 and 8", "1, 5 and 7"; `sep` between items that hold commas themselves. */
export function wordList(
  items: (string | number)[],
  t: Translate,
  word = "and",
  sep = ", ",
): string {
  const s = items.map(String);
  return s.length < 2
    ? (s[0] ?? "")
    : `${s.slice(0, -1).join(sep)} ${t(`explain.${word}`)} ${s.at(-1)}`;
}
/** 1-based box number: boxes count across, then down. */
const boxNo = (p: CellRC) => boxOf(p) + 1;

/** The narration of `move`, in order; `digit` renders a digit (or its colour). */
export function narrate(
  move: Move,
  has: HasMark,
  t: Translate,
  digit: (n: number) => string,
): Sentence[] {
  const out: Sentence[] = [];
  const say = (step: Sentence["step"], key: string, params: Record<string, unknown> = {}) =>
    out.push({ step, text: t(`explain.${key}`, params) });
  // A reasoning sentence that names the cell to change.
  const sayAnswer = (key: string, params: Record<string, unknown>) =>
    out.push({ step: "links", text: t(`explain.${key}`, params), answer: true });
  const cell = (p: CellRC) => t("explain.cell", { r: p.r + 1, c: p.c + 1 });
  const cells = (ps: CellRC[]) => wordList(ps.map(cell), t, "and", "; ");
  const rows = (ps: CellRC[]) => wordList(sorted(ps.map((p) => p.r + 1)), t);
  const cols = (ps: CellRC[]) => wordList(sorted(ps.map((p) => p.c + 1)), t);
  const digits = (ns: number[], word = "and") => wordList(ns.map(digit), t, word);
  // A unit's spots, named by what varies along it: columns in a row, rows in a column.
  const along = (k: Kind, ps: CellRC[]) =>
    k === "row" ? cols(ps) : k === "col" ? rows(ps) : cells(ps);
  const unitNo = (k: Kind, p: CellRC) => (k === "row" ? p.r + 1 : k === "col" ? p.c + 1 : boxNo(p));
  const where = (k: Kind, p: CellRC) => t(`lesson.where.${k}`, { n: unitNo(k, p) });
  const two = (k: Kind, a: CellRC, b: CellRC, n: number) =>
    say("cells", `two.${k}`, { n: unitNo(k, a), d: digit(n), at: along(k, [a, b]) });
  const seesBoth = (n: number) =>
    say("result", "seesBoth", { d: digit(n), cells: cells(move.eliminations) });

  const d = move.digits[0] ?? 0;
  const D = digit(d);
  const tr = uniq(move.triggers);
  const el = move.eliminations;
  const elCells = uniq(el);
  const removed = sorted(el.map((e) => e.num));
  const p = move.placement;
  const marks = (q: CellRC) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => has(q.r, q.c, n));

  switch (move.technique) {
    case "naked-single":
      say("cells", "nakedSingle", { r: p!.r + 1, c: p!.c + 1, d: D });
      break;
    case "hidden-single": {
      const k = move.unit ?? "box";
      say("cells", `hiddenSingle.${k}`, { n: unitNo(k, p!), d: D, r: p!.r + 1, c: p!.c + 1 });
      break;
    }
    case "pointing": {
      const k = sharedUnit(tr, ["row", "col"]) ?? "row";
      const n = unitNo(k, tr[0]!);
      say("cells", `pointing.${k}`, { b: boxNo(tr[0]!), n, d: D, at: along(k, tr) });
      say("links", `pointing.link.${k}`, { b: boxNo(tr[0]!), n, d: D });
      say("result", `offLine.${k}`, { n, d: D, cells: cells(elCells) });
      break;
    }
    case "box-line": {
      const k = sharedUnit(tr, ["row", "col"]) ?? "row";
      const b = boxNo(tr[0]!);
      say("cells", `boxLine.${k}`, { b, n: unitNo(k, tr[0]!), d: D, at: along(k, tr) });
      say("links", `boxLine.link.${k}`, { b, n: unitNo(k, tr[0]!), d: D });
      say("result", "boxLine.result", { b, d: D, cells: cells(elCells) });
      break;
    }
    case "naked-pair":
    case "naked-triple":
    case "naked-quad": {
      const k = sharedUnit([...tr, ...elCells]) ?? "box";
      const n = unitNo(k, tr[0]!);
      say("cells", `naked.${k}`, { n, at: along(k, tr), digits: digits(move.digits) });
      say("links", "subset.link");
      say("result", `naked.result.${k}`, {
        n,
        digits: digits(removed, "or"),
        cells: cells(elCells),
      });
      break;
    }
    case "hidden-pair":
    case "hidden-triple":
    case "hidden-quad": {
      // The unit where the digits are only in these cells.
      const k =
        (["row", "col", "box"] as Kind[]).find(
          (u) =>
            sharedUnit(tr, [u]) &&
            unitCells(u, tr[0]!).every(
              (q) => tr.some((x) => same(x, q)) || !move.digits.some((n) => has(q.r, q.c, n)),
            ),
        ) ?? "box";
      say("cells", `hidden.${k}`, {
        n: unitNo(k, tr[0]!),
        at: along(k, tr),
        digits: digits(move.digits),
      });
      say("links", "subset.link");
      say("result", "hidden.result", { digits: digits(removed) });
      break;
    }
    case "x-wing":
    case "swordfish":
    case "jellyfish": {
      const { kind, base, cover } = fishSides(tr, el);
      const lines = {
        base: wordList(
          base.map((u) => u + 1),
          t,
        ),
        cover: wordList(
          cover.map((u) => u + 1),
          t,
        ),
      };
      say("cells", `fish.${kind}`, { ...lines, d: D });
      say("links", `fish.link.${kind}`, { ...lines, d: D });
      say("result", `fish.result.${kind}`, { ...lines, d: D, cells: cells(elCells) });
      break;
    }
    case "finned-x-wing":
    case "finned-swordfish": {
      const small = move.technique === "finned-x-wing";
      const f = finnedSides(move, small ? 2 : 3);
      if (!f) break;
      const lines = {
        base: wordList(
          f.base.map((u) => u + 1),
          t,
        ),
        cover: wordList(
          f.cover.map((u) => u + 1),
          t,
        ),
        b: f.box + 1,
        d: D,
        fish: t(`hint.move.${small ? "x-wing" : "swordfish"}.name`),
      };
      say("cells", `finned.${f.kind}`, { ...lines, fins: cells(f.fins) });
      say("links", `finned.link.${f.kind}`, lines);
      say("result", `finned.result.${f.kind}`, { ...lines, cells: cells(elCells) });
      break;
    }
    case "skyscraper":
    case "two-string-kite": {
      const [n1, f1, n2, f2] = tr;
      if (!n1 || !f1 || !n2 || !f2) break;
      const k1: Kind = n1.r === f1.r ? "row" : "col";
      const k2: Kind = n2.r === f2.r ? "row" : "col";
      two(k1, n1, f1, d);
      two(k2, n2, f2, d);
      if (move.technique === "skyscraper")
        say(
          "links",
          `sky.link.${k1}`,
          k1 === "row"
            ? { r1: n1.r + 1, r2: n2.r + 1, c: n1.c + 1, d: D }
            : { c1: n1.c + 1, c2: n2.c + 1, r: n1.r + 1, d: D },
        );
      else {
        // Name the row link first: "row 2's spot in column 3 and column 5's spot in row 4".
        const [rn, cn] = k1 === "row" ? [n1, n2] : [n2, n1];
        say("links", "kite.link", {
          r: rn.r + 1,
          rc: rn.c + 1,
          c: cn.c + 1,
          cr: cn.r + 1,
          b: boxNo(n1),
          d: D,
        });
      }
      say("result", "ends", { d: D, a: cell(f1), b: cell(f2) });
      seesBoth(d);
      break;
    }
    case "empty-rectangle": {
      const [near, far, ...box] = tr;
      const target = el[0];
      if (!near || !far || !box.length || !target) break;
      const byCol = near.c === far.c;
      // The box's row and column: the near end's line, and the target's.
      const r = byCol ? near.r : target.r;
      const c = byCol ? target.c : near.c;
      const b = boxNo(box[0]!);
      say("cells", "er.box", { b, r: r + 1, c: c + 1, d: D });
      two(byCol ? "col" : "row", near, far, d);
      const tp = { tr: target.r + 1, tc: target.c + 1, d: D };
      sayAnswer(
        byCol ? "er.link.col" : "er.link.row",
        byCol
          ? { ...tp, lc: near.c + 1, nr: near.r + 1 }
          : { ...tp, lr: near.r + 1, nc: near.c + 1 },
      );
      say("links", "er.empty", { r: r + 1, c: c + 1, b, d: D });
      say("result", "er.result", tp);
      break;
    }
    case "unique-rectangle": {
      const odd = elCells[0];
      if (!odd) break;
      const [x, y] = move.digits;
      const all = [...tr, odd];
      say("cells", "ur.cells", { cells: cells(tr), x: digit(x!), y: digit(y!) });
      sayAnswer("ur.link", {
        odd: cell(odd),
        rows: rows(all),
        cols: cols(all),
        x: digit(x!),
        y: digit(y!),
      });
      say("result", "ur.result", { odd: cell(odd), digits: digits(removed, "or") });
      break;
    }
    case "simple-coloring": {
      const {
        sets: [a, b],
        wrap,
      } = colorSets(move);
      say("cells", "color.cells", { d: D, n: a.length + b.length });
      say("links", "color.link", { d: D, a: cells(a), b: cells(b) });
      const pair = wrap && choose(b, 2).find(([u, v]) => sees(u!, v!));
      if (pair) {
        say("links", "color.wrap", { d: D, a: cell(pair[0]!), b: cell(pair[1]!) });
        say("result", "color.wrapResult", { d: D, cells: cells(elCells) });
      } else say("result", "color.trap", { d: D, cells: cells(elCells) });
      break;
    }
    case "xy-wing":
    case "xyz-wing": {
      const [pivot, a, b] = tr;
      if (!pivot || !a || !b) break;
      const other = (q: CellRC) => marks(q).find((n) => n !== d)!;
      const [x, y] = [other(a), other(b)].map(digit);
      const z = D;
      if (move.technique === "xy-wing") say("cells", "xy.pivot", { p: cell(pivot), x, y });
      else say("cells", "xyz.pivot", { p: cell(pivot), digits: digits(marks(pivot)) });
      say("cells", "xy.pincers", { a: cell(a), b: cell(b), x, y, z });
      if (move.technique === "xy-wing") {
        say("links", "xy.link", { x, y, z });
        say("result", "xy.result", { z });
      } else {
        say("links", "xyz.link", { x, y, z });
        say("result", "xyz.result", { z, cells: cells(elCells) });
        break;
      }
      seesBoth(d);
      break;
    }
    case "w-wing": {
      const [a, b, e1, e2] = tr;
      if (!a || !b || !e1 || !e2) break;
      const xn = marks(a).find((n) => n !== d)!;
      const [x, y] = [digit(xn), D];
      say("cells", "w.pair", { a: cell(a), b: cell(b), x, y });
      // The strong link: the unit where x has only these two spots.
      const k =
        (["row", "col", "box"] as Kind[]).find(
          (u) => sharedUnit([e1, e2], [u]) && spotsIn(has, u, e1, xn).length === 2,
        ) ?? "box";
      two(k, e1, e2, xn);
      say("links", "w.link", { e1: cell(e1), e2: cell(e2), x, y, where: where(k, e1) });
      say("result", "w.result", { y });
      seesBoth(d);
      break;
    }
    case "xy-chain": {
      const first = tr[0];
      const last = tr.at(-1);
      if (!first || !last) break;
      // Each cell forced to its other digit in turn, starting from the first one's.
      const forced: number[] = [];
      let prev = d;
      for (const q of tr) {
        prev = marks(q).find((n) => n !== prev) ?? prev;
        forced.push(prev);
      }
      say("cells", "chain.cells", { cells: cells(tr) });
      say("links", "chain.link", {
        first: cell(first),
        last: cell(last),
        e: digit(forced[0]!),
        steps: digits(forced),
        z: D,
      });
      say("result", "chain.result", { z: D });
      seesBoth(d);
      break;
    }
    case "bug-plus-one":
      say("cells", "bug.cells", { p: cell(p!) });
      say("links", "bug.link", { d: D });
      break;
  }
  if (p) say("result", "single.result", { r: p.r + 1, c: p.c + 1, d: digit(p.num) });
  return out;
}
