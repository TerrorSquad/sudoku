import { describe, expect, it } from "vitest";

import en from "../../i18n/locales/en.json";
import rs from "../../i18n/locales/rs.json";

// Flat dot-keys (CLAUDE.md, i18n): a key or {placeholder} missing from one locale shows the raw key
// or a literal "{n}" to that locale's players.
// A set: a translation may repeat a placeholder or name it only once ("{num} ... it").
const placeholders = (s: string) =>
  [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].toSorted();

describe("locales", () => {
  it("en and rs have the same keys", () => {
    expect(Object.keys(rs).toSorted()).toEqual(Object.keys(en).toSorted());
  });

  it("every key has the same placeholders in both", () => {
    const rsMap = rs as Record<string, string>;
    const diff = Object.entries(en as Record<string, string>)
      .filter(
        ([k, v]) => k in rsMap && placeholders(v).join() !== placeholders(rsMap[k] ?? "").join(),
      )
      .map(([k]) => k);
    expect(diff).toEqual([]);
  });

  it("no value is empty", () => {
    const empty = [...Object.entries(en), ...Object.entries(rs)]
      .filter(([, v]) => typeof v !== "string" || !v.trim())
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });
});
