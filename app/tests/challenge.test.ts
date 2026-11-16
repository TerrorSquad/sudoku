import { describe, expect, it } from "vitest";

import type { Grid } from "../types/sudoku";

import { encodeChallenge, parseChallenge } from "../utils/challenge";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const board = Array.from({ length: 9 }, (_, r) =>
  GIVENS.slice(r * 9, r * 9 + 9)
    .split("")
    .map(Number),
) as Grid;

describe("challenge codes", () => {
  it("round-trips the givens and the time", () => {
    const code = encodeChallenge(board, 252.4);
    expect(code).toBe(`SP1-${GIVENS}-252`);
    expect(parseChallenge(code)).toEqual({ board, seconds: 252 });
  });

  it("finds the code inside a whole pasted share text, line breaks and all", () => {
    const text = `Sudoku Pro · Medium\n⏱ 04:12\nBeat my time: SP1-${GIVENS.slice(0, 40)}\n${GIVENS.slice(40)}-252\nhttps://example`;
    expect(parseChallenge(text)?.seconds).toBe(252);
  });

  it("rejects anything that isn't a code", () => {
    expect(parseChallenge(GIVENS)).toBeNull();
    expect(parseChallenge("SP1-123-4")).toBeNull();
  });
});
