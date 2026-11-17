import { describe, expect, it } from "vitest";

import type { Lesson } from "../utils/lesson";

import en from "../../i18n/locales/en.json";
import { lineKind, narrate, sees } from "../utils/explain";
import {
  findPrompt,
  guideOf,
  guideUnits,
  instancesOf,
  lessonFromExample,
  missReason,
  shuffleLesson,
  turnFor,
} from "../utils/lesson";
import { ACADEMY_TECHNIQUES } from "../utils/progression";
import { makeRng } from "../utils/sudokuCore";

const messages = en as Record<string, string>;
const t = (key: string, params: Record<string, unknown> = {}) =>
  (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
// Colour mode's renderer: a digit as a word, so a sentence must never start with it.
const colour = (n: number) => `colour${n}`;

describe("narrate", () => {
  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`tells ${id}'s Academy example with its real lines`, () => {
      const L = lessonFromExample(id)!;
      const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
      const lines = narrate(L.move, has, t, colour);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]!.step).toBe("cells");
      expect(lines.at(-1)!.step).toBe("result");
      // Beats in order: the cells, then their links, then the result.
      const order = lines.map((s) => ["cells", "links", "result"].indexOf(s.step));
      expect(order).toEqual(order.toSorted((a, b) => a - b));
      for (const { text } of lines) {
        expect(text).not.toMatch(/[{}]|explain\./);
        expect(text).not.toMatch(/^colour/);
        expect(text).toMatch(/^[A-Z]/);
      }
      // The answer is named by its row and column.
      const all = lines.map((s) => s.text).join(" ");
      const at = L.placement ?? L.eliminations[0]!;
      expect(all).toMatch(new RegExp(`row ${at.r + 1}\\b[^.]*column|column ${at.c + 1}`));
    });
  }

  it("says whether a pattern is built on rows or on columns", () => {
    for (const id of ["x-wing", "swordfish", "skyscraper", "pointing", "box-line"] as const) {
      const L = lessonFromExample(id)!;
      const kind = lineKind(L.move);
      expect(kind).toMatch(/^(row|col)$/);
      const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
      expect(narrate(L.move, has, t, String)[0]!.text).toContain(kind === "row" ? "row" : "column");
    }
    expect(lineKind(lessonFromExample("xy-wing")!.move)).toBeNull();
  });
});

// ---- Fact-checking: every checkable claim of a sentence against the lesson's pencil marks ----

const nums = (s: string) => [...s.matchAll(/\d/g)].map((m) => Number(m[0]));
const cellsIn = (s: string) =>
  [...s.matchAll(/row (\d), column (\d)/g)].map((m) => ({
    r: Number(m[1]) - 1,
    c: Number(m[2]) - 1,
  }));
type K = "row" | "col" | "box";
const KIND: Record<string, K> = {
  row: "row",
  column: "col",
  box: "box",
  rows: "row",
  columns: "col",
};
const lineCell = (k: K, n: number, i: number) =>
  k === "row"
    ? { r: n - 1, c: i }
    : k === "col"
      ? { r: i, c: n - 1 }
      : { r: Math.floor((n - 1) / 3) * 3 + Math.floor(i / 3), c: ((n - 1) % 3) * 3 + (i % 3) };
const key = (p: { r: number; c: number }) => `${p.r}-${p.c}`;

