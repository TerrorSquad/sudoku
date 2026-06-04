export type Grid = number[][];
export type NotesGrid = boolean[][][]; // 9x9x10 (indeksi 1-9 za olovku)

export interface CellCoord {
  r: number;
  c: number;
}

export interface HintCoordinate extends CellCoord {
  type: 'trigger' | 'elimination';
}

export interface HintResult {
  r: number;
  c: number;
  targetNum: number;
  highlightCoords: HintCoordinate[];
  explanationTitle: string;
  explanationBody: string;
}

export type Difficulty = 'lako' | 'srednje' | 'tesko' | 'ekspert' | 'custom';
