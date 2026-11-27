import { describe, expect, it } from "vitest";

import { hintRecap } from "../utils/winRecap";

describe("hintRecap", () => {
  it("lists the hinted techniques hardest first, at most three", () => {
    const rows = hintRecap(
      { "naked-single": 4, "x-wing": 1, pointing: 2, "xy-wing": 1, "hidden-single": 3 },
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["xy-wing", "x-wing", "pointing"]);
    expect(rows.map((r) => r.n)).toEqual([1, 1, 2]);
  });

  it("keeps singles when nothing harder was hinted", () => {
    expect(hintRecap({ "naked-single": 2, "hidden-single": 1 }, [])).toEqual([
      { id: "hidden-single", n: 1, learned: false },
      { id: "naked-single", n: 2, learned: false },
    ]);
  });

  it("marks a technique whose lesson was finished as learned", () => {
    const rows = hintRecap({ "x-wing": 1, pointing: 1 }, ["pointing"]);
    expect(rows.map((r) => r.learned)).toEqual([false, true]);
  });

  it("is empty with no hints, and skips what a save shouldn't hold", () => {
    expect(hintRecap({}, [])).toEqual([]);
    expect(hintRecap({ bogus: 2, pointing: 0 } as never, [])).toEqual([]);
  });
});