/** The claims a sentence makes that the marks can settle; throws on a false one. Returns whether it checked anything. */
function factCheck(L: Lesson, text: string, all: string[] = []): boolean {
  const marks = (p: { r: number; c: number }) => L.notes[p.r]![p.c]!;
  const spots = (k: K, n: number, d: number) =>
    Array.from({ length: 9 }, (_, i) => lineCell(k, n, i)).filter((p) => marks(p).includes(d));
  // Spots named relative to their line: "columns 3 and 8" in a row, "rows" in a column, cells in a box.
  const named = (k: K, n: number, list: string) =>
    k === "box" ? cellsIn(list) : nums(list).map((i) => lineCell(k, n, i - 1));
  const same = (a: { r: number; c: number }[], b: { r: number; c: number }[]) =>
    expect(a.map(key).toSorted()).toEqual(b.map(key).toSorted());
  let m;
  if (
    (m = /^In (row|column|box) (\d), (\d) has only (two spots|one spot left): (.+)\.$/.exec(text))
  ) {
    const k = KIND[m[1]!]!;
    const n = Number(m[2]);
    const list = m[5]!;
    same(
      spots(k, n, Number(m[3])),
      k === "box" || /row \d, column/.test(list) ? cellsIn(list) : named(k, n, list),
    );
    return true;
  }
  if (
    (m = /^In box (\d), (\d) can only go in (row|column) (\d) \((columns|rows) (.+)\)\.$/.exec(
      text,
    ))
  ) {
    const k = KIND[m[3]!]!;
    same(spots("box", Number(m[1]), Number(m[2])), named(k, Number(m[4]), m[6]!));
    return true;
  }
  if (
    (m = /^In (row|column) (\d), (\d) can only go in box (\d) \((columns|rows) (.+)\)\.$/.exec(
      text,
    ))
  ) {
    const k = KIND[m[1]!]!;
    const n = Number(m[2]);
    const s = spots(k, n, Number(m[3]));
    same(s, named(k, n, m[6]!));
    for (const p of s) expect(Math.floor(p.r / 3) * 3 + Math.floor(p.c / 3) + 1).toBe(Number(m[4]));
    return true;
  }
  if (
    (m =
      /^In (rows|columns) ([\d, and]+), (\d) can only go in (columns|rows) ([\d, and]+?)(, apart from the fin at (.+) in box (\d))?\.$/.exec(
        text,
      ))
  ) {
    const k = KIND[m[1]!]!;
    const d = Number(m[3]);
    const cover = nums(m[5]!);
    const fins = m[7] ? cellsIn(m[7]) : [];
    for (const n of nums(m[2]!))
      for (const p of spots(k, n, d)) {
        const across = k === "row" ? p.c + 1 : p.r + 1;
        expect(cover.includes(across) || fins.some((f) => key(f) === key(p))).toBe(true);
      }
    for (const f of fins) expect(marks(f)).toContain(d);
    return true;
  }
  if ((m = /^In box (\d), (\d) can only go in row (\d) or column (\d)\.$/.exec(text))) {
    for (const p of spots("box", Number(m[1]), Number(m[2])))
      expect(p.r + 1 === Number(m[3]) || p.c + 1 === Number(m[4])).toBe(true);
    return true;
  }
  if (
    (m =
      /^In (row|column|box) (\d), the cells (?:in (?:columns|rows)|at) (.+) hold only (.+) between them\.$/.exec(
        text,
      ))
  ) {
    const k = KIND[m[1]!]!;
    const cells = named(k, Number(m[2]), m[3]!);
    expect(new Set(cells.flatMap(marks))).toEqual(new Set(nums(m[4]!)));
    return true;
  }
  if (
    (m =
      /^In (row|column|box) (\d), ([\d, and]+) can only go (?:in (?:columns|rows)|at) (.+)\.$/.exec(
        text,
      ))
  ) {
    const k = KIND[m[1]!]!;
    const n = Number(m[2]);
    const ds = nums(m[3]!);
    const holders = Array.from({ length: 9 }, (_, i) => lineCell(k, n, i)).filter((p) =>
      marks(p).some((x) => ds.includes(x)),
    );
    same(holders, named(k, n, m[4]!));
    return true;
  }
  if (
    (m =
      /^(?:The cells at|The pivot at) (.+?) (?:both )?holds? (only )?([\d, and]+?)(?:, and don't see each other)?\.$/.exec(
        text,
      ))
  ) {
    const ds = nums(m[3]!);
    for (const p of cellsIn(m[1]!)) expect(marks(p).toSorted()).toEqual(ds.toSorted());
    return true;
  }
  if (
    (m =
      /^It sees two pincers: (row \d, column \d), with (\d) or (\d), and (row \d, column \d), with (\d) or (\d)\.$/.exec(
        text,
      ))
  ) {
    expect(marks(cellsIn(m[1]!)[0]!).toSorted()).toEqual([Number(m[2]), Number(m[3])].toSorted());
    expect(marks(cellsIn(m[4]!)[0]!).toSorted()).toEqual([Number(m[5]), Number(m[6])].toSorted());
    return true;
  }
  if (
    (m = /^Every empty cell has two candidates except the one at (.+), which has three\.$/.exec(
      text,
    ))
  ) {
    const odd = cellsIn(m[1]!)[0]!;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!L.board[r]![c])
          expect(marks({ r, c }).length).toBe(r === odd.r && c === odd.c ? 3 : 2);
    return true;
  }
  if (
    (m =
      /^The cell in row (\d), column (\d) sees every digit but (\d) in its row, column or box\.$/.exec(
        text,
      ))
  ) {
    const p = { r: Number(m[1]) - 1, c: Number(m[2]) - 1 };
    const seen = new Set<number>();
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (L.board[r]![c] && sees(p, { r, c })) seen.add(L.board[r]![c]!);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !seen.has(n))).toEqual([Number(m[3])]);
    return true;
  }
  if (
    (m =
      /^Following the rows, columns and boxes where (\d) has only two spots links (\d) cells/.exec(
        text,
      ))
  ) {
    const link = all.find((s) => s.includes("One set:"))!;
    const [, a, b] = /One set: (.+)\. The other: (.+)\.$/.exec(link)!;
    const [A, B] = [cellsIn(a!), cellsIn(b!)];
    const d = Number(m[1]);
    expect(A.length + B.length).toBe(Number(m[2]));
    // Each chain cell has a strong link (a unit where d has two spots) to a cell of the other set.
    const unitNo = (k: K, p: { r: number; c: number }) =>
      k === "row"
        ? p.r + 1
        : k === "col"
          ? p.c + 1
          : Math.floor(p.r / 3) * 3 + Math.floor(p.c / 3) + 1;
    for (const [mine, other] of [
      [A, B],
      [B, A],
    ] as const)
      for (const p of mine) {
        const linked = other.some((q) =>
          (["row", "col", "box"] as K[]).some((k) => {
            const s = spots(k, unitNo(k, p), d);
            return (
              s.length === 2 && s.some((x) => key(x) === key(q)) && s.some((x) => key(x) === key(p))
            );
          }),
        );
        expect(linked).toBe(true);
      }
    return true;
  }
  if (
    (m = /^Each of these cells holds only two candidates and sees the next: (.+)\.$/.exec(text))
  ) {
    const chain = cellsIn(m[1]!);
    chain.forEach((p, i) => {
      expect(marks(p).length).toBe(2);
      if (i) expect(sees(chain[i - 1]!, p)).toBe(true);
    });
    return true;
  }
  if ((m = /^Row (\d)'s spot and row (\d)'s spot in column (\d) see each other/.exec(text))) {
    for (const r of [m[1], m[2]])
      expect(marks({ r: Number(r) - 1, c: Number(m[3]) - 1 })).toBeTruthy();
    return true;
  }
  if (
    (m = /^(?:Any cell that sees both(?: sets)? can't be|So no other cell .* can be) (\d)[:.]/.exec(
      text,
    ))
  ) {
    for (const p of cellsIn(text.slice(text.indexOf(":"))))
      expect(marks(p)).toContain(Number(m[1]));
    return true;
  }
  return false;
}

