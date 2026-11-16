// A technique's pattern drawn the way puzzle books draw it: lines that join the actual pencil marks
// (strong links solid, weak links and cover lines dashed), rings round the marks that matter, a
// frame round the unit, a red-pen stroke through each mark it removes and a circle round the digit
// it places. Pure, in board units (a cell is 1×1, the board 9×9); PatternOverlay.vue draws it.
// Unit-tested in tests/patternMarks.test.ts.

import type { CellRC, DigitAt, SolveMove } from "./sudokuGrader";

import { sameCell } from "./gridNav";

export interface Pt {
  x: number;
  y: number;
}
export type Mark =
  /** strong: a strong link or a base line; weak: a weak link or a cover line. */
  | { kind: "line"; a: Pt; b: Pt; style: "strong" | "weak" }
  /** pattern: pen blue; alt: the second colour (fins, a chain's other colour, a link digit). */
  /** `ghost` writes the digit inside, for a cell that shows no pencil marks. */
  | { kind: "ring"; at: Pt; num: number; tone: "pattern" | "alt"; ghost?: boolean }
  | { kind: "frame"; x: number; y: number; w: number; h: number }
  /**
   * A removed mark. `ghost` redraws the digit in red, for when the real mark is already gone;
   * `fade` then lets it go, for the moment it's crossed out.
   */
  | { kind: "cross"; at: Pt; num: number; ghost?: boolean; fade?: boolean }
  | { kind: "place"; at: Pt };

type PatternMove = Pick<
  SolveMove,
  "technique" | "triggers" | "eliminations" | "placement" | "digits" | "unit"
>;
/** Whether (r, c) has pencil mark n; empty or filled cells have none. */
type HasMark = (r: number, c: number, n: number) => boolean;

/** Where mark n sits inside its cell: the 3×3 pencil-mark layout of SudokuCell. */
export const anchor = (r: number, c: number, n: number): Pt => ({
  x: c + (((n - 1) % 3) + 0.5) / 3,
  y: r + (Math.floor((n - 1) / 3) + 0.5) / 3,
});
const centre = ({ r, c }: CellRC): Pt => ({ x: c + 0.5, y: r + 0.5 });

const box = (p: CellRC) => Math.floor(p.r / 3) * 3 + Math.floor(p.c / 3);
type Kind = "row" | "col" | "box";
const unitKey = (kind: Kind, p: CellRC) => (kind === "row" ? p.r : kind === "col" ? p.c : box(p));
const frame = (kind: Kind, p: CellRC): Mark =>
  kind === "row"
    ? { kind: "frame", x: 0, y: p.r, w: 9, h: 1 }
    : kind === "col"
      ? { kind: "frame", x: p.c, y: 0, w: 1, h: 9 }
      : { kind: "frame", x: p.c - (p.c % 3), y: p.r - (p.r % 3), w: 3, h: 3 };
/** The row, column or box (in that order) holding every cell, if any. */
function sharedUnit(cells: CellRC[], order: Kind[] = ["row", "col", "box"]): Kind | null {
  return order.find((k) => cells.every((p) => unitKey(k, p) === unitKey(k, cells[0]!))) ?? null;
}
const uniq = (cells: CellRC[]) =>
  cells
    .filter((p, i) => cells.findIndex((q) => sameCell(p, q)) === i)
    .map(({ r, c }) => ({ r, c }));
const UNIT_CELLS = (kind: Kind, p: CellRC): CellRC[] =>
  Array.from({ length: 9 }, (_, i) =>
    kind === "row"
      ? { r: p.r, c: i }
      : kind === "col"
        ? { r: i, c: p.c }
        : { r: p.r - (p.r % 3) + Math.floor(i / 3), c: p.c - (p.c % 3) + (i % 3) },
  );

/** A line through `cells` in order, each joined to the next at digit n's mark. */
function chain(cells: CellRC[], n: number, style: "strong" | "weak"): Mark[] {
  return cells.slice(1).map((p, i) => ({
    kind: "line" as const,
    a: anchor(cells[i]!.r, cells[i]!.c, n),
    b: anchor(p.r, p.c, n),
    style,
  }));
}
const rings = (cells: CellRC[], n: number, tone: "pattern" | "alt" = "pattern"): Mark[] =>
  cells.map(({ r, c }) => ({ kind: "ring" as const, at: anchor(r, c, n), num: n, tone }));
const crosses = (elims: DigitAt[]): Mark[] =>
  elims.map(({ r, c, num }) => ({ kind: "cross" as const, at: anchor(r, c, num), num }));
const sortBy = (cells: CellRC[], key: "r" | "c") => cells.toSorted((a, b) => a[key] - b[key]);
const groups = (cells: CellRC[], key: "r" | "c") => {
  const out = new Map<number, CellRC[]>();
  for (const p of cells) out.set(p[key], [...(out.get(p[key]) ?? []), p]);
  return [...out.values()];
};

