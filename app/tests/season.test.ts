import { describe, expect, it } from "vitest";

import { seasonFor } from "../utils/season";

describe("seasonFor", () => {
  it("follows the local month, edges included", () => {
    expect(seasonFor(new Date(2026, 11, 1))).toBe("winter");
    expect(seasonFor(new Date(2027, 1, 28, 23, 59))).toBe("winter");
    expect(seasonFor(new Date(2026, 2, 1))).toBe("spring");
    expect(seasonFor(new Date(2026, 4, 31))).toBe("spring");
    expect(seasonFor(new Date(2026, 5, 1))).toBe("summer");
    expect(seasonFor(new Date(2026, 7, 31))).toBe("summer");
    expect(seasonFor(new Date(2026, 8, 1))).toBe("autumn");
    expect(seasonFor(new Date(2026, 10, 30, 23, 59))).toBe("autumn");
  });
});
