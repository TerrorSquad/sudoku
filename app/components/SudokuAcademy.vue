<script setup lang="ts">
import { ref } from 'vue';
import { useTechniqueStats } from '../composables/useTechniqueStats';
import ExampleGrid from './ExampleGrid.vue';

const emit = defineEmits<{
  (e: 'back-to-menu'): void;
}>();

const techStats = useTechniqueStats();

interface ExampleCell {
  r: number;
  c: number;
}

interface TechniqueExample {
  board: number[][];
  notes?: Record<string, number[]>;
  target?: ExampleCell[];
  trigger?: ExampleCell[];
  elimination?: ExampleCell[];
  caption: string;
}

interface Technique {
  name: string;
  tier: 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';
  lookFor: string;
  howItHelps: string;
  example?: TechniqueExample;
}

// Shared base grid used as visual context for examples — only the cells
// relevant to each technique are blanked out and annotated with candidates.
const BASE_BOARD: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function boardWith(blanks: [number, number][]): number[][] {
  const board = BASE_BOARD.map(row => [...row]);
  for (const [r, c] of blanks) board[r]![c] = 0;
  return board;
}

const expanded = ref<Set<string>>(new Set());

function toggleExample(name: string) {
  const next = new Set(expanded.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expanded.value = next;
}

const techniques: Technique[] = [
  // Basic
  {
    name: 'Naked Single',
    tier: 'Basic',
    lookFor: 'A cell where only one digit is a valid candidate — all other digits already appear in the same row, column, or box.',
    howItHelps: 'Place that single remaining candidate directly. No deduction required; the answer is forced by elimination.',
    example: {
      board: boardWith([[0, 0]]),
      notes: { '0-0': [5] },
      target: [{ r: 0, c: 0 }],
      caption: 'R1C1 has exactly one candidate left: 5. Every other digit already appears in its row, column, or box, so 5 must go here.',
    },
  },
  {
    name: 'Hidden Single',
    tier: 'Basic',
    lookFor: 'Within a row, column, or box, find a digit that can only fit in one specific cell — even if that cell has other candidates.',
    howItHelps: 'Because the digit has nowhere else to go in that unit, it must go in that cell. Place it and clear all other candidates from that cell.',
    example: {
      board: boardWith([[0, 0], [0, 1], [0, 2]]),
      notes: { '0-0': [2, 5, 8], '0-1': [3, 9], '0-2': [4, 9] },
      target: [{ r: 0, c: 0 }],
      trigger: [{ r: 0, c: 1 }, { r: 0, c: 2 }],
      caption: 'Digit 5 is missing from this box. Of the three empty cells, only R1C1 can hold a 5 — the highlighted cells don\'t have it as a candidate. Even though R1C1 has other candidates too, the 5 must go here.',
    },
  },
  // Intermediate
  {
    name: 'Naked Pair',
    tier: 'Intermediate',
    lookFor: 'Two cells in the same unit that each contain exactly the same two candidates and no others.',
    howItHelps: 'Those two digits must fill those two cells (in some order). Remove both candidates from every other cell in the unit.',
    example: {
      board: boardWith([[0, 3], [0, 4], [0, 6]]),
      notes: { '0-3': [2, 6], '0-4': [2, 6], '0-6': [2, 6, 9] },
      trigger: [{ r: 0, c: 3 }, { r: 0, c: 4 }],
      elimination: [{ r: 0, c: 6 }],
      caption: 'R1C4 and R1C5 both contain only the candidates {2, 6}. Together they lock up 2 and 6 for this row, so both digits can be removed from every other cell, like R1C7 (rose), which loses 2 and 6 and keeps only 9.',
    },
  },
  {
    name: 'Hidden Pair',
    tier: 'Intermediate',
    lookFor: 'Two digits that appear as candidates in exactly two cells of a unit, and nowhere else in that unit.',
    howItHelps: 'Those two cells must contain those two digits. Remove all other candidates from those two cells.',
    example: {
      board: boardWith([[1, 0], [1, 1], [1, 2], [1, 3]]),
      notes: { '1-0': [1, 6, 7], '1-1': [2, 6, 7], '1-2': [1, 2], '1-3': [1, 2] },
      target: [{ r: 1, c: 0 }, { r: 1, c: 1 }],
      trigger: [{ r: 1, c: 2 }, { r: 1, c: 3 }],
      caption: 'Digits 6 and 7 only appear as candidates in R2C1 and R2C2 (green) within this row — the other empty cells (indigo) never have them. So 6 and 7 must fill R2C1/R2C2, and their extra candidates (1 and 2) can be stripped away.',
    },
  },
  {
    name: 'Naked Triple',
    tier: 'Intermediate',
    lookFor: 'Three cells in a unit whose combined candidates form a pool of exactly three digits. Each cell holds two or three of those digits.',
    howItHelps: 'Those three digits are locked into those three cells. Eliminate them from every other cell in the unit.',
    example: {
      board: boardWith([[2, 0], [2, 1], [2, 2], [2, 4]]),
      notes: { '2-0': [1, 8], '2-1': [8, 9], '2-2': [1, 9], '2-4': [1, 4, 8] },
      trigger: [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
      elimination: [{ r: 2, c: 4 }],
      caption: 'R3C1, R3C2 and R3C3 (indigo) together use only the digits {1, 8, 9} — each cell holds two of the three. Those digits are locked into these cells, so they can be removed elsewhere in the row, like R3C5 (rose), which loses 1 and 8 and keeps only 4.',
    },
  },
  {
    name: 'Hidden Triple',
    tier: 'Intermediate',
    lookFor: 'Three digits that only appear in three cells of a unit (across any combination), and nowhere else in that unit.',
    howItHelps: 'Those three cells must contain those three digits. Strip all other candidates from those cells.',
    example: {
      board: boardWith([[4, 3], [4, 4], [4, 5]]),
      notes: { '4-3': [3, 5, 8, 9], '4-4': [3, 6, 8], '4-5': [1, 5, 8] },
      target: [{ r: 4, c: 3 }, { r: 4, c: 4 }, { r: 4, c: 5 }],
      caption: 'Digits 3, 5 and 8 only show up as candidates in these three cells across the whole row — nowhere else. So these cells must hold 3, 5, 8 between them, and their extra candidates (9, 6, 1) can be removed.',
    },
  },
  {
    name: 'Naked Quad',
    tier: 'Intermediate',
    lookFor: 'Four cells in a unit whose combined candidates are exactly four digits.',
    howItHelps: 'Those four digits are confined to those four cells. Eliminate them from all other cells in the unit.',
    example: {
      board: boardWith([[3, 6], [3, 7], [4, 6], [4, 7], [5, 8]]),
      notes: { '3-6': [2, 4], '3-7': [4, 7], '4-6': [7, 9], '4-7': [2, 9], '5-8': [2, 6, 9] },
      trigger: [{ r: 3, c: 6 }, { r: 3, c: 7 }, { r: 4, c: 6 }, { r: 4, c: 7 }],
      elimination: [{ r: 5, c: 8 }],
      caption: 'These four cells (indigo) use only the digits {2, 4, 7, 9} between them. The quad locks those digits into these cells, so they can be removed elsewhere in the box, like R6C9 (rose), which loses 2 and 9 and keeps only 6.',
    },
  },
  {
    name: 'Hidden Quad',
    tier: 'Intermediate',
    lookFor: 'Four digits that only appear within four cells of a unit.',
    howItHelps: 'Those four cells own those four digits. All other candidates in those cells can be removed.',
    example: {
      board: boardWith([[6, 3], [6, 4], [7, 3], [7, 4]]),
      notes: { '6-3': [1, 3, 5, 7], '6-4': [3, 4, 9], '7-3': [1, 2, 4], '7-4': [3, 4, 5, 8] },
      target: [{ r: 6, c: 3 }, { r: 6, c: 4 }, { r: 7, c: 3 }, { r: 7, c: 4 }],
      caption: 'Digits 1, 3, 4 and 5 only appear as candidates inside these four cells in the box — nowhere else. These cells must contain 1, 3, 4, 5 between them, so all other candidates (7, 9, 2, 8) can be cleared from them.',
    },
  },
  {
    name: 'Pointing Pair / Triple',
    tier: 'Intermediate',
    lookFor: 'Inside a box, a digit\'s candidates all lie in the same row or column (a "pointing" line).',
    howItHelps: 'That digit must go in one of those pointing cells. Remove it from the rest of that row or column outside the box.',
    example: {
      board: boardWith([[0, 0], [0, 3], [0, 4]]),
      notes: { '0-3': [3, 7], '0-4': [7, 9], '0-0': [3, 7, 9] },
      trigger: [{ r: 0, c: 3 }, { r: 0, c: 4 }],
      elimination: [{ r: 0, c: 0 }],
      caption: 'Inside this box, every candidate for 7 lies in row 1 (indigo cells). So 7 must be placed in row 1 somewhere in this box — meaning 7 can be eliminated from row 1 cells outside the box, like R1C1 (rose).',
    },
  },
  {
    name: 'Box-Line Reduction',
    tier: 'Intermediate',
    lookFor: 'All candidates for a digit within a row or column are confined to a single box.',
    howItHelps: 'That digit must live in that row or column intersection. Remove it from all other cells in that box.',
    example: {
      board: boardWith([[6, 1], [6, 2], [7, 0]]),
      notes: { '6-1': [6, 9], '6-2': [1, 9], '7-0': [2, 9] },
      trigger: [{ r: 6, c: 1 }, { r: 6, c: 2 }],
      elimination: [{ r: 7, c: 0 }],
      caption: 'All remaining candidates for 9 in row 7 fall inside this box (indigo cells). So 9 must be placed in this box within row 7 — eliminating 9 from other cells of the box, like R8C1 (rose).',
    },
  },
  // Advanced
  {
    name: 'X-Wing',
    tier: 'Advanced',
    lookFor: 'A digit that appears in exactly two cells in each of two different rows, and those cells share the same two columns.',
    howItHelps: 'The digit must occupy one cell in each row, forcing it into those two columns. Eliminate the digit from those two columns everywhere outside the two rows.',
    example: {
      board: boardWith([[0, 1], [0, 7], [3, 1], [3, 7], [6, 1]]),
      notes: { '0-1': [4, 7], '0-7': [4, 9], '3-1': [4, 5], '3-7': [3, 4], '6-1': [4, 6] },
      trigger: [{ r: 0, c: 1 }, { r: 0, c: 7 }, { r: 3, c: 1 }, { r: 3, c: 7 }],
      elimination: [{ r: 6, c: 1 }],
      caption: 'Digit 4 appears as a candidate in exactly two cells in row 1 and row 4 (indigo) — and both pairs sit in the same two columns, C2 and C8. Wherever 4 ends up in those rows, it locks C2 and C8, so 4 can be eliminated from those columns in any other row, like R7C2 (rose).',
    },
  },
  {
    name: 'Swordfish',
    tier: 'Advanced',
    lookFor: 'A digit that appears in two or three cells in each of three rows, with all occurrences spanning exactly three columns.',
    howItHelps: 'Extends X-Wing logic to three rows. The digit must be placed inside those three rows, so remove it from the three columns everywhere else.',
    example: {
      board: boardWith([[0, 0], [0, 4], [3, 4], [3, 8], [6, 0], [6, 8], [4, 0]]),
      notes: { '0-0': [3, 8], '0-4': [6, 8], '3-4': [5, 8], '3-8': [1, 8], '6-0': [2, 8], '6-8': [4, 8], '4-0': [8, 9] },
      trigger: [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 3, c: 4 }, { r: 3, c: 8 }, { r: 6, c: 0 }, { r: 6, c: 8 }],
      elimination: [{ r: 4, c: 0 }],
      caption: 'Digit 8\'s candidates across rows 1, 4 and 7 (indigo) are confined to just three columns — C1, C5 and C9. The Swordfish locks 8 into those rows, so 8 can be eliminated from those columns in any other row, like R5C1 (rose).',
    },
  },
  {
    name: 'Jellyfish',
    tier: 'Advanced',
    lookFor: 'A digit appearing in two to four cells across four rows, all within the same four columns.',
    howItHelps: 'Four-row extension of Swordfish. Eliminate the digit from those four columns everywhere outside the four defining rows.',
    example: {
      board: boardWith([[0, 0], [0, 3], [2, 3], [2, 6], [4, 6], [4, 8], [6, 0], [6, 8], [1, 0]]),
      notes: {
        '0-0': [2, 6], '0-3': [6, 9], '2-3': [6, 8], '2-6': [5, 6],
        '4-6': [6, 7], '4-8': [1, 6], '6-0': [3, 6], '6-8': [4, 6], '1-0': [6, 7],
      },
      trigger: [{ r: 0, c: 0 }, { r: 0, c: 3 }, { r: 2, c: 3 }, { r: 2, c: 6 }, { r: 4, c: 6 }, { r: 4, c: 8 }, { r: 6, c: 0 }, { r: 6, c: 8 }],
      elimination: [{ r: 1, c: 0 }],
      caption: 'Digit 6\'s candidates across rows 1, 3, 5 and 7 (indigo) are confined to just four columns — C1, C4, C7 and C9. This Jellyfish locks 6 into those rows, eliminating 6 from those columns in any other row, like R2C1 (rose).',
    },
  },
  {
    name: 'Skyscraper',
    tier: 'Advanced',
    lookFor: 'A digit that has exactly two candidates in each of two rows. The two pairs share one common column (the "base"); the remaining two cells are the "roof."',
    howItHelps: 'One of the two roof cells must contain the digit. Any cell that can see both roof cells can have the digit eliminated.',
    example: {
      board: boardWith([[0, 2], [0, 5], [3, 2], [3, 7], [3, 5]]),
      notes: { '0-2': [5, 7], '0-5': [3, 5], '3-2': [5, 9], '3-7': [2, 5], '3-5': [1, 5] },
      trigger: [{ r: 0, c: 2 }, { r: 0, c: 5 }, { r: 3, c: 2 }, { r: 3, c: 7 }],
      elimination: [{ r: 3, c: 5 }],
      caption: 'Digit 5 has exactly two candidates in row 1 and row 4 (indigo). Both pairs share column C3 as a "base"; the other two cells (R1C6 and R4C8) form the "roof." One of the roof cells must hold 5, so any cell seeing both — like R4C6 (rose) — loses 5.',
    },
  },
  {
    name: 'Two-String Kite',
    tier: 'Advanced',
    lookFor: 'A digit that forms a conjugate pair in a row and another conjugate pair in a column, with one cell of each pair sharing the same box.',
    howItHelps: 'The two far endpoints of the kite are linked: one must be true. Any cell that can see both endpoints can have the digit removed.',
    example: {
      board: boardWith([[6, 0], [6, 4], [1, 0], [1, 4]]),
      notes: { '6-0': [3, 7], '6-4': [2, 7], '1-0': [4, 7], '1-4': [1, 7] },
      trigger: [{ r: 6, c: 0 }, { r: 6, c: 4 }, { r: 1, c: 0 }],
      elimination: [{ r: 1, c: 4 }],
      caption: 'Digit 7 forms a conjugate pair in row 7 (R7C1–R7C5) and another in column C1 (R7C1–R2C1), sharing cell R7C1 (indigo). One of the two far ends must hold 7 — and R2C5 (rose) sees both far ends, so 7 can be eliminated there.',
    },
  },
  {
    name: 'Empty Rectangle',
    tier: 'Advanced',
    lookFor: 'A box where a digit\'s candidates are restricted to one row or column within that box. Combine this with a conjugate pair in a separate row or column.',
    howItHelps: 'The restricted line in the box creates an indirect link. Follow the chain: the digit is eliminated from the cell at the intersection of the chain\'s endpoints.',
    example: {
      board: boardWith([[4, 3], [4, 5], [8, 3], [8, 5]]),
      notes: { '4-3': [3, 6], '4-5': [6, 8], '8-3': [6, 9], '8-5': [2, 6] },
      trigger: [{ r: 4, c: 3 }, { r: 4, c: 5 }, { r: 8, c: 3 }],
      elimination: [{ r: 8, c: 5 }],
      caption: 'Within this box, every candidate for 6 lies in row 5 (indigo) — an "empty rectangle" shape. Column C4 also has a conjugate pair for 6 at R5C4 and R9C4. Following the chain R9C4 → R5C4 → R5C6 shows R9C6 (rose) cannot be 6.',
    },
  },
  // Expert
  {
    name: 'XY-Wing',
    tier: 'Expert',
    lookFor: 'Three bivalue cells (each with exactly two candidates): a pivot sharing one candidate with each of two pincers, while the pincers share a common third candidate.',
    howItHelps: 'Whichever value fills the pivot, one of the pincers must take the shared candidate. Any cell that can see both pincers loses that shared candidate.',
    example: {
      board: boardWith([[4, 4], [4, 1], [1, 4], [1, 1]]),
      notes: { '4-4': [2, 5], '4-1': [2, 8], '1-4': [5, 8], '1-1': [4, 8] },
      target: [{ r: 4, c: 4 }],
      trigger: [{ r: 4, c: 1 }, { r: 1, c: 4 }],
      elimination: [{ r: 1, c: 1 }],
      caption: 'R5C5 (green) is a pivot with candidates {2,5}. Its pincers (indigo) are R5C2={2,8} and R2C5={5,8} — both sharing 8. Whichever value fills the pivot, one pincer must be 8, so R2C2 (rose), which sees both pincers, loses candidate 8.',
    },
  },
  {
    name: 'XYZ-Wing',
    tier: 'Expert',
    lookFor: 'Like XY-Wing, but the pivot holds three candidates (XYZ) and each pincer holds two (XZ and YZ). All three cells share a common candidate Z.',
    howItHelps: 'No matter what fills the pivot, one of the three cells takes Z. Any cell that can see all three cells can have Z eliminated.',
    example: {
      board: boardWith([[4, 3], [4, 5], [3, 3], [5, 4]]),
      notes: { '4-3': [2, 5, 8], '4-5': [2, 8], '3-3': [5, 8], '5-4': [3, 8] },
      target: [{ r: 4, c: 3 }],
      trigger: [{ r: 4, c: 5 }, { r: 3, c: 3 }],
      elimination: [{ r: 5, c: 4 }],
      caption: 'R5C4 (green) is a pivot with candidates {2,5,8}. Its pincers (indigo) are R5C6={2,8} and R4C4={5,8} — both sharing 8 with the pivot. No matter what fills the pivot, one of these three cells must be 8, so any other cell in this box, like R6C5 (rose), loses candidate 8.',
    },
  },
  {
    name: 'W-Wing',
    tier: 'Expert',
    lookFor: 'Two cells with identical two candidates (A and B), connected through a conjugate pair for candidate A elsewhere on the board.',
    howItHelps: 'The connecting pair forces one of the two W-Wing cells to hold B. Any cell that can see both W-Wing cells loses candidate B.',
    example: {
      board: boardWith([[0, 0], [8, 8], [3, 0], [3, 8], [0, 8]]),
      notes: { '0-0': [4, 7], '8-8': [4, 7], '3-0': [3, 4], '3-8': [4, 9], '0-8': [1, 7] },
      target: [{ r: 0, c: 0 }, { r: 8, c: 8 }],
      trigger: [{ r: 3, c: 0 }, { r: 3, c: 8 }],
      elimination: [{ r: 0, c: 8 }],
      caption: 'R1C1 and R9C9 (green) both have candidates {4,7}. A conjugate pair for 4 in row 4 (indigo, R4C1–R4C9) connects to each through shared columns. One of the green cells must be 7, so R1C9 (rose), which sees both, loses candidate 7.',
    },
  },
  {
    name: 'Unique Rectangle',
    tier: 'Expert',
    lookFor: 'Four cells forming a rectangle across two rows and two columns, all within two boxes, where the same two candidates appear in at least three corners.',
    howItHelps: 'A valid Sudoku has exactly one solution. If this pattern were completed ambiguously, two solutions would exist — which is impossible. Force the cell that breaks the deadly pattern.',
    example: {
      board: boardWith([[0, 0], [0, 3], [1, 0], [1, 3]]),
      notes: { '0-0': [3, 9], '0-3': [3, 9], '1-0': [3, 9], '1-3': [3, 6, 9] },
      trigger: [{ r: 0, c: 0 }, { r: 0, c: 3 }, { r: 1, c: 0 }],
      target: [{ r: 1, c: 3 }],
      caption: 'R1C1, R1C4 and R2C1 (indigo) all hold only {3,9} — and R2C4 (green) holds {3,9} plus an extra 6. If R2C4 were also just {3,9}, the puzzle would have two valid solutions (an illegal "deadly pattern"). So R2C4 must be 6, and 3/9 can be removed from it.',
    },
  },
  {
    name: 'XY-Chain',
    tier: 'Expert',
    lookFor: 'A chain of bivalue cells where each adjacent pair shares exactly one candidate. The chain begins and ends with the same candidate.',
    howItHelps: 'If the starting cell doesn\'t hold that candidate, the chain forces the end cell to hold it — and vice versa. Any cell seeing both chain endpoints loses that candidate.',
    example: {
      board: boardWith([[0, 1], [2, 1], [2, 5], [6, 5], [6, 1]]),
      notes: { '0-1': [2, 7], '2-1': [2, 5], '2-5': [5, 8], '6-5': [7, 8], '6-1': [4, 7] },
      trigger: [{ r: 0, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 5 }, { r: 6, c: 5 }],
      elimination: [{ r: 6, c: 1 }],
      caption: 'A chain of bivalue cells (indigo) links candidates: R1C2{2,7} → R3C2{2,5} → R3C6{5,8} → R7C6{7,8}. The chain starts and ends on candidate 7 — one of those two cells must be 7, so R7C2 (rose), which sees both ends, loses candidate 7.',
    },
  },
  {
    name: 'Sue de Coq',
    tier: 'Expert',
    lookFor: 'A group of 2–3 cells in a box that also lie in the same row or column, whose combined candidates equal the count of cells plus two extra digits from outside the group\'s units.',
    howItHelps: 'The group must collectively contain certain digits. This forces eliminations in both the intersecting row/column and the rest of the box.',
    example: {
      board: boardWith([[0, 0], [0, 1], [0, 4], [1, 0]]),
      notes: { '0-0': [1, 4, 9], '0-1': [4, 8, 9], '0-4': [1, 5, 9], '1-0': [4, 6, 8] },
      target: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
      elimination: [{ r: 0, c: 4 }, { r: 1, c: 0 }],
      caption: 'R1C1 and R1C2 (green) together hold candidates {1,4,8,9} — two cells plus two extra digits. Digits 1 and 9 stay confined to this row\'s part of the box, so R1C5 (rose) loses them. Digits 4 and 8 stay confined to the box\'s part of this row, so R2C1 (rose) loses them.',
    },
  },
  {
    name: 'BUG',
    tier: 'Expert',
    lookFor: 'All remaining unsolved cells would have exactly two candidates — except one cell that has three. This is a "Bivalue Universal Grave."',
    howItHelps: 'Placing either of the non-extra candidates leads to a position with multiple solutions (invalid). The extra candidate in the triple cell is forced; place it.',
    example: {
      board: boardWith([[0, 0], [0, 1], [1, 0], [1, 1]]),
      notes: { '0-0': [1, 2], '0-1': [1, 3], '1-0': [2, 3], '1-1': [1, 2, 3] },
      target: [{ r: 1, c: 1 }],
      trigger: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }],
      caption: 'Imagine every other unsolved cell on the board has exactly two candidates — except R2C2 (green), which has three: {1,2,3}. If R2C2 also had only two, the puzzle could be solved two different ways (a deadly "Bivalue Universal Grave"). Counting how often each digit appears among the bivalue cells (indigo) in R2C2\'s row, column and box reveals which digit must go there.',
    },
  },
];