// Fish: base lines solid through the corners, cover lines dashed along to what they clear (with
// `reach`; else over the corners only, so they don't give away the cells to clear).
function fish(
  corners: CellRC[],
  elims: DigitAt[],
  n: number,
  reach: boolean,
  extra: Mark[] = [],
): Mark[] {
  const rows = new Set(corners.map((p) => p.r));
  const cols = new Set(corners.map((p) => p.c));
  // The base is the side the eliminations are off: they sit in the cover lines.
  const baseRows = elims.length
    ? elims.every((e) => cols.has(e.c) && !rows.has(e.r))
    : rows.size <= cols.size;
  const [base, cover] = baseRows ? (["r", "c"] as const) : (["c", "r"] as const);
  const along = base === "r" ? "c" : "r";
  const marks: Mark[] = [];
  for (const line of groups(corners, base)) marks.push(...chain(sortBy(line, along), n, "strong"));
  for (const line of groups([...corners, ...(reach ? elims : [])], cover))
    if (line.length > 1) {
      const s = sortBy(line, base);
      marks.push(...chain([s[0]!, s.at(-1)!], n, "weak"));
    }
  return [...marks, ...extra, ...rings(corners, n), ...crosses(elims)];
}

// Finned fish: find the k cover lines whose leftovers (the fins) share the eliminations' box.
function finned(move: PatternMove, n: number, reach: boolean, k: number): Mark[] {
  const t = uniq(move.triggers);
  const elims = move.eliminations;
  const elimBox = elims[0] ? box(elims[0]) : -1;
  const choose = (xs: number[], m: number): number[][] =>
    m === 0 ? [[]] : xs.flatMap((x, i) => choose(xs.slice(i + 1), m - 1).map((r) => [x, ...r]));
  for (const key of ["c", "r"] as const) {
    for (const cover of choose([...new Set(t.map((p) => p[key]))], k)) {
      const on = (p: CellRC) => cover.includes(p[key]);
      const corners = t.filter(on);
      const fins = t.filter((p) => !on(p));
      if (!fins.length || fins.some((f) => box(f) !== elimBox)) continue;
      if (!elims.every(on)) continue;
      return fish(corners, elims, n, reach, [frame("box", fins[0]!), ...rings(fins, n, "alt")]);
    }
  }
  return fish(t, elims, n, reach);
}

// Simple colouring: join cells that are the digit's only two spots in a shared unit; colour the
// chain in two alternating tones. A wrap clears a whole colour, which the grader leaves out of the
// triggers, so the chain is rebuilt over both; the triggers start it, so they take the main tone.
function coloring(move: PatternMove, n: number, has: HasMark): Mark[] {
  const triggers = uniq(move.triggers);
  const cells = uniq([...triggers, ...move.eliminations]);
  const strong = (a: CellRC, b: CellRC) =>
    (["row", "col", "box"] as Kind[]).some(
      (k) =>
        unitKey(k, a) === unitKey(k, b) &&
        UNIT_CELLS(k, a).filter((p) => has(p.r, p.c, n)).length === 2,
    );
  const tone = new Map<number, "pattern" | "alt">();
  const marks: Mark[] = [];
  for (let s = 0; s < cells.length; s++) {
    if (tone.has(s)) continue;
    tone.set(s, "pattern");
    const queue = [s];
    while (queue.length) {
      const i = queue.shift()!;
      for (let j = 0; j < cells.length; j++) {
        if (j === i || !strong(cells[i]!, cells[j]!)) continue;
        if (!tone.has(j)) {
          tone.set(j, tone.get(i) === "pattern" ? "alt" : "pattern");
          queue.push(j);
          marks.push(...chain([cells[i]!, cells[j]!], n, "strong"));
        }
      }
    }
  }
  // A trap's removals sit off the chain: no links, so no ring.
  const key = ({ x, y }: Pt) => `${x},${y}`;
  const linked = new Set(marks.flatMap((m) => (m.kind === "line" ? [key(m.a), key(m.b)] : [])));
  const ringed = cells.flatMap((p, i) =>
    i < triggers.length || linked.has(key(anchor(p.r, p.c, n))) ? rings([p], n, tone.get(i)) : [],
  );
  return [...marks, ...ringed, ...crosses(move.eliminations)];
}

/** Candidates of a cell, 1–9. */
const marksOf = (has: HasMark, p: CellRC) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => has(p.r, p.c, n));
/** The digit two cells have in common other than `not`, for anchoring a wing's link. */
const sharedDigit = (has: HasMark, a: CellRC, b: CellRC, not?: number) =>
  marksOf(has, a).find((n) => n !== not && has(b.r, b.c, n));
