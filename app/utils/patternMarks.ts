// A technique's pattern drawn the way puzzle books draw it: lines that join the actual pencil marks
// (strong links solid, weak links and cover lines dashed), rings round the marks that matter, a
// frame round the unit, a red-pen stroke through each mark it removes and a circle round the digit
// it places. Pure, in board units (a cell is 1×1, the board 9×9); PatternOverlay.vue draws it.
// Unit-tested in tests/patternMarks.test.ts.

import type { CellRC, DigitAt, SolveMove } from "./sudokuGrader";

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

export type PatternMove = Pick<
  SolveMove,
  "technique" | "triggers" | "eliminations" | "placement" | "digits" | "unit"
>;
/** Whether (r, c) has pencil mark n; empty or filled cells have none. */
export type HasMark = (r: number, c: number, n: number) => boolean;

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
const same = (a: CellRC, b: CellRC) => a.r === b.r && a.c === b.c;
const uniq = (cells: CellRC[]) =>
  cells.filter((p, i) => cells.findIndex((q) => same(p, q)) === i).map(({ r, c }) => ({ r, c }));
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

// Finned X-Wing: find the two cover lines whose leftovers (the fins) share the eliminations' box.
function finned(move: PatternMove, n: number, reach: boolean): Mark[] {
  const t = uniq(move.triggers);
  const elims = move.eliminations;
  const elimBox = elims[0] ? box(elims[0]) : -1;
  for (const key of ["c", "r"] as const) {
    const lines = [...new Set(t.map((p) => p[key]))];
    for (const a of lines)
      for (const b of lines) {
        if (b <= a) continue;
        const corners = t.filter((p) => p[key] === a || p[key] === b);
        const fins = t.filter((p) => p[key] !== a && p[key] !== b);
        if (!fins.length || fins.some((f) => box(f) !== elimBox)) continue;
        if (elims.some((e) => e[key] !== a && e[key] !== b)) continue;
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
      return finned(move, n, result);
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

/** `has` for a notes grid as SudokuGrid holds it (notes[r][c][n]). */
export const hasFromNotes =
  (notes: boolean[][][]): HasMark =>
  (r, c, n) =>
    !!notes[r]?.[c]?.[n];
