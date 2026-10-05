import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import rs from "../../i18n/locales/rs.json";
import { SUDOKU_COLORS, dotClass } from "../utils/sudokuColors";

describe("colour mode palette", () => {
  it("gives every digit a distinct colour and a name in both locales", () => {
    const colours = SUDOKU_COLORS.slice(1);
    expect(new Set(colours).size).toBe(9);
    for (let n = 1; n <= 9; n++) {
      expect((en as Record<string, string>)[`colors.${n}`]).toBeTruthy();
      expect((rs as Record<string, string>)[`colors.${n}`]).toBeTruthy();
    }
  });

  it("adds a shape cue in groups of three", () => {
    expect(dotClass(1)).toContain("rounded-full");
    expect(dotClass(4)).toContain("rounded-md");
    expect(dotClass(9)).toContain("clip-path");
  });
});