const tiers = ['Basic', 'Intermediate', 'Advanced', 'Expert'] as const;

const tierMeta: Record<string, { color: string; badge: string; desc: string }> = {
  Basic:        { color: 'emerald', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', desc: 'Single-cell logic — suitable for all skill levels.' },
  Intermediate: { color: 'amber',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   desc: 'Multi-cell patterns that restrict candidate groups.' },
  Advanced:     { color: 'violet',  badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', desc: 'Fish and chain patterns spanning rows and columns.' },
  Expert:       { color: 'rose',    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',     desc: 'Deep logical chains and uniqueness arguments.' },
};

const tierHeading: Record<string, string> = {
  Basic:        'text-emerald-400',
  Intermediate: 'text-amber-400',
  Advanced:     'text-violet-400',
  Expert:       'text-rose-400',
};

const tierBorder: Record<string, string> = {
  Basic:        'border-emerald-500/20 hover:border-emerald-500/50',
  Intermediate: 'border-amber-500/20 hover:border-amber-500/50',
  Advanced:     'border-violet-500/20 hover:border-violet-500/50',
  Expert:       'border-rose-500/20 hover:border-rose-500/50',
};

function byTier(tier: string) {
  return techniques.filter(t => t.tier === tier);
}
</script>

<template>
  <div class="min-h-screen w-full flex flex-col">
    <!-- Header -->
    <div class="sticky top-0 z-10 backdrop-blur border-b px-4 sm:px-8 py-4 flex items-center gap-4 dark:bg-[#0c0a09]/95 dark:border-zinc-800 bg-white/95 border-zinc-200">
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider transition-colors dark:text-zinc-400 dark:hover:text-zinc-100 text-zinc-600 hover:text-zinc-900"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
        Menu
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-xl sm:text-2xl font-black tracking-tight leading-tight dark:text-zinc-100 text-zinc-900">Sudoku Academy</h1>
        <p class="text-xs text-zinc-500 hidden sm:block">All 23 solving techniques explained — from naked singles to expert chains</p>
      </div>
      <div class="shrink-0 text-right hidden sm:block">
        <span class="text-xs text-zinc-600 font-semibold">23 techniques · 4 tiers</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 px-4 sm:px-8 py-8 max-w-5xl mx-auto w-full">

      <!-- Example legend -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8 px-4 py-3 border text-[11px] dark:bg-zinc-900/40 dark:border-zinc-800 dark:text-zinc-400 bg-zinc-50 border-zinc-200 text-zinc-600">
        <span class="font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700">Example colors</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-emerald-500/30 ring-1 ring-emerald-500 inline-block"></span> Target cell</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-indigo-500/40 ring-1 ring-indigo-400 inline-block"></span> Trigger / evidence</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-rose-500/40 ring-1 ring-rose-400 inline-block"></span> Eliminated candidate</span>
        <span class="ml-auto text-zinc-600 hidden sm:inline">Click a card with an example to see it worked out</span>
      </div>

      <div v-for="tier in tiers" :key="tier" class="mb-12">
        <!-- Tier heading -->
        <div class="flex items-center gap-3 mb-5">
          <h2 :class="tierHeading[tier]" class="text-xl font-black uppercase tracking-widest">{{ tier }}</h2>
          <span :class="tierMeta[tier]!.badge" class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border">
            {{ byTier(tier).length }} technique{{ byTier(tier).length !== 1 ? 's' : '' }}
          </span>
          <div class="flex-1 h-px dark:bg-zinc-800 bg-zinc-200" />
        </div>
        <p class="text-xs text-zinc-500 mb-5 -mt-3">{{ tierMeta[tier]!.desc }}</p>

        <!-- Cards grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="tech in byTier(tier)"
            :key="tech.name"
            :class="[tierBorder[tier], tech.example ? 'cursor-pointer' : '']"
            class="border p-5 transition-colors dark:bg-zinc-900/60 bg-zinc-50"
            @click="tech.example && toggleExample(tech.name)"
          >
            <div class="flex items-start justify-between gap-3 mb-3">
              <h3 class="text-base font-black leading-tight dark:text-zinc-100 text-zinc-900">{{ tech.name }}</h3>
              <div class="flex items-center gap-1.5 shrink-0">
                <span
                  v-if="techStats.getCount(tech.name) > 0"
                  class="text-[9px] font-bold px-1.5 py-0.5 border dark:bg-zinc-700/60 dark:border-zinc-600 dark:text-zinc-400 bg-zinc-200 border-zinc-300 text-zinc-600"
                  :title="`Used ${techStats.getCount(tech.name)} time${techStats.getCount(tech.name) !== 1 ? 's' : ''}`"
                >
                  ×{{ techStats.getCount(tech.name) }}
                </span>
                <span :class="tierMeta[tier]!.badge" class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border">
                  {{ tier }}
                </span>
                <svg
                  v-if="tech.example"
                  class="w-4 h-4 text-zinc-500 transition-transform"
                  :class="{ 'rotate-180': expanded.has(tech.name) }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">What to look for</p>
                <p class="text-sm leading-relaxed dark:text-zinc-300 text-zinc-700">{{ tech.lookFor }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">How it helps</p>
                <p class="text-sm leading-relaxed dark:text-zinc-400 text-zinc-600">{{ tech.howItHelps }}</p>
              </div>
            </div>

            <div v-if="tech.example && expanded.has(tech.name)" class="mt-4 pt-4 border-t dark:border-zinc-800 border-zinc-200" @click.stop>
              <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 text-center">Worked example</p>
              <ExampleGrid
                :board="tech.example.board"
                :notes="tech.example.notes"
                :target="tech.example.target"
                :trigger="tech.example.trigger"
                :elimination="tech.example.elimination"
              />
              <p class="text-xs leading-relaxed mt-3 text-center max-w-sm mx-auto dark:text-zinc-400 text-zinc-600">{{ tech.example.caption }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t pt-8 text-center dark:border-zinc-800 border-zinc-200">
        <p class="text-xs text-zinc-600 leading-relaxed max-w-lg mx-auto">
          These techniques are used by the in-game analyzer. When you request a hint, the engine applies them in order from Basic to Expert, showing you step-by-step how each deduction is made.
        </p>
        <button
          @click="emit('back-to-menu')"
          class="mt-6 px-8 py-3 border text-sm font-bold uppercase tracking-wider transition-all active:scale-95 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 bg-zinc-50 hover:bg-zinc-100 border-zinc-300 text-zinc-700"
        >
          Back to Menu
        </button>
      </div>

    </div>
  </div>
</template>
