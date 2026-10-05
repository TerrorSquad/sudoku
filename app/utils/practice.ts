// Practice puzzles for one technique — no Vue, no storage. Unit-tested in tests/practice.test.ts.
//
// Random puzzles rarely *need* the advanced techniques, so we search: dig puzzles, keep one whose
// logical solve is forced to use the target technique (techniquesRequired). The search is bounded;
// when it comes up empty (swordfish/jellyfish/quads almost never occur) we fall back to the
// Academy's curated worked example, started as a drill from that exact position.

import type { Grid } from "../types/sudoku";
import type { Rng } from "./sudokuCore";
import type { TechniqueId } from "./sudokuGrader";

import { ACADEMY_EXAMPLES } from "./academyExamples";
import { generatePuzzle } from "./sudokuCore";
import { techniquesRequired } from "./sudokuGrader";

export interface PracticePuzzle {
  board: Grid;
  /** Pre-filled pencil marks (drills only), keyed "r-c" → digits. */
  notes?: Record<string, number[]>;
  kind: "puzzle" | "drill";
}

// Deeper digs make the advanced techniques more likely; cycle through them.
const REMOVE_TARGETS = [52, 56, 58, 60, 62];

export async function generatePracticePuzzle(
  technique: TechniqueId,
  rng: Rng = Math.random,
  { maxAttempts = 600, yieldEvery = 40 } = {},
): Promise<PracticePuzzle> {
  for (let i = 0; i < maxAttempts; i++) {
    const { puzzle } = generatePuzzle(REMOVE_TARGETS[i % REMOVE_TARGETS.length]!, rng);
    if (techniquesRequired(puzzle)?.has(technique)) return { board: puzzle, kind: "puzzle" };
    // Let the UI paint ("Generating…") during the longer searches.
    // Sequential on purpose: yielding between batches is the point.
    // oxlint-disable-next-line eslint/no-await-in-loop
    if (i % yieldEvery === yieldEvery - 1) await new Promise((r) => setTimeout(r));
  }
  const example = ACADEMY_EXAMPLES[technique];
  if (!example) throw new Error(`No practice source for technique: ${technique}`);
  return { board: example.board, notes: example.notes, kind: "drill" };
}
