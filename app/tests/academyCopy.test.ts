import { describe, it, expect } from "vitest";

import en from "../../i18n/locales/en.json";
import rs from "../../i18n/locales/rs.json";
import { ACADEMY_TECHNIQUES } from "../utils/progression";

const locales = { en, rs } as Record<string, Record<string, string>>;

describe("Academy technique copy", () => {
  it("every technique has spot steps, why and tips in both locales, matching in shape", () => {
    for (const { id } of ACADEMY_TECHNIQUES) {
      const k = (part: string) => `academy.tech.${id}.${part}`;
      for (const [name, l] of Object.entries(locales)) {
        const where = `${name} ${id}`;
        // oxlint-disable-next-line vitest/valid-expect
        expect(l[k("spot")]?.split("\n").length, where).toBeGreaterThanOrEqual(2);
        // oxlint-disable-next-line vitest/valid-expect
        expect(l[k("spot")]!.split("\n").length, where).toBeLessThanOrEqual(4);
        // oxlint-disable-next-line vitest/valid-expect
        expect(l[k("why")], where).toBeTruthy();
        // oxlint-disable-next-line vitest/valid-expect
        expect(l[k("tips")]?.split("\n").length, where).toBeLessThanOrEqual(2);
        // Colour mode words digits, so no line opens with a numeral; "|" would be a plural.
        for (const part of ["spot", "why", "tips", "aka"])
          for (const line of l[k(part)]?.split("\n") ?? []) {
            // oxlint-disable-next-line vitest/valid-expect
            expect(line, where).not.toMatch(/^\d|\||^\s|\s$/);
          }
      }
      for (const part of ["spot", "tips"])
        // oxlint-disable-next-line vitest/valid-expect
        expect(locales.en![k(part)]!.split("\n").length, id).toBe(
          locales.rs![k(part)]!.split("\n").length,
        );
      // The aka line is optional, but both locales show it or neither does.
      // oxlint-disable-next-line vitest/valid-expect
      expect(k("aka") in en, id).toBe(k("aka") in rs);
    }
  });
});