function link(has: HasMark, a: CellRC, b: CellRC, n: number | undefined, style: "strong" | "weak") {
  return {
    kind: "line" as const,
    a: n ? anchor(a.r, a.c, n) : centre(a),
    b: n ? anchor(b.r, b.c, n) : centre(b),
    style,
  };
}

/**
 * The marks that draw `move`'s pattern; `has` tells which pencil marks the board shows. Without
 * `result`, only the pattern: no crosses or placement, and no line reaching the cells it changes.
 */
export function patternMarks(move: PatternMove, has: HasMark, result = true): Mark[] {
  const marks = draw(move, has, result);
  return result ? marks : marks.filter((m) => m.kind !== "cross" && m.kind !== "place");
}

function draw(move: PatternMove, has: HasMark, result: boolean): Mark[] {
  const n = move.digits[0] ?? 0;
  const t = uniq(move.triggers);
  const elims = move.eliminations;
  const p = move.placement;
  const place: Mark[] = p ? [{ kind: "place", at: centre(p) }] : [];

  switch (move.technique) {
    case "naked-single":
    case "bug-plus-one":
      return place;
    case "hidden-single":
      return p ? [frame(move.unit ?? "box", p), ...place] : [];
    case "pointing": {
      const s = sortBy(t, sharedUnit(t, ["row"]) ? "c" : "r");
      const line = sharedUnit(t, ["row"]) ? "r" : "c";
      const reach = sortBy([...t, ...(result ? elims : [])], line === "r" ? "c" : "r");
      return [
        frame("box", t[0]!),
        ...chain([reach[0]!, reach.at(-1)!], n, "weak"),
        ...chain(s, n, "strong"),
        ...rings(t, n),
        ...crosses(elims),
      ];
    }
    case "box-line": {
      const kind = sharedUnit(t, ["row", "col"]) ?? "row";
      return [
        frame(kind, t[0]!),
        frame("box", t[0]!),
        ...chain(sortBy(t, kind === "row" ? "c" : "r"), n, "strong"),
        ...rings(t, n),
        ...crosses(elims),
      ];
    }
    case "naked-pair":
    case "naked-triple":
    case "naked-quad":
    case "hidden-pair":
    case "hidden-triple":
    case "hidden-quad": {
      // The unit holding the subset and what it clears (for a hidden subset, just its cells).
      const kind = sharedUnit(move.technique.startsWith("naked") ? [...t, ...elims] : t) ?? "box";
      const ringed = t.flatMap((q) =>
        move.digits.filter((d) => has(q.r, q.c, d)).map((d) => rings([q], d)[0]!),
      );
      return [frame(kind, t[0]!), ...ringed, ...crosses(elims)];
    }
    case "x-wing":
    case "swordfish":
    case "jellyfish":
      return fish(t, elims, n, result);
    case "finned-x-wing":
      return finned(move, n, result, 2);
    case "finned-swordfish":
      return finned(move, n, result, 3);
    case "skyscraper":
    case "two-string-kite": {
      const [n1, f1, n2, f2] = t;
      if (!n1 || !f1 || !n2 || !f2) return [];
      return [
        ...chain([n1, f1], n, "strong"),
        ...chain([n2, f2], n, "strong"),
        ...chain([n1, n2], n, "weak"),
        ...rings(t, n),
        ...crosses(elims),
      ];
    }
    case "empty-rectangle": {
      // The grader lists the link's ends first (the near one on the box's line), then the box.
      const [near, far, ...cells] = t;
      if (!near || !far || !cells.length) return [];
      const byCol = near.c === far.c;
      const key = byCol ? "c" : "r";
      const arm = cells.filter((q) => (byCol ? q.r === near.r : q.c === near.c));
      // The near end sees the box's arm on its line: a dashed line to its nearest cell.
      const end = arm.reduce<CellRC | null>(
        (a, q) => (!a || Math.abs(q[key] - near[key]) < Math.abs(a[key] - near[key]) ? q : a),
        null,
      );
      return [
        frame("box", cells[0]!),
        ...chain([near, far], n, "strong"),
        ...(end ? chain([near, end], n, "weak") : []),
        ...(result ? elims.flatMap((e) => chain([far, e], n, "weak")) : []),
        ...rings(t, n),
        ...crosses(elims),
      ];
    }
    case "w-wing": {
      const [a, b, e1, e2] = t;
      if (!a || !b || !e1 || !e2) return [];
      const x = marksOf(has, a).find((d) => d !== n);
      return [
        link(has, a, e1, x, "weak"),
        link(has, e1, e2, x, "strong"),
        link(has, e2, b, x, "weak"),
        ...rings([a, b], n),
        ...(x ? rings([e1, e2], x, "alt") : []),
        ...crosses(elims),
      ];
    }
    case "xy-wing":
    case "xyz-wing": {
      const [pivot, a, b] = t;
      if (!pivot || !a || !b) return [];
      const z = move.technique === "xy-wing" ? [a, b] : [pivot, a, b];
      return [
        link(has, pivot, a, sharedDigit(has, pivot, a, n), "weak"),
        link(has, pivot, b, sharedDigit(has, pivot, b, n), "weak"),
        ...rings(z, n),
        ...crosses(elims),
      ];
    }
    case "xy-chain": {
      // The grader lists the chain in order, z at both ends. Each cell is one of its two digits (a
      // strong link inside it); each next cell sees it and shares a digit (a weak link between).
      if (t.length < 2) return [];
      const out: Mark[] = [...rings([t[0]!, t.at(-1)!], n)];
      let d: number | undefined = n;
      for (const [i, a] of t.entries()) {
        const q = t[i + 1];
        const e: number | undefined = q ? sharedDigit(has, a, q, d) : n;
        if (d && e)
          out.push({
            kind: "line",
            a: anchor(a.r, a.c, d),
            b: anchor(a.r, a.c, e),
            style: "strong",
          });
        if (q) out.push(link(has, a, q, e, "weak"), ...(e ? rings([a, q], e, "alt") : []));
        d = e;
      }
      return [...out, ...crosses(elims)];
    }
    case "unique-rectangle": {
      const all = uniq([...t, ...elims]);
      const rs = [...new Set(all.map((q) => q.r))].toSorted((x, y) => x - y);
      const cs = [...new Set(all.map((q) => q.c))].toSorted((x, y) => x - y);
      if (rs.length !== 2 || cs.length !== 2) return crosses(elims);
      const [r1, r2] = rs as [number, number];
      const [c1, c2] = cs as [number, number];
      const corner = (r: number, c: number) => centre({ r, c });
      const side = (a: Pt, b: Pt): Mark => ({ kind: "line", a, b, style: "weak" });
      const ringed = t.flatMap((q) =>
        move.digits.filter((d) => has(q.r, q.c, d)).map((d) => rings([q], d)[0]!),
      );
      return [
        side(corner(r1, c1), corner(r1, c2)),
        side(corner(r1, c2), corner(r2, c2)),
        side(corner(r2, c2), corner(r2, c1)),
        side(corner(r2, c1), corner(r1, c1)),
        ...ringed,
        ...crosses(elims),
      ];
    }
    case "simple-coloring":
      return coloring(move, n, has);
  }
  return [...rings(t, n), ...crosses(elims), ...place];
}