describe("narrate's facts", () => {
  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`${id}: every checkable claim holds on the example's marks, and on its shuffles`, () => {
      expect.hasAssertions();
      const base = lessonFromExample(id)!;
      for (const L of [base, ...[1, 2, 3].map((s) => shuffleLesson(base, makeRng(s)))]) {
        const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
        const lines = narrate(L.move, has, t, String);
        const texts = lines.map((s) => s.text);
        // The pattern's own sentences all state checkable facts.
        for (const s of lines) {
          let checked = false;
          try {
            checked = factCheck(L, s.text, texts);
          } catch (e) {
            throw new Error(`${s.text}\n${(e as Error).message}`, { cause: e });
          }
          // The pattern's own sentences all state checkable facts.
          if (s.step === "cells") expect([s.text, checked]).toEqual([s.text, true]);
        }
      }
    });
  }
});

describe("missReason's facts", () => {
  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`${id}: counts and lists in a reason match the marks`, () => {
      const base = lessonFromExample(id)!;
      // A pattern cell gets no reason at all.
      expect(missReason(base, base.pattern[0]!).key).toBe("lesson.miss");
      // Transposed as well, as a lesson level may (turnFor).
      for (const L of [
        base,
        shuffleLesson(base, makeRng(7)),
        shuffleLesson(base, makeRng(8), true),
      ]) {
        for (let i = 0; i < 81; i++) {
          const p = { r: Math.floor(i / 9), c: i % 9 };
          const why = missReason(L, p);
          const q = why.params ?? {};
          const d = Number(q.d ?? L.digits[0]);
          const count = (k: K) =>
            Array.from({ length: 9 }, (_, j) =>
              lineCell(
                k,
                k === "row"
                  ? p.r + 1
                  : k === "col"
                    ? p.c + 1
                    : Math.floor(p.r / 3) * 3 + Math.floor(p.c / 3) + 1,
                j,
              ),
            ).filter((x) => L.notes[x.r]![x.c]!.includes(d));
          if (typeof q.row === "number") expect(q.row).toBe(count("row").length);
          if (typeof q.col === "number") expect(q.col).toBe(count("col").length);
          if (typeof q.box === "number") expect(q.box).toBe(count("box").length);
          if (Array.isArray(q.cols)) expect(q.cols).toEqual(count("row").map((x) => x.c + 1));
          if (Array.isArray(q.rows)) expect(q.rows).toEqual(count("col").map((x) => x.r + 1));
          if (why.key === "lesson.why.urMarks" || why.key === "lesson.why.noPincers")
            expect(q.marks).toEqual(L.notes[p.r]![p.c]);
          if (why.key.endsWith("Marks") && typeof q.n === "number")
            expect(q.n).toBe(L.notes[p.r]![p.c]!.length);
          if (/^lesson\.why\.(skyLine|linkLine)\./.test(why.key)) {
            const k = why.key.endsWith("row") ? "row" : "col";
            expect(q.at).toEqual(count(k).map((x) => (k === "row" ? x.c : x.r) + 1));
            expect(q.n).toBe(count(k).length);
          }
        }
      }
    });
  }
});

