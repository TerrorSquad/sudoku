import { describe, it, expect } from "vitest";

import { masteryFor } from "../utils/mastery";

describe("masteryFor", () => {
  it("steps at 1, 5 and 15", () => {
    expect([0, 1, 4, 5, 14, 15, 99].map((n) => masteryFor(n))).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it("a finished lesson makes it familiar, a 3-star one practised; level 1 alone never fluent", () => {
    expect([1, 2, 3].map((s) => masteryFor(0, s))).toEqual([1, 1, 2]);
    expect(masteryFor(20, 1)).toBe(3);
    expect(masteryFor(6, 3)).toBe(2);
  });

  it("counts the lesson's levels: the second practised, the third (on your own) fluent", () => {
    expect(masteryFor(0, 1, 1)).toBe(1);
    expect(masteryFor(0, 1, 2)).toBe(2);
    expect(masteryFor(0, 1, 3)).toBe(3);
    expect(masteryFor(20, 1, 1)).toBe(3);
  });
});
