import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import rs from "../../i18n/locales/rs.json";
import { migrateTechniqueStats } from "../composables/useTechniqueStats";

describe("migrateTechniqueStats", () => {
  it("re-keys titles from both languages by technique id, summing them", () => {
    expect(
      migrateTechniqueStats({ "Naked Single": 3, "Goli singl": 2, "X-Wing": 1, "pointing": 4, "Pokazujući par": 1 }),
    ).toEqual({ "naked-single": 5, "x-wing": 1, pointing: 5 });
  });

  it("keeps a key it can't map instead of dropping it", () => {
    expect(migrateTechniqueStats({ "Hidden Single — Row": 2, "Naked Pair": 1 })).toEqual({
      "Hidden Single — Row": 2,
      "naked-pair": 1,
    });
  });

  it("maps every technique title either locale shows", () => {
    for (const locale of [en, rs] as Record<string, string>[]) {
      const titles = Object.entries(locale).filter(([k]) => /^hint\.move\.[a-z-]+\.name$/.test(k));
      expect(titles.length).toBeGreaterThan(0);
      for (const [key, title] of titles) {
        const id = key.split(".")[2]!;
        expect(migrateTechniqueStats({ [title]: 1 })).toEqual({ [id]: 1 });
      }
    }
  });
});