/**
 * For a board whose cells may show no pencil marks (a game without notes): rings and crosses in
 * those cells write their digit, so a line still joins something you can see.
 */
export function withGhosts(marks: Mark[], showsNotes: (r: number, c: number) => boolean): Mark[] {
  return marks.map((m) =>
    (m.kind === "ring" || m.kind === "cross") && !showsNotes(Math.floor(m.at.y), Math.floor(m.at.x))
      ? { ...m, ghost: true }
      : m,
  );
}

/** A pen circle round a placed digit. */
export const circled = (p: CellRC): Mark => ({ kind: "place", at: centre(p) });

/** Strokes for marks just crossed out: the digit in red under the stroke, fading away. */
export const strikes = (removed: DigitAt[], fade = true): Mark[] =>
  removed.map(({ r, c, num }) => ({
    kind: "cross",
    at: anchor(r, c, num),
    num,
    ghost: true,
    fade,
  }));

/** One step of "Watch it": the marks drawn so far, and what this step adds. */
export interface Beat {
  step: "look" | "cells" | "links" | "result";
  marks: Mark[];
}

/**
 * The move's drawing in narrated steps, each adding to the last: the unit frames, then the
 * pattern's rings, then its links, then what it removes or places. A step that would add nothing
 * is left out, except the first and the last. Moves drawn without rings (the singles) get one
 * round their answer, so there's a pattern step to point at. The last step holds every mark.
 */
export function beats(move: PatternMove, has: HasMark): Beat[] {
  const all = patternMarks(move, has);
  const p = move.placement;
  if (p && !all.some((m) => m.kind === "ring"))
    all.push({ kind: "ring", at: anchor(p.r, p.c, p.num), num: p.num, tone: "pattern" });
  const upTo: Record<Beat["step"], Mark["kind"][]> = {
    look: ["frame"],
    cells: ["frame", "ring"],
    links: ["frame", "ring", "line"],
    result: ["frame", "ring", "line", "cross", "place"],
  };
  const out: Beat[] = [];
  for (const step of ["look", "cells", "links", "result"] as const) {
    const marks = all.filter((m) => upTo[step].includes(m.kind));
    if (step === "look" || step === "result" || marks.length > out.at(-1)!.marks.length)
      out.push({ step, marks });
  }
  return out;
}
