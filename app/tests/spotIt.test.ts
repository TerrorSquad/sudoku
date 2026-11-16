import { describe, expect, it } from "vitest";

import { instancesOf, quickLesson, tapPattern } from "../utils/lesson";
import { ACADEMY_TECHNIQUES } from "../utils/progression";
import {
  ROUND_SIZE,
  SPOT_TIERS,
  breakdown,
  buildRound,
  foundCount,
  formatSpotTime,
  mergeSpotBest,
  missCount,
  readSpotBest,
  totalTime,
  type SpotResult,
} from "../utils/spotIt";
import { makeRng } from "../utils/sudokuCore";

describe("buildRound", () => {
  it("draws ten positions from the tier, as evenly as ten allows, never one technique twice running", () => {
    for (const tier of SPOT_TIERS) {
      const ids = ACADEMY_TECHNIQUES.filter((t) => t.tier === tier).map((t) => t.id);
      for (let seed = 1; seed <= 50; seed++) {
        const round = buildRound(tier, makeRng(seed));
        expect(round).toHaveLength(ROUND_SIZE);
        const counts = ids.map((id) => round.filter((s) => s.technique === id).length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        for (let i = 1; i < round.length; i++)
          expect(round[i]!.technique).not.toBe(round[i - 1]!.technique);
      }
    }
  });

  it("chained after a technique, never starts with it (a rush's seam)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const first = buildRound("Basic", rng);
      expect(buildRound("Basic", rng, first.at(-1)!.technique)[0]!.technique).not.toBe(
        first.at(-1)!.technique,
      );
    }
  });

  it("is the same round for the same seed", () => {
    expect(buildRound("Advanced", makeRng(7))).toEqual(buildRound("Advanced", makeRng(7)));
  });
});

describe("breakdown", () => {
  const r = (technique: SpotResult["technique"], seconds: number, misses = 0, skipped = false) => ({
    technique,
    seconds,
    misses,
    skipped,
  });

  it("averages per technique, slowest first, flagging misses, skips and slow ones", () => {
    const results = [
      r("naked-single", 2),
      r("hidden-single", 9, 1),
      r("naked-single", 4),
      r("hidden-single", 20, 0, true),
    ];
    expect(totalTime(results)).toBe(35);
    // A rush: three found (one after a wrong tap); a wrong tap and a skip spent.
    expect(foundCount(results)).toBe(3);
    expect(missCount(results)).toBe(2);
    expect(breakdown(results)).toEqual([
      { technique: "hidden-single", average: 14.5, misses: 1, skips: 1, weak: true },
      { technique: "naked-single", average: 3, misses: 0, skips: 0, weak: false },
    ]);
  });
});

describe("Spot it bests", () => {
  it("reads only known tiers and positive times", () => {
    expect(readSpotBest({ Basic: 30, Expert: -1, Master: 5, Advanced: "x" })).toEqual({
      Basic: 30,
    });
    expect(readSpotBest([1])).toEqual({});
  });

  it("keeps the faster time per tier and passes unknown tiers through", () => {
    expect(mergeSpotBest({ Basic: 30, Master: 9 }, { Basic: 25, Expert: 0, Advanced: 60 })).toEqual(
      { Basic: 25, Master: 9, Advanced: 60 },
    );
  });

  it("keeps the longer rush with Math.max", () => {
    expect(mergeSpotBest({ Basic: 12, Expert: 3 }, { Basic: 9, Expert: 0 }, Math.max)).toEqual({
      Basic: 12,
      Expert: 3,
    });
  });

  it("formats tenths", () => {
    expect(formatSpotTime(42)).toBe("42.0 s");
    expect(formatSpotTime(65.27)).toBe("1:05.3");
  });
});

describe("a Spot it position", () => {
  it("is the same for the same seed, and its own pattern completes step 1", async () => {
    for (const id of ["hidden-single", "jellyfish"] as const) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- two positions, compared
      const [a, b] = await Promise.all([
        quickLesson(id, makeRng(11)),
        quickLesson(id, makeRng(11)),
      ]);
      expect(a.board).toEqual(b.board);
      expect(a.pattern).toEqual(b.pattern);
      let found: { r: number; c: number }[] = [];
      let res = null;
      for (const cell of a.pattern) {
        res = tapPattern(instancesOf(a), found, cell);
        expect(res.miss).toBe(false);
        if (!res.miss) found = res.found;
      }
      expect(res && !res.miss && res.complete).toBeTruthy();
    }
  });

  it("a tap off every pattern is a miss", async () => {
    const L = await quickLesson("naked-single", makeRng(3));
    const filled = L.board.flatMap((row, r) => row.map((v, c) => ({ r, c, v }))).find((x) => x.v);
    expect(tapPattern(instancesOf(L), [], filled!)).toEqual({ miss: true });
  });
});
