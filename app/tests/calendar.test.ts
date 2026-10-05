import { describe, it, expect } from "vitest";

import { calendarDays } from "../utils/calendar";

describe("calendarDays", () => {
  // Thursday 2026-01-15
  const today = new Date(2026, 0, 15, 12);

  it("returns weeks × 7 days, Monday first, ending in the current week", () => {
    const days = calendarDays(today, 4);
    expect(days).toHaveLength(28);
    expect(days[0]!.key).toBe("2025-12-22"); // a Monday, three weeks before this week's Monday
    expect(days[21]!.key).toBe("2026-01-12"); // this week's Monday
  });

  it("marks only days after today as future", () => {
    const days = calendarDays(today, 2);
    const byKey = Object.fromEntries(days.map((d) => [d.key, d.future]));
    expect(byKey["2026-01-15"]).toBe(false);
    expect(byKey["2026-01-16"]).toBe(true);
    expect(byKey["2026-01-14"]).toBe(false);
  });

  it("handles a Sunday as the last day of its week", () => {
    const sunday = new Date(2026, 0, 18, 12);
    const days = calendarDays(sunday, 1);
    expect(days[0]!.key).toBe("2026-01-12");
    expect(days[6]!.key).toBe("2026-01-18");
    expect(days[6]!.future).toBe(false);
  });
});
