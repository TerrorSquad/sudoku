import { describe, expect, it } from "vitest";

import en from "../../i18n/locales/en.json";
import { lineKind, narrate } from "../utils/explain";
import { lessonFromExample } from "../utils/lesson";
import { ACADEMY_TECHNIQUES } from "../utils/progression";

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
