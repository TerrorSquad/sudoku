import { describe, it, expect } from "vitest";

import { starsFor } from "../utils/stars";

describe("starsFor", () => {
  it("awards 3 for a clean solve", () => expect(starsFor(0, 0)).toBe(3));
  it("awards 2 for a near-clean solve", () => {
    expect(starsFor(1, 0)).toBe(2);
    expect(starsFor(0, 2)).toBe(2);
    expect(starsFor(1, 2)).toBe(2);
  });
  it("awards 1 otherwise", () => {
    expect(starsFor(2, 0)).toBe(1);
    expect(starsFor(0, 3)).toBe(1);
    expect(starsFor(3, 9)).toBe(1);
  });
});
