import { describe, expect, it } from "vitest";

import { lessonFromExample } from "../utils/lesson";
import { anchor, patternMarks, type Mark, type Pt } from "../utils/patternMarks";
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
  });
});
