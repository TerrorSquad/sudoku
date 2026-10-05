export type Grid = number[][];
export type NotesGrid = boolean[][][]; // 9x9x10 (indeksi 1-9 za olovku)

export interface CellCoord {
  r: number;
  c: number;
}

/** A cell in a completion flash; `delay` (ms) staggers the ripple outward from the placed digit. */
export interface FlashCell extends CellCoord {
  delay: number;
}

export interface HintCoordinate extends CellCoord {
  type: "trigger" | "elimination";
}

export type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert" | "master" | "custom";
