import { describe, it, expect } from "vitest";

import { masteryFor } from "../utils/mastery";

describe("masteryFor", () => {
  it("steps at 1, 5 and 15", () => {
    expect([0, 1, 4, 5, 14, 15, 99].map(masteryFor)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
