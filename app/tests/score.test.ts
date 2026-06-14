import { describe, it, expect } from "vitest";
import { computeScore, baseScore } from "../utils/score";

describe("score", () => {
  it("flawless fast win earns base + speed + flawless bonuses", () => {
    const s = computeScore({ difficulty: "medium", timeSeconds: 0, mistakes: 0, hintsUsed: 0 });
    expect(s.base).toBe(400);
    expect(s.speedBonus).toBe(200); // full 50% of base at t=0
    expect(s.flawlessBonus).toBe(100); // 25% of base
    expect(s.mistakePenalty).toBe(0);
    expect(s.hintPenalty).toBe(0);
    expect(s.total).toBe(700);
  });

  it("no speed bonus when slower than par, and no penalty", () => {
    const s = computeScore({ difficulty: "easy", timeSeconds: 99999, mistakes: 0, hintsUsed: 0 });
    expect(s.speedBonus).toBe(0);
    expect(s.total).toBe(s.base + s.flawlessBonus);
  });

  it("mistakes and hints reduce score and cancel the flawless bonus", () => {
    const clean = computeScore({
      difficulty: "hard",
      timeSeconds: 99999,
      mistakes: 0,
      hintsUsed: 0,
    });
    const messy = computeScore({
      difficulty: "hard",
      timeSeconds: 99999,
      mistakes: 2,
      hintsUsed: 3,
    });
    expect(messy.flawlessBonus).toBe(0);
    expect(messy.mistakePenalty).toBe(Math.round(2 * 700 * 0.1));
    expect(messy.hintPenalty).toBe(Math.round(3 * 700 * 0.05));
    expect(messy.total).toBeLessThan(clean.total);
  });

  it("total never drops below 10% of base", () => {
    const s = computeScore({
      difficulty: "beginner",
      timeSeconds: 99999,
      mistakes: 99,
      hintsUsed: 99,
    });
    expect(s.total).toBe(Math.round(baseScore("beginner") * 0.1));
  });

  it("harder difficulty has a higher base reward", () => {
    expect(baseScore("master")).toBeGreaterThan(baseScore("expert"));
    expect(baseScore("expert")).toBeGreaterThan(baseScore("medium"));
    expect(baseScore("medium")).toBeGreaterThan(baseScore("beginner"));
  });

  it("unknown difficulty falls back to custom base", () => {
    expect(baseScore("nonsense")).toBe(baseScore("custom"));
  });
});
