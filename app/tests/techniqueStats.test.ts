import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import rs from "../../i18n/locales/rs.json";
import { migrateTechniqueStats } from "../composables/useTechniqueStats";

describe("migrateTechniqueStats", () => {
  it("re-keys titles from both languages by technique id, summing them", () => {
    expect(
      migrateTechniqueStats({
        "Naked Single": 3,
        "Goli singl": 2,
        "X-Wing": 1,
        pointing: 4,
        "Pokazujući par": 1,
      }),
    ).toEqual({ "naked-single": 5, "x-wing": 1, pointing: 5 });
  });

  it("keeps a key it can't map instead of dropping it", () => {
    expect(migrateTechniqueStats({ "Sue de Coq": 2, "Naked Pair": 1 })).toEqual({
      "Sue de Coq": 2,
      "naked-pair": 1,
    });
  });

  it("maps the titles of earlier versions, unit suffixes and all", () => {
    const legacy: Record<string, string> = {
      "Hidden Single — Row": "hidden-single",
      "Hidden Single — Column": "hidden-single",
      "Hidden Single — Box": "hidden-single",
      "Skriveni Singl — Red": "hidden-single",
      "Skriveni Singl — Kolona": "hidden-single",
      "Skriveni Singl — Kvadrant": "hidden-single",
      "Naked Pair — Row": "naked-pair",
      "Naked Pair — Column": "naked-pair",
      "Naked Pair — Box": "naked-pair",
      "Goli Par — Kvadrant": "naked-pair",
      "Pointing Pair — Row": "pointing",
      "Pointing Pair — Column": "pointing",
      "Empty Rectangle": "empty-rectangle",
      "Prazan Pravougaonik": "empty-rectangle",
      "XY-Chain (length 5)": "xy-chain",
      "XY-Chain (Lanac dužine 4)": "xy-chain",
      "Pokazujući Par — Kolona": "pointing",
      "Box-Line Reduction — Row": "box-line",
      "Redukcija Kvadrant-Linija — Kolona": "box-line",
      "Goli Singl": "naked-single",
      "Skriveni Par": "hidden-pair",
      "Naked Triple — Row 3": "naked-triple",
      "Goli Triplet — Red 3": "naked-triple",
      "Skriveni Triplet — Kolona 2": "hidden-triple",
      "Skriveni Kvadrupl — Kvadrant 5": "hidden-quad",
      Meduza: "jellyfish",
      Sabljarka: "swordfish",
      Neboder: "skyscraper",
      "Two-String Kite": "two-string-kite",
      "Zmaj sa Dva Konca": "two-string-kite",
      "Unique Rectangle — Type 1": "unique-rectangle",
      "Jedinstveni Pravougaonik — Tip 2": "unique-rectangle",
    };
    for (const [title, id] of Object.entries(legacy)) {
      // Vitest takes a failure message as the second argument; it names the title that broke.
      // oxlint-disable-next-line vitest/valid-expect
      expect(migrateTechniqueStats({ [title]: 1 }), title).toEqual({ [id]: 1 });
    }
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
