import { describe, expect, it } from "vitest";

import { lessonFromExample } from "../utils/lesson";
import { anchor, beats, patternMarks, type Mark, type Pt } from "../utils/patternMarks";
import { ACADEMY_TECHNIQUES } from "../utils/progression";

const inBoard = ({ x, y }: Pt) => x > 0 && x < 9 && y > 0 && y < 9;
const points = (m: Mark): Pt[] =>
  m.kind === "line" ? [m.a, m.b] : m.kind === "frame" ? [] : [m.at];

describe("patternMarks", () => {
  it("anchors a mark in its 3×3 pencil-mark slot", () => {
    expect(anchor(0, 0, 1)).toEqual({ x: 1 / 6, y: 1 / 6 });
    expect(anchor(8, 8, 9)).toEqual({ x: 8 + 5 / 6, y: 8 + 5 / 6 });
  });

  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`draws ${id} from its Academy example`, () => {
      const lesson = lessonFromExample(id)!;
      const has = (r: number, c: number, n: number) => !!lesson.notes[r]?.[c]?.includes(n);
      const marks = patternMarks(lesson.move, has);
      expect(marks.length).toBeGreaterThan(0);
      for (const m of marks) for (const p of points(m)) expect(inBoard(p)).toBe(true);
      // Every removal is struck through and every placement circled.
      expect(marks.filter((m) => m.kind === "cross")).toHaveLength(lesson.eliminations.length);
      expect(marks.some((m) => m.kind === "place")).toBe(!!lesson.placement);
      // Every technique past the singles draws its pattern, not just the result.
      if (!["naked-single", "hidden-single", "bug-plus-one"].includes(id))
        expect(marks.some((m) => m.kind === "line" || m.kind === "ring")).toBe(true);
    });
  }

  for (const { id } of ACADEMY_TECHNIQUES) {
    it(`steps through ${id}'s example (Watch it), ending on the full drawing`, () => {
      const lesson = lessonFromExample(id)!;
      const has = (r: number, c: number, n: number) => !!lesson.notes[r]?.[c]?.includes(n);
      const steps = beats(lesson.move, has);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps[0]!.step).toBe("look");
      expect(steps.at(-1)!.step).toBe("result");
      // Each step adds to the last, and the last holds every mark of the static drawing.
      for (let i = 1; i < steps.length; i++)
        expect(steps[i]!.marks).toEqual(expect.arrayContaining(steps[i - 1]!.marks));
      expect(steps.at(-1)!.marks).toEqual(expect.arrayContaining(patternMarks(lesson.move, has)));
    });
  }

  it("draws an X-Wing as two solid base lines and two dashed cover lines", () => {
    const corners = [
      { r: 1, c: 2 },
      { r: 1, c: 6 },
      { r: 5, c: 2 },
      { r: 5, c: 6 },
    ];
    const marks = patternMarks(
      {
        technique: "x-wing",
        triggers: corners,
        eliminations: [{ r: 7, c: 2, num: 4 }],
        digits: [4],
      },
      () => true,
    );
    const lines = marks.filter((m) => m.kind === "line");
    expect(lines.filter((l) => l.style === "strong")).toHaveLength(2);
    expect(lines.filter((l) => l.style === "weak")).toHaveLength(2);
    // The cover line on column 3 reaches down to the removal in row 8.
    expect(lines).toContainEqual({
      kind: "line",
      a: anchor(1, 2, 4),
      b: anchor(7, 2, 4),
      style: "weak",
    });

    // Before the result is shown: no crosses, and the cover line stops at the corners.
    const pattern = patternMarks(
      {
        technique: "x-wing",
        triggers: corners,
        eliminations: [{ r: 7, c: 2, num: 4 }],
        digits: [4],
      },
      () => true,
      false,
    );
    expect(pattern.some((m) => m.kind === "cross")).toBe(false);
    expect(pattern).toContainEqual({
      kind: "line",
      a: anchor(1, 2, 4),
      b: anchor(5, 2, 4),
      style: "weak",
    });
  });

  it("draws an Empty Rectangle: its box, the link solid, and dashed lines to the box and the removal", () => {
    // 3 in box 9 sits on row 8 and column 7; row 1 holds it only at columns 5 and 7.
    const move = {
      technique: "empty-rectangle" as const,
      triggers: [
        { r: 0, c: 6 },
        { r: 0, c: 4 },
        { r: 6, c: 6 },
        { r: 7, c: 7 },
        { r: 8, c: 6 },
      ],
      eliminations: [{ r: 7, c: 4, num: 3 }],
      digits: [3],
    };
    const marks = patternMarks(move, () => true);
    expect(marks).toContainEqual({ kind: "frame", x: 6, y: 6, w: 3, h: 3 });
    const lines = marks.filter((m) => m.kind === "line");
    expect(lines).toEqual([
      { kind: "line", a: anchor(0, 6, 3), b: anchor(0, 4, 3), style: "strong" },
      // The near end down its column to the box's nearest cell on it.
      { kind: "line", a: anchor(0, 6, 3), b: anchor(6, 6, 3), style: "weak" },
      // The far end down to the cell it loses 3 from.
      { kind: "line", a: anchor(0, 4, 3), b: anchor(7, 4, 3), style: "weak" },
    ]);
    expect(marks.filter((m) => m.kind === "ring")).toHaveLength(5);
    // Before the result: no line reaching the removal.
    expect(patternMarks(move, () => true, false).filter((m) => m.kind === "line")).toHaveLength(2);
  });

  it("draws a colouring wrap's whole chain, the cleared colour in the second tone", () => {
    // 4 sits only in these cells: A–B (row 1), B–C (column 5), C–D (row 5) are strong links.
    const [A, B, C, D] = [
      { r: 0, c: 0 },
      { r: 0, c: 4 },
      { r: 4, c: 4 },
      { r: 4, c: 8 },
    ];
    const chain = [A, B, C, D];
    const has = (r: number, c: number, n: number) =>
      n === 4 && chain.some((p) => p.r === r && p.c === c);
    // The grader keeps the surviving colour (B, D) as triggers and clears the other (A, C).
    const marks = patternMarks(
      {
        technique: "simple-coloring",
        triggers: [B!, D!],
        eliminations: [A!, C!].map((p) => ({ ...p, num: 4 })),
        digits: [4],
      },
      has,
    );
    expect(marks.filter((m) => m.kind === "line")).toHaveLength(3);
    const tone = (p: { r: number; c: number }) =>
      marks.find(
        (m) =>
          m.kind === "ring" && m.at.x === anchor(p.r, p.c, 4).x && m.at.y === anchor(p.r, p.c, 4).y,
      );
    expect([B, D].map((p) => tone(p!))).toEqual([
      expect.objectContaining({ tone: "pattern" }),
      expect.objectContaining({ tone: "pattern" }),
    ]);
    expect([A, C].map((p) => tone(p!))).toEqual([
      expect.objectContaining({ tone: "alt" }),
      expect.objectContaining({ tone: "alt" }),
    ]);
    expect(marks.filter((m) => m.kind === "cross")).toHaveLength(2);
  });
});
