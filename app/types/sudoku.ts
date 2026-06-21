export type Grid = number[][];
export type NotesGrid = boolean[][][]; // 9x9x10 (indeksi 1-9 za olovku)

export interface CellCoord {
  r: number;
  c: number;
}

export interface HintCoordinate extends CellCoord {
  type: "trigger" | "elimination";
}

export type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert" | "master" | "custom";