describe("lesson levels", () => {
  const way = (L: Lesson) =>
    lineKind(L.move) ?? (L.unit && L.unit.kind !== "box" ? L.unit.kind : null);
  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`${id}: levels 1 and 2 go on rows, then columns, and still tell the truth`, () => {
      const base = lessonFromExample(id)!;
      for (const level of [1, 2] as const)
        for (const seed of [1, 2]) {
          const L = shuffleLesson(base, makeRng(seed), turnFor(base, level));
          if (way(base)) expect(way(L)).toBe(level === 1 ? "row" : "col");
          const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
          const lines = narrate(L.move, has, t, String);
          const texts = lines.map((s) => s.text);
          for (const s of lines) factCheck(L, s.text, texts);
          const prompt = findPrompt(L, t, String, level);
          expect(prompt).not.toMatch(/[{}]|lesson\./);
          if (guideOf(id, level) !== "marked") continue;
          // It names the lines it marks, and none across a pattern built along the other way.
          const units = guideUnits(L);
          expect(units.length).toBeGreaterThan(0);
          if (lineKind(L.move))
            expect(prompt).not.toMatch(level === 1 ? /\bcolumns?\b/ : /\brows?\b/);
          for (const u of units) {
            const n = u.kind === "row" ? u.r + 1 : u.kind === "col" ? u.c + 1 : 0;
            if (n)
              expect(prompt).toMatch(
                new RegExp(`${u.kind === "row" ? "row" : "column"}s? [^.]*\\b${n}\\b`),
              );
          }
        }
      // On your own: no line, box or digit named.
      const own = findPrompt(base, t, String, 3).replace(t(`hint.move.${id}.name`), "");
      expect(own).toMatch(/^On your own/);
      expect(own).not.toMatch(/\b(rows?|columns?|box(es)?)\b|\d/);
    });
  }

  it("level 2 of a pattern built along lines tells it with columns", () => {
    for (const id of ["x-wing", "swordfish", "skyscraper", "pointing", "box-line"] as const) {
      const base = lessonFromExample(id)!;
      const L = shuffleLesson(base, makeRng(3), turnFor(base, 2));
      const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
      expect(lineKind(L.move)).toBe("col");
      expect(narrate(L.move, has, t, String)[0]!.text).toContain("column");
      expect(findPrompt(L, t, String, 2)).toMatch(/\bcolumns? \d/);
    }
  });
});

describe("narrate's facts on level 3's other instances", () => {
  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`${id}: each instance a player may find instead is told truly`, () => {
      const L = lessonFromExample(id)!;
      const has = (r: number, c: number, n: number) => !!L.notes[r]?.[c]?.includes(n);
      for (const inst of instancesOf(L, 3).slice(1, 8)) {
        const lines = narrate(inst.move, has, t, String);
        const texts = lines.map((s) => s.text);
        for (const s of lines) {
          expect(s.text).not.toMatch(/[{}]|explain\./);
          try {
            factCheck(L, s.text, texts);
          } catch (e) {
            throw new Error(`${s.text}\n${(e as Error).message}`, { cause: e });
          }
        }
      }
    });
  }
});
