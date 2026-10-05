import { describe, it, expect } from "vitest";

import { levelBand, levelFor } from "../utils/level";

describe("level curve", () => {
  it("starts at level 1 with no score", () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, span: 500, progress: 0 });
    expect(levelFor(-50).level).toBe(1);
  });

  it("levels up exactly on the threshold", () => {
    expect(levelFor(499).level).toBe(1);
    expect(levelFor(500).level).toBe(2);
    expect(levelFor(1499).level).toBe(2);
    expect(levelFor(1500).level).toBe(3);
    expect(levelFor(3000).level).toBe(4);
  });

  it("reports progress inside the current level", () => {
    const info = levelFor(1000); // halfway from L2 (500) to L3 (1500)
    expect(info).toMatchObject({ level: 2, into: 500, span: 1000, progress: 0.5 });
  });

  it("maps levels to title bands", () => {
    expect(levelBand(1)).toBe("novice");
    expect(levelBand(3)).toBe("apprentice");
    expect(levelBand(5)).toBe("adept");
    expect(levelBand(8)).toBe("expert");
    expect(levelBand(12)).toBe("master");
  });
});
