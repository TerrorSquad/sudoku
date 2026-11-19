import { describe, expect, it } from "vitest";

import { chordFor } from "../utils/sound";

describe("chordFor", () => {
  it("adds notes with each unit finished at once: a dyad, then a growing arpeggio", () => {
    expect([1, 2, 3, 4, 5].map((u) => chordFor(u, 5).length)).toEqual([2, 4, 5, 6, 7]);
    expect(chordFor(9, 5)).toEqual(chordFor(5, 5));
  });

  it("climbs: every note higher and later than the one before", () => {
    for (const units of [1, 2, 3, 4, 5]) {
      const notes = chordFor(units, 3);
      notes.slice(1).forEach((note, i) => {
        expect(note.freq).toBeGreaterThan(notes[i]!.freq);
        expect(note.at).toBeGreaterThan(notes[i]!.at);
      });
    }
  });

  it("is keyed to the digit", () => {
    expect(chordFor(2, 9)[0]!.freq).toBeGreaterThan(chordFor(2, 1)[0]!.freq);
  });

  it("stays soft and short however many notes stack", () => {
    for (const units of [1, 2, 3, 4, 5]) {
      const notes = chordFor(units, 9);
      expect(notes.reduce((sum, n) => sum + n.gain, 0)).toBeLessThanOrEqual(0.3 + 1e-9);
      for (const n of notes) expect(n.at + n.duration).toBeLessThan(1);
    }
  });
});
