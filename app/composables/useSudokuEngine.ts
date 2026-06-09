import { ref, computed } from 'vue';
import type { Grid, NotesGrid, CellCoord, HintCoordinate } from '../types/sudoku';

export interface ExplanationStep {
  label: string;
  description: string;
  highlightCoords: HintCoordinate[];
}

export interface ComplexHint {
  title: string;
  targetCell: CellCoord;
  targetNum: number;
  steps: ExplanationStep[];
}

export function useSudokuEngine() {
  const currentBoard = ref<Grid>(Array(9).fill(null).map(() => Array(9).fill(0)));
  const initialBoard = ref<Grid>(Array(9).fill(null).map(() => Array(9).fill(0)));
  const solvedBoard = ref<Grid>(Array(9).fill(null).map(() => Array(9).fill(0)));
  const notesBoard = ref<NotesGrid>(Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(false))));
  const boardHistory = ref<{ board: Grid; notes: NotesGrid }[]>([]);

  const selectedCell = ref<CellCoord | null>(null);

  const activeComplexHint = ref<ComplexHint | null>(null);
  const currentStepIndex = ref<number>(0);

  const activeHintCell = ref<CellCoord | null>(null);
  const hintTriggers = ref<CellCoord[]>([]);
  const hintEliminations = ref<CellCoord[]>([]);

  const solvedTemplate = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];

  const numberCounts = computed(() => {
    const counts = Array(10).fill(0) as number[];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = currentBoard.value[r]![c]!;
        if (val !== 0 && val === solvedBoard.value[r]![c]!) counts[val]!++;
      }
    }
    return counts;
  });

  const conflictCells = computed<CellCoord[]>(() => {
    if (!selectedCell.value) return [];
    const { r, c } = selectedCell.value;
    const val = currentBoard.value[r]![c]!;
    return getConflictCells(r, c, val);
  });

  const currentStep = computed<ExplanationStep | null>(() => {
    if (!activeComplexHint.value) return null;
    return activeComplexHint.value.steps[currentStepIndex.value] ?? null;
  });

  // --- SOLVER ---
  function solveBoardWithBacktracking(board: Grid): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r]![c] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(board, r, c, num)) {
              board[r]![c] = num;
              if (solveBoardWithBacktracking(board)) return true;
              board[r]![c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function isValid(board: Grid, row: number, col: number, num: number): boolean {
    for (let x = 0; x < 9; x++) {
      if (board[row]![x] === num && x !== col) return false;
      if (board[x]![col] === num && x !== row) return false;
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[i + startRow]![j + startCol] === num && (i + startRow !== row || j + startCol !== col)) {
          return false;
        }
      }
    }
    return true;
  }

  function getConflictCells(row: number, col: number, num: number): CellCoord[] {
    const conflicts: CellCoord[] = [];
    if (num === 0) return conflicts;

    for (let x = 0; x < 9; x++) {
      if (x !== col && currentBoard.value[row]![x] === num) conflicts.push({ r: row, c: x });
      if (x !== row && currentBoard.value[x]![col] === num) conflicts.push({ r: x, c: col });
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const currR = i + startRow;
        const currC = j + startCol;
        if ((currR !== row || currC !== col) && currentBoard.value[currR]![currC] === num) {
          if (!conflicts.some(item => item.r === currR && item.c === currC)) {
            conflicts.push({ r: currR, c: currC });
          }
        }
      }
    }
    return conflicts;
  }

  // --- GAME MANAGEMENT ---
  function startNewGame(difficulty: string) {
    let removeCount = 42;
    if (difficulty === 'beginner') removeCount = 20;
    else if (difficulty === 'easy') removeCount = 30;
    else if (difficulty === 'medium') removeCount = 42;
    else if (difficulty === 'hard') removeCount = 52;
    else if (difficulty === 'expert') removeCount = 58;
    else if (difficulty === 'master') removeCount = 62;

    const basePuzzle = solvedTemplate.map(row => [...row]);
    let removed = 0;
    while (removed < removeCount) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (basePuzzle[r]![c] !== 0) {
        basePuzzle[r]![c] = 0;
        removed++;
      }
    }

    initialBoard.value = basePuzzle.map(row => [...row]);
    currentBoard.value = basePuzzle.map(row => [...row]);

    const tempToSolve = basePuzzle.map(row => [...row]);
    if (solveBoardWithBacktracking(tempToSolve)) {
      solvedBoard.value = tempToSolve;
    }

    notesBoard.value = Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(false)));
    boardHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
  }

  function loadCustomBoard(board: Grid) {
    initialBoard.value = board.map(row => [...row]);
    currentBoard.value = board.map(row => [...row]);

    const tempToSolve = board.map(row => [...row]);
    if (solveBoardWithBacktracking(tempToSolve)) {
      solvedBoard.value = tempToSolve;
    } else {
      solvedBoard.value = solvedTemplate.map(row => [...row]);
    }

    notesBoard.value = Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(false)));
    boardHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
  }

  function eraseCell(coord: CellCoord | null) {
    if (!coord) return;
    const { r, c } = coord;
    if (initialBoard.value[r]![c] !== 0) return;

    saveHistory();
    currentBoard.value[r]![c] = 0;
    notesBoard.value[r]![c] = Array(10).fill(false);
  }

  function clearRelationalNotes(row: number, col: number, num: number) {
    for (let i = 0; i < 9; i++) {
      notesBoard.value[row]![i]![num] = false;
      notesBoard.value[i]![col]![num] = false;
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        notesBoard.value[startRow + i]![startCol + j]![num] = false;
      }
    }
  }

  function saveHistory() {
    const boardCopy = currentBoard.value.map(row => [...row]);
    const notesCopy = notesBoard.value.map(row => row.map(cell => [...cell]));
    boardHistory.value.push({ board: boardCopy, notes: notesCopy });
    if (boardHistory.value.length > 25) boardHistory.value.shift();
  }

  function undoMove() {
    if (boardHistory.value.length === 0) return;
    const prevState = boardHistory.value.pop();
    if (prevState) {
      currentBoard.value = prevState.board;
      notesBoard.value = prevState.notes;
    }
    cancelComplexHint();
  }

  function checkWinCondition(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r]![c] !== solvedBoard.value[r]![c]) return false;
      }
    }
    return true;
  }

  function getGridCandidates(board: Grid): number[][][] {
    const candidates: number[][][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => [] as number[])
    );
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r]![c] === 0) {
          for (let val = 1; val <= 9; val++) {
            if (isValid(board, r, c, val)) candidates[r]![c]!.push(val);
          }
        }
      }
    }
    return candidates;
  }

  // --- HINT TECHNIQUES (simplest to hardest) ---

  function findNakedSingle(candidates: number[][][]): ComplexHint | null {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = candidates[r]![c]!;
        if (currentBoard.value[r]![c] === 0 && cell.length === 1) {
          const targetNum = cell[0]!;
          const triggers: HintCoordinate[] = [];

          for (let i = 0; i < 9; i++) {
            if (currentBoard.value[r]![i] !== 0) triggers.push({ r, c: i, type: 'trigger' });
            if (currentBoard.value[i]![c] !== 0) triggers.push({ r: i, c, type: 'trigger' });
          }
          const boxR = r - (r % 3);
          const boxC = c - (c % 3);
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              if (currentBoard.value[boxR + i]![boxC + j] !== 0) {
                triggers.push({ r: boxR + i, c: boxC + j, type: 'trigger' });
              }
            }
          }

          return {
            title: "Naked Single",
            targetCell: { r, c },
            targetNum,
            steps: [
              {
                label: "Step 1 — Find blocking cells",
                description: `Cell [R${r+1}C${c+1}] is surrounded by all other digits. The blue-highlighted cells in its row, column, and box block every digit except ${targetNum}. A Naked Single means only one candidate remains — visible directly without further analysis.`,
                highlightCoords: triggers
              },
              {
                label: "Step 2 — Enter the only remaining digit",
                description: `Since all other digits (1–9 except ${targetNum}) are eliminated from this cell by conflicts in its row, column, and box, ${targetNum} is the only valid value.`,
                highlightCoords: [{ r, c, type: 'trigger' }]
              }
            ]
          };
        }
      }
    }
    return null;
  }

  function findHiddenSingle(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      // Scan rows
      for (let r = 0; r < 9; r++) {
        const validCols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) validCols.push(c);
        }
        if (validCols.length === 1) {
          const c = validCols[0]!;
          const triggers: HintCoordinate[] = [];
          for (let i = 0; i < 9; i++) {
            if (currentBoard.value[r]![i] !== 0) triggers.push({ r, c: i, type: 'trigger' });
          }
          return {
            title: "Hidden Single — Row",
            targetCell: { r, c },
            targetNum: val,
            steps: [
              {
                label: "Step 1 — Scan the full row",
                description: `Check all empty cells in row ${r+1}. Digit ${val} is not possible in any other cell of that row — blocked by their columns or boxes. Filled cells (blue) show why. This is called Hidden Single because ${val} is "hidden" inside the row — not immediately obvious.`,
                highlightCoords: triggers
              },
              {
                label: "Step 2 — Only valid placement for this digit",
                description: `Since ${val} can only go into cell [R${r+1}C${c+1}] within the entire row, that is the only valid placement. Enter ${val}.`,
                highlightCoords: [{ r, c, type: 'trigger' }]
              }
            ]
          };
        }
      }

      // Scan columns
      for (let c = 0; c < 9; c++) {
        const validRows: number[] = [];
        for (let r = 0; r < 9; r++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) validRows.push(r);
        }
        if (validRows.length === 1) {
          const r = validRows[0]!;
          const triggers: HintCoordinate[] = [];
          for (let i = 0; i < 9; i++) {
            if (currentBoard.value[i]![c] !== 0) triggers.push({ r: i, c, type: 'trigger' });
          }
          return {
            title: "Hidden Single — Column",
            targetCell: { r, c },
            targetNum: val,
            steps: [
              {
                label: "Step 1 — Scan the full column",
                description: `Check all empty cells in column ${c+1}. Digit ${val} is not possible in any other cell of that column — blocked by their rows or boxes. Filled cells (blue) show why the other positions are ruled out.`,
                highlightCoords: triggers
              },
              {
                label: "Step 2 — Only valid placement for this digit",
                description: `Since ${val} can only go into cell [R${r+1}C${c+1}] within the entire column ${c+1}, that is the only valid placement. Enter ${val}.`,
                highlightCoords: [{ r, c, type: 'trigger' }]
              }
            ]
          };
        }
      }

      // Scan boxes
      for (let box = 0; box < 9; box++) {
        const startRow = Math.floor(box / 3) * 3;
        const startCol = (box % 3) * 3;
        const validCells: CellCoord[] = [];
        for (let r = startRow; r < startRow + 3; r++) {
          for (let c = startCol; c < startCol + 3; c++) {
            if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) validCells.push({ r, c });
          }
        }
        if (validCells.length === 1) {
          const { r, c } = validCells[0]!;
          const triggers: HintCoordinate[] = [];
          for (let r2 = startRow; r2 < startRow + 3; r2++) {
            for (let c2 = startCol; c2 < startCol + 3; c2++) {
              if ((r2 !== r || c2 !== c) && currentBoard.value[r2]![c2] !== 0) {
                triggers.push({ r: r2, c: c2, type: 'trigger' });
              }
            }
          }
          return {
            title: "Hidden Single — Box",
            targetCell: { r, c },
            targetNum: val,
            steps: [
              {
                label: "Step 1 — Scan the 3×3 box",
                description: `Look at box ${box+1} (rows ${startRow+1}–${startRow+3}, cols ${startCol+1}–${startCol+3}). Digit ${val} is not possible in any other empty cell of that box — blocked by surrounding rows and columns. Filled cells (blue) confirm this.`,
                highlightCoords: triggers
              },
              {
                label: "Step 2 — Only valid placement in the box",
                description: `Since ${val} can only go into cell [R${r+1}C${c+1}] within the entire box ${box+1}, that is the only valid placement. Enter ${val}.`,
                highlightCoords: [{ r, c, type: 'trigger' }]
              }
            ]
          };
        }
      }
    }
    return null;
  }

  function findNakedPairs(candidates: number[][][]): ComplexHint | null {
    // Check rows
    for (let r = 0; r < 9; r++) {
      const pairCells: { c: number; v1: number; v2: number }[] = [];
      for (let c = 0; c < 9; c++) {
        const cands = candidates[r]![c]!;
        if (currentBoard.value[r]![c] === 0 && cands.length === 2) {
          pairCells.push({ c, v1: cands[0]!, v2: cands[1]! });
        }
      }
      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const a = pairCells[i]!;
          const b = pairCells[j]!;
          if (a.v1 === b.v1 && a.v2 === b.v2) {
            const eliminations: HintCoordinate[] = [];
            for (let c = 0; c < 9; c++) {
              if (c !== a.c && c !== b.c && currentBoard.value[r]![c] === 0) {
                const cands = candidates[r]![c]!;
                if (cands.includes(a.v1) || cands.includes(a.v2)) {
                  eliminations.push({ r, c, type: 'elimination' });
                }
              }
            }
            if (eliminations.length > 0) {
              const target = eliminations[0]!;
              return {
                title: "Naked Pair — Row",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Step 1 — Find the Naked Pair",
                    description: `In row ${r+1}, the cells in columns ${a.c+1} and ${b.c+1} share exactly the same candidates [${a.v1}, ${a.v2}]. A Naked Pair means these two digits must go into one of those two cells — no other digit can go there, and ${a.v1} and ${a.v2} cannot appear elsewhere in the row.`,
                    highlightCoords: [
                      { r, c: a.c, type: 'trigger' },
                      { r, c: b.c, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Step 2 — Eliminate pair from the rest of the row",
                    description: `Since ${a.v1} and ${a.v2} are "locked" into those two cells, they cannot appear in any other cell of row ${r+1}. Red-highlighted cells can have ${a.v1} or ${a.v2} removed from their candidate lists, opening new possibilities.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }

    // Check columns
    for (let c = 0; c < 9; c++) {
      const pairCells: { r: number; v1: number; v2: number }[] = [];
      for (let r = 0; r < 9; r++) {
        const cands = candidates[r]![c]!;
        if (currentBoard.value[r]![c] === 0 && cands.length === 2) {
          pairCells.push({ r, v1: cands[0]!, v2: cands[1]! });
        }
      }
      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const a = pairCells[i]!;
          const b = pairCells[j]!;
          if (a.v1 === b.v1 && a.v2 === b.v2) {
            const eliminations: HintCoordinate[] = [];
            for (let r = 0; r < 9; r++) {
              if (r !== a.r && r !== b.r && currentBoard.value[r]![c] === 0) {
                const cands = candidates[r]![c]!;
                if (cands.includes(a.v1) || cands.includes(a.v2)) {
                  eliminations.push({ r, c, type: 'elimination' });
                }
              }
            }
            if (eliminations.length > 0) {
              const target = eliminations[0]!;
              return {
                title: "Naked Pair — Column",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Step 1 — Find the Naked Pair in the column",
                    description: `In column ${c+1}, the cells in rows ${a.r+1} and ${b.r+1} share exactly the same candidates [${a.v1}, ${a.v2}]. Those two digits must go into one of those two cells — no other digit is possible there, and ${a.v1} and ${a.v2} cannot appear elsewhere in the column.`,
                    highlightCoords: [
                      { r: a.r, c, type: 'trigger' },
                      { r: b.r, c, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Step 2 — Eliminate pair from the rest of the column",
                    description: `Since ${a.v1} and ${a.v2} are "locked" into those two cells in column ${c+1}, they can be removed from all other cells in the same column (red). This narrows candidates and simplifies further solving.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }

    // Check boxes
    for (let box = 0; box < 9; box++) {
      const startRow = Math.floor(box / 3) * 3;
      const startCol = (box % 3) * 3;
      const pairCells: { r: number; c: number; v1: number; v2: number }[] = [];
      for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
          const cands = candidates[r]![c]!;
          if (currentBoard.value[r]![c] === 0 && cands.length === 2) {
            pairCells.push({ r, c, v1: cands[0]!, v2: cands[1]! });
          }
        }
      }
      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const a = pairCells[i]!;
          const b = pairCells[j]!;
          if (a.v1 === b.v1 && a.v2 === b.v2) {
            const eliminations: HintCoordinate[] = [];
            for (let r = startRow; r < startRow + 3; r++) {
              for (let c = startCol; c < startCol + 3; c++) {
                if ((r !== a.r || c !== a.c) && (r !== b.r || c !== b.c) && currentBoard.value[r]![c] === 0) {
                  const cands = candidates[r]![c]!;
                  if (cands.includes(a.v1) || cands.includes(a.v2)) {
                    eliminations.push({ r, c, type: 'elimination' });
                  }
                }
              }
            }
            if (eliminations.length > 0) {
              const target = eliminations[0]!;
              return {
                title: "Naked Pair — Box",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Step 1 — Find the Naked Pair in the box",
                    description: `In box ${box+1}, cells [R${a.r+1}C${a.c+1}] and [R${b.r+1}C${b.c+1}] share the same candidates [${a.v1}, ${a.v2}]. This means ${a.v1} and ${a.v2} must go into one of those two cells, without exception.`,
                    highlightCoords: [
                      { r: a.r, c: a.c, type: 'trigger' },
                      { r: b.r, c: b.c, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Step 2 — Eliminate pair from the rest of the box",
                    description: `Since ${a.v1} and ${a.v2} are exclusively tied to those two cells in box ${box+1}, they can be removed from all other empty cells in the same box (red). This can reveal new Naked Single or Hidden Single opportunities.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }

    return null;
  }

  function findPointingPair(candidates: number[][][]): ComplexHint | null {
    for (let box = 0; box < 9; box++) {
      const startRow = Math.floor(box / 3) * 3;
      const startCol = (box % 3) * 3;

      for (let val = 1; val <= 9; val++) {
        const cells: CellCoord[] = [];
        for (let r = startRow; r < startRow + 3; r++) {
          for (let c = startCol; c < startCol + 3; c++) {
            if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) {
              cells.push({ r, c });
            }
          }
        }

        if (cells.length < 2 || cells.length > 3) continue;

        const isRow = cells.every(cell => cell.r === cells[0]!.r);
        if (isRow) {
          const targetRow = cells[0]!.r;
          const eliminations: HintCoordinate[] = [];
          for (let c = 0; c < 9; c++) {
            if ((c < startCol || c >= startCol + 3) && currentBoard.value[targetRow]![c] === 0 && candidates[targetRow]![c]!.includes(val)) {
              eliminations.push({ r: targetRow, c, type: 'elimination' });
            }
          }
          if (eliminations.length > 0) {
            const target = eliminations[0]!;
            return {
              title: "Pointing Pair — Row",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Step 1 — Spot the alignment inside the box",
                  description: `In box ${box+1}, all remaining candidates for digit ${val} lie exclusively in row ${targetRow+1} (blue). This means ${val} must go into one of those cells — and nowhere else in that box.`,
                  highlightCoords: cells.map(cell => ({ r: cell.r, c: cell.c, type: 'trigger' as const }))
                },
                {
                  label: "Step 2 — Eliminate from the rest of the row",
                  description: `Because of the alignment inside the box, ${val} cannot be in any other cell of row ${targetRow+1} outside that box. Red cells can have ${val} removed from their candidates, simplifying further solving.`,
                  highlightCoords: eliminations
                }
              ]
            };
          }
        }

        const isCol = cells.every(cell => cell.c === cells[0]!.c);
        if (isCol) {
          const targetCol = cells[0]!.c;
          const eliminations: HintCoordinate[] = [];
          for (let r = 0; r < 9; r++) {
            if ((r < startRow || r >= startRow + 3) && currentBoard.value[r]![targetCol] === 0 && candidates[r]![targetCol]!.includes(val)) {
              eliminations.push({ r, c: targetCol, type: 'elimination' });
            }
          }
          if (eliminations.length > 0) {
            const target = eliminations[0]!;
            return {
              title: "Pointing Pair — Column",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Step 1 — Spot the alignment inside the box",
                  description: `In box ${box+1}, all remaining candidates for digit ${val} lie exclusively in column ${targetCol+1} (blue). This means ${val} must go into one of those cells — and nowhere else in that box.`,
                  highlightCoords: cells.map(cell => ({ r: cell.r, c: cell.c, type: 'trigger' as const }))
                },
                {
                  label: "Step 2 — Eliminate from the rest of the column",
                  description: `Because of the alignment inside the box, ${val} cannot be in any other cell of column ${targetCol+1} outside that box. Red cells can have ${val} removed from their candidates.`,
                  highlightCoords: eliminations
                }
              ]
            };
          }
        }
      }
    }
    return null;
  }

  function findNakedTriples(candidates: number[][][]): ComplexHint | null {
    const units: { cells: CellCoord[]; label: string }[] = [];
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Row ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Column ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Box ${box+1}` });
    }

    for (const { cells: unitCells, label } of units) {
      const emptyCells = unitCells.filter(({ r, c }) => currentBoard.value[r]![c] === 0 && candidates[r]![c]!.length >= 2 && candidates[r]![c]!.length <= 3);
      for (let i = 0; i < emptyCells.length; i++) {
        for (let j = i + 1; j < emptyCells.length; j++) {
          for (let k = j + 1; k < emptyCells.length; k++) {
            const a = emptyCells[i]!, b = emptyCells[j]!, c2 = emptyCells[k]!;
            const union = [...new Set([...candidates[a.r]![a.c]!, ...candidates[b.r]![b.c]!, ...candidates[c2.r]![c2.c]!])];
            if (union.length !== 3) continue;

            const eliminations: HintCoordinate[] = [];
            for (const { r, c } of unitCells) {
              if ((r === a.r && c === a.c) || (r === b.r && c === b.c) || (r === c2.r && c === c2.c)) continue;
              if (currentBoard.value[r]![c] !== 0) continue;
              for (const v of union) {
                if (candidates[r]![c]!.includes(v)) { eliminations.push({ r, c, type: 'elimination' }); break; }
              }
            }
            if (eliminations.length === 0) continue;

            const [v1, v2, v3] = union as [number, number, number];
            return {
              title: `Naked Triple — ${label}`,
              targetCell: a,
              targetNum: solvedBoard.value[a.r]![a.c]!,
              steps: [
                {
                  label: "Step 1 — Find the Naked Triple",
                  description: `Cells [R${a.r+1}C${a.c+1}], [R${b.r+1}C${b.c+1}] and [R${c2.r+1}C${c2.c+1}] together contain exactly three distinct candidates: ${v1}, ${v2}, ${v3}. Each cell holds only a subset of those three digits (2 or 3). Together, this triple "locks" those digits — none of the three can go anywhere else in ${label}.`,
                  highlightCoords: [
                    { r: a.r, c: a.c, type: 'trigger' },
                    { r: b.r, c: b.c, type: 'trigger' },
                    { r: c2.r, c: c2.c, type: 'trigger' }
                  ]
                },
                {
                  label: "Step 2 — Eliminate triple from the rest of the unit",
                  description: `Since ${v1}, ${v2} and ${v3} must go into those three cells, they can be removed from all other cells in ${label} (red). This drastically narrows the possibilities.`,
                  highlightCoords: eliminations
                }
              ]
            };
          }
        }
      }
    }
    return null;
  }

  function findNakedQuads(candidates: number[][][]): ComplexHint | null {
    const units: { cells: CellCoord[]; label: string }[] = [];
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Row ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Column ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Box ${box+1}` });
    }

    for (const { cells: unitCells, label } of units) {
      const emptyCells = unitCells.filter(({ r, c }) => currentBoard.value[r]![c] === 0 && candidates[r]![c]!.length >= 2 && candidates[r]![c]!.length <= 4);
      for (let i = 0; i < emptyCells.length; i++) {
        for (let j = i + 1; j < emptyCells.length; j++) {
          for (let k = j + 1; k < emptyCells.length; k++) {
            for (let l = k + 1; l < emptyCells.length; l++) {
              const a = emptyCells[i]!, b = emptyCells[j]!, c2 = emptyCells[k]!, d = emptyCells[l]!;
              const union = [...new Set([...candidates[a.r]![a.c]!, ...candidates[b.r]![b.c]!, ...candidates[c2.r]![c2.c]!, ...candidates[d.r]![d.c]!])];
              if (union.length !== 4) continue;

              const eliminations: HintCoordinate[] = [];
              for (const { r, c } of unitCells) {
                if ([a,b,c2,d].some(x => x.r === r && x.c === c)) continue;
                if (currentBoard.value[r]![c] !== 0) continue;
                for (const v of union) {
                  if (candidates[r]![c]!.includes(v)) { eliminations.push({ r, c, type: 'elimination' }); break; }
                }
              }
              if (eliminations.length === 0) continue;

              const [v1,v2,v3,v4] = union as [number,number,number,number];
              return {
                title: `Naked Quad — ${label}`,
                targetCell: a,
                targetNum: solvedBoard.value[a.r]![a.c]!,
                steps: [
                  {
                    label: "Step 1 — Find the Naked Quad",
                    description: `Four cells in ${label} together contain exactly four candidates: ${v1}, ${v2}, ${v3}, ${v4}. Each cell holds only a subset of those four digits. This quad "locks" them — none of the four digits can go into any other cell of the same unit.`,
                    highlightCoords: [a,b,c2,d].map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                  },
                  {
                    label: "Step 2 — Eliminate quad from the rest of the unit",
                    description: `Candidates ${v1}, ${v2}, ${v3} and ${v4} can be removed from all other cells in ${label} (red), as they are exclusively reserved for those four cells.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }
    return null;
  }

  function seesCell(r1: number, c1: number, r2: number, c2: number): boolean {
    if (r1 === r2 || c1 === c2) return true;
    return Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3);
  }

  function findXYWing(candidates: number[][][]): ComplexHint | null {
    // pivot: exactly 2 candidates [x,y]; pincer1 sees pivot with [x,z]; pincer2 sees pivot with [y,z]
    // any cell that sees BOTH pincers can have z eliminated
    for (let pr = 0; pr < 9; pr++) {
      for (let pc = 0; pc < 9; pc++) {
        const pivot = candidates[pr]![pc]!;
        if (currentBoard.value[pr]![pc] !== 0 || pivot.length !== 2) continue;
        const [x, y] = pivot as [number, number];

        for (let r1 = 0; r1 < 9; r1++) {
          for (let c1 = 0; c1 < 9; c1++) {
            if (r1 === pr && c1 === pc) continue;
            if (currentBoard.value[r1]![c1] !== 0) continue;
            if (!seesCell(pr, pc, r1, c1)) continue;
            const p1 = candidates[r1]![c1]!;
            if (p1.length !== 2 || !p1.includes(x)) continue;
            const z = p1.find(v => v !== x)!;
            if (z === y) continue;

            for (let r2 = 0; r2 < 9; r2++) {
              for (let c2 = 0; c2 < 9; c2++) {
                if (r2 === pr && c2 === pc) continue;
                if (r2 === r1 && c2 === c1) continue;
                if (currentBoard.value[r2]![c2] !== 0) continue;
                if (!seesCell(pr, pc, r2, c2)) continue;
                const p2 = candidates[r2]![c2]!;
                if (p2.length !== 2 || !p2.includes(y) || !p2.includes(z)) continue;

                // found XY-Wing: eliminate z from cells that see both pincers
                const eliminations: HintCoordinate[] = [];
                for (let r = 0; r < 9; r++) {
                  for (let c = 0; c < 9; c++) {
                    if (currentBoard.value[r]![c] !== 0) continue;
                    if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
                    if (seesCell(r, c, r1, c1) && seesCell(r, c, r2, c2) && candidates[r]![c]!.includes(z)) {
                      eliminations.push({ r, c, type: 'elimination' });
                    }
                  }
                }
                if (eliminations.length === 0) continue;

                const target = eliminations[0]!;
                return {
                  title: "XY-Wing",
                  targetCell: { r: target.r, c: target.c },
                  targetNum: solvedBoard.value[target.r]![target.c]!,
                  steps: [
                    {
                      label: "Step 1 — Find the XY-Wing structure",
                      description: `Pivot cell [R${pr+1}C${pc+1}] has candidates [${x},${y}]. Pincer 1 [R${r1+1}C${c1+1}] has [${x},${z}] and sees the pivot. Pincer 2 [R${r2+1}C${c2+1}] has [${y},${z}] and sees the pivot. Regardless of which candidate the pivot takes, one of the pincers must contain ${z}.`,
                      highlightCoords: [
                        { r: pr, c: pc, type: 'trigger' },
                        { r: r1, c: c1, type: 'trigger' },
                        { r: r2, c: c2, type: 'trigger' }
                      ]
                    },
                    {
                      label: "Step 2 — Eliminate the shared candidate",
                      description: `Every cell that sees both pincers (red) cannot contain ${z} — because one of the pincers will always hold ${z}. The elimination is guaranteed regardless of the pivot's solution.`,
                      highlightCoords: eliminations
                    }
                  ]
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function findXYZWing(candidates: number[][][]): ComplexHint | null {
    // pivot: 3 candidates [x,y,z]; pincer1 sees pivot with [x,z]; pincer2 sees pivot with [y,z]
    // eliminate z from cells that see pivot AND both pincers
    for (let pr = 0; pr < 9; pr++) {
      for (let pc = 0; pc < 9; pc++) {
        const pivot = candidates[pr]![pc]!;
        if (currentBoard.value[pr]![pc] !== 0 || pivot.length !== 3) continue;
        const [x, y, z] = pivot as [number, number, number];

        for (let r1 = 0; r1 < 9; r1++) {
          for (let c1 = 0; c1 < 9; c1++) {
            if (r1 === pr && c1 === pc) continue;
            if (currentBoard.value[r1]![c1] !== 0 || !seesCell(pr, pc, r1, c1)) continue;
            const p1 = candidates[r1]![c1]!;
            if (p1.length !== 2 || !p1.includes(z)) continue;
            const xOrY1 = p1.find(v => v !== z);
            if (xOrY1 !== x && xOrY1 !== y) continue;
            const needed2 = xOrY1 === x ? y : x;

            for (let r2 = 0; r2 < 9; r2++) {
              for (let c2 = 0; c2 < 9; c2++) {
                if (r2 === pr && c2 === pc) continue;
                if (r2 === r1 && c2 === c1) continue;
                if (currentBoard.value[r2]![c2] !== 0 || !seesCell(pr, pc, r2, c2)) continue;
                const p2 = candidates[r2]![c2]!;
                if (p2.length !== 2 || !p2.includes(z) || !p2.includes(needed2)) continue;

                const eliminations: HintCoordinate[] = [];
                for (let r = 0; r < 9; r++) {
                  for (let c = 0; c < 9; c++) {
                    if (currentBoard.value[r]![c] !== 0) continue;
                    if ((r === pr && c === pc) || (r === r1 && c === c1) || (r === r2 && c === c2)) continue;
                    if (seesCell(r, c, pr, pc) && seesCell(r, c, r1, c1) && seesCell(r, c, r2, c2) && candidates[r]![c]!.includes(z)) {
                      eliminations.push({ r, c, type: 'elimination' });
                    }
                  }
                }
                if (eliminations.length === 0) continue;

                const target = eliminations[0]!;
                return {
                  title: "XYZ-Wing",
                  targetCell: { r: target.r, c: target.c },
                  targetNum: solvedBoard.value[target.r]![target.c]!,
                  steps: [
                    {
                      label: "Step 1 — Find the XYZ-Wing structure",
                      description: `Pivot [R${pr+1}C${pc+1}] has three candidates [${x},${y},${z}]. Both pincers [R${r1+1}C${c1+1}] and [R${r2+1}C${c2+1}] see the pivot and contain ${z} plus one of ${x} or ${y}. Unlike XY-Wing, the pivot itself also contains ${z}, so the elimination only applies to cells that see ALL three members.`,
                      highlightCoords: [
                        { r: pr, c: pc, type: 'trigger' },
                        { r: r1, c: c1, type: 'trigger' },
                        { r: r2, c: c2, type: 'trigger' }
                      ]
                    },
                    {
                      label: "Step 2 — Eliminate z from cells that see all three",
                      description: `Cells that see the pivot and both pincers (red) cannot contain ${z} — in every scenario one of the three cells holds it. This is a more restrictive but more powerful version of XY-Wing.`,
                      highlightCoords: eliminations
                    }
                  ]
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function findSueDeCoq(candidates: number[][][]): ComplexHint | null {
    // Sue-de-Coq: intersection of a row/col segment and a box that together contain exactly N cells
    // covering N+M digits where N come from the intersection, M from the rest of the row/col,
    // M from the rest of the box — allowing eliminations from both the row/col and the box.
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;

      // Try each row that intersects this box
      for (let r = sr; r < sr + 3; r++) {
        // Intersection: empty cells in row r AND in box
        const intersect: CellCoord[] = [];
        for (let c = sc; c < sc + 3; c++) {
          if (currentBoard.value[r]![c] === 0) intersect.push({ r, c });
        }
        if (intersect.length < 2) continue;

        // Remaining row cells (outside box)
        const rowRest: CellCoord[] = [];
        for (let c = 0; c < 9; c++) {
          if (c < sc || c >= sc + 3) {
            if (currentBoard.value[r]![c] === 0) rowRest.push({ r, c });
          }
        }

        // Remaining box cells (outside row)
        const boxRest: CellCoord[] = [];
        for (let r2 = sr; r2 < sr + 3; r2++) {
          if (r2 === r) continue;
          for (let c = sc; c < sc + 3; c++) {
            if (currentBoard.value[r2]![c] === 0) boxRest.push({ r: r2, c });
          }
        }

        // Union of candidates in intersection
        const intDigits = [...new Set(intersect.flatMap(({ r: ir, c: ic }) => candidates[ir]![ic]!))];
        if (intDigits.length < 2 || intDigits.length > intersect.length + 2) continue;

        // Try to find a subset from rowRest and boxRest that "covers" extra digits
        // Simplified: check if intersection candidates = row-exclusive + box-exclusive partition
        const rowRestDigits = [...new Set(rowRest.flatMap(({ r: ir, c: ic }) => candidates[ir]![ic]!))];
        const boxRestDigits = [...new Set(boxRest.flatMap(({ r: ir, c: ic }) => candidates[ir]![ic]!))];

        const rowExclusive = intDigits.filter(v => rowRestDigits.includes(v) && !boxRestDigits.includes(v));
        const boxExclusive = intDigits.filter(v => boxRestDigits.includes(v) && !rowRestDigits.includes(v));
        const shared = intDigits.filter(v => !rowExclusive.includes(v) && !boxExclusive.includes(v));

        if (shared.length > 0 || rowExclusive.length === 0 || boxExclusive.length === 0) continue;
        if (intDigits.length !== rowExclusive.length + boxExclusive.length) continue;

        // Eliminations: rowExclusive from rowRest, boxExclusive from boxRest
        const eliminations: HintCoordinate[] = [];
        for (const { r: er, c: ec } of rowRest) {
          for (const v of rowExclusive) {
            if (candidates[er]![ec]!.includes(v)) eliminations.push({ r: er, c: ec, type: 'elimination' });
          }
        }
        for (const { r: er, c: ec } of boxRest) {
          for (const v of boxExclusive) {
            if (candidates[er]![ec]!.includes(v)) eliminations.push({ r: er, c: ec, type: 'elimination' });
          }
        }
        if (eliminations.length === 0) continue;

        const target = eliminations[0]!;
        return {
          title: `Sue-de-Coq`,
          targetCell: { r: target.r, c: target.c },
          targetNum: solvedBoard.value[target.r]![target.c]!,
          steps: [
            {
              label: "Step 1 — Find the Sue-de-Coq intersection",
              description: `The intersection of row ${r+1} and box ${box+1} contains cells whose candidates [${intDigits.join(',')}] split into two groups: [${rowExclusive.join(',')}] that can only go into the rest of the row, and [${boxExclusive.join(',')}] that can only go into the rest of the box. The intersection (blue) "consumes" all those candidates.`,
              highlightCoords: intersect.map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
            },
            {
              label: "Step 2 — Eliminate from the row and box",
              description: `Since [${rowExclusive.join(',')}] are exclusive to the intersection within the row, they cannot appear in the rest of the row. Since [${boxExclusive.join(',')}] are exclusive to the intersection within the box, they cannot appear in the rest of the box. Red cells lose those candidates.`,
              highlightCoords: eliminations
            }
          ]
        };
      }
    }
    return null;
  }

  function findXYChain(candidates: number[][][]): ComplexHint | null {
    // XY-Chain: chain of bivalue cells where consecutive cells share a digit and see each other.
    // The first and last cells share a digit q. Cells seeing both ends can have q eliminated.
    const bivalueCells: CellCoord[] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.length === 2) bivalueCells.push({ r, c });
      }
    }

    // BFS/DFS to find chains up to length 6 for performance
    for (const start of bivalueCells) {
      const startCands = candidates[start.r]![start.c]!;
      for (const startDigit of startCands) {
        // DFS: chain = list of cells, alternating which digit is "entering" the cell
        const dfs = (chain: CellCoord[], enterDigit: number): ComplexHint | null => {
          if (chain.length > 6) return null;
          const last = chain[chain.length - 1]!;
          const lastCands = candidates[last.r]![last.c]!;
          const exitDigit = lastCands.find(v => v !== enterDigit)!;

          if (chain.length >= 3) {
            // check if start and last share exitDigit → can eliminate exitDigit from common peers
            const startExitDigit = startCands.find(v => v !== startDigit)!;
            if (exitDigit === startExitDigit) {
              const eliminations: HintCoordinate[] = [];
              for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                  if (currentBoard.value[r]![c] !== 0) continue;
                  if (chain.some(ch => ch.r === r && ch.c === c)) continue;
                  if (seesCell(r, c, start.r, start.c) && seesCell(r, c, last.r, last.c) && candidates[r]![c]!.includes(exitDigit)) {
                    eliminations.push({ r, c, type: 'elimination' });
                  }
                }
              }
              if (eliminations.length > 0) {
                const target = eliminations[0]!;
                const chainDesc = chain.map(ch => `R${ch.r+1}K${ch.c+1}`).join('→');
                return {
                  title: `XY-Chain (length ${chain.length})`,
                  targetCell: { r: target.r, c: target.c },
                  targetNum: solvedBoard.value[target.r]![target.c]!,
                  steps: [
                    {
                      label: "Step 1 — Find the XY-Chain",
                      description: `Chain of bivalue cells: ${chainDesc}. Every two adjacent cells share one candidate and "see" each other. Regardless of the direction in which the chain resolves, digit ${exitDigit} must be at one of the two chain ends (blue).`,
                      highlightCoords: chain.map(ch => ({ r: ch.r, c: ch.c, type: 'trigger' as const }))
                    },
                    {
                      label: "Step 2 — Eliminate the shared candidate",
                      description: `Cells that see both ends of the chain (red) can never have ${exitDigit} — one chain end always holds ${exitDigit}. This elimination can open the path to the solution.`,
                      highlightCoords: eliminations
                    }
                  ]
                };
              }
            }
          }

          // continue chain
          for (const next of bivalueCells) {
            if (chain.some(ch => ch.r === next.r && ch.c === next.c)) continue;
            if (!seesCell(last.r, last.c, next.r, next.c)) continue;
            const nextCands = candidates[next.r]![next.c]!;
            if (!nextCands.includes(exitDigit)) continue;
            const result = dfs([...chain, next], exitDigit);
            if (result) return result;
          }
          return null;
        };

        const result = dfs([start], startDigit);
        if (result) return result;
      }
    }
    return null;
  }

  function findBUG(candidates: number[][][]): ComplexHint | null {
    // BUG+1: all empty cells have exactly 2 candidates except one cell with 3.
    // The extra candidate in that trivalue cell is the answer.
    let trivialCell: CellCoord | null = null;
    let triCands: number[] = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r]![c] !== 0) continue;
        const cands = candidates[r]![c]!;
        if (cands.length === 2) continue;
        if (cands.length === 3) {
          if (trivialCell) return null; // more than one trivalue cell — not BUG+1
          trivialCell = { r, c };
          triCands = cands;
        } else {
          return null; // cell with 0, 1, or 4+ candidates — not BUG
        }
      }
    }
    if (!trivialCell) return null;

    // The "BUG digit" is whichever of the 3 candidates appears more than twice in its row, col, or box
    const { r, c } = trivialCell;
    let bugDigit = -1;
    for (const val of triCands) {
      let rowCount = 0, colCount = 0, boxCount = 0;
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 9; i++) {
        if (currentBoard.value[r]![i] === 0 && candidates[r]![i]!.includes(val)) rowCount++;
        if (currentBoard.value[i]![c] === 0 && candidates[i]![c]!.includes(val)) colCount++;
      }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (currentBoard.value[br+i]![bc+j] === 0 && candidates[br+i]![bc+j]!.includes(val)) boxCount++;
      }
      if (rowCount > 2 || colCount > 2 || boxCount > 2) { bugDigit = val; break; }
    }
    if (bugDigit === -1) bugDigit = triCands[0]!; // fallback: pick first

    return {
      title: "BUG+1 (Bivalue Universal Grave)",
      targetCell: trivialCell,
      targetNum: bugDigit,
      steps: [
        {
          label: "Step 1 — Detect BUG+1 state",
          description: `Almost every empty cell has exactly two candidates — that is the "Bivalue Universal Grave" (BUG) state. The only exception is cell [R${r+1}C${c+1}] which has three candidates: [${triCands.join(',')}]. If we don't enter the correct digit here, the puzzle would deadlock with multiple solutions.`,
          highlightCoords: [{ r, c, type: 'trigger' }]
        },
        {
          label: "Step 2 — Enter the BUG digit",
          description: `The only candidate that breaks the BUG symmetry is ${bugDigit} — it appears an odd number of times in its row, column, or box. Entering ${bugDigit} resolves the BUG and guarantees solution uniqueness.`,
          highlightCoords: [{ r, c, type: 'trigger' }]
        }
      ]
    };
  }

  function findEmptyRectangle(candidates: number[][][]): ComplexHint | null {
    // ER: within a box, val candidates all lie on one row OR one col (the "conjugate line")
    // combined with a strong link on another row/col → elimination
    for (let val = 1; val <= 9; val++) {
      for (let box = 0; box < 9; box++) {
        const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
        const boxCells: CellCoord[] = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          if (currentBoard.value[sr+i]![sc+j] === 0 && candidates[sr+i]![sc+j]!.includes(val))
            boxCells.push({ r: sr+i, c: sc+j });
        }
        if (boxCells.length < 2) continue;

        // check if all box candidates share a row
        const boxRows = [...new Set(boxCells.map(x => x.r))];
        const boxCols = [...new Set(boxCells.map(x => x.c))];
        const erRow = boxRows.length === 1 ? boxRows[0]! : -1;
        const erCol = boxCols.length === 1 ? boxCols[0]! : -1;

        if (erRow === -1 && erCol === -1) continue;

        // find a column (if erRow) or row (if erCol) with exactly 2 candidates for val
        // where one sees the ER line and the other is the elimination target
        if (erRow !== -1) {
          // ER is on erRow inside box. Look for col with exactly 2 occurrences of val:
          // one in erRow (outside the box) → strong link → the other is the elimination
          for (let c = 0; c < 9; c++) {
            if (c >= sc && c < sc + 3) continue; // must be outside the box
            const colCands: number[] = [];
            for (let r = 0; r < 9; r++) {
              if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) colCands.push(r);
            }
            if (colCands.length !== 2) continue;
            const [rA, rB] = colCands as [number, number];
            // one of them must be erRow
            const linkRow = rA === erRow ? rA : (rB === erRow ? rB : -1);
            const otherRow = rA === erRow ? rB : (rB === erRow ? rA : -1);
            if (linkRow === -1) continue;
            // elimination: cell (otherRow, col-of-ER-in-box) where it sees the box col
            for (let erBoxCol = sc; erBoxCol < sc + 3; erBoxCol++) {
              if (currentBoard.value[otherRow]![erBoxCol] === 0 && candidates[otherRow]![erBoxCol]!.includes(val)) {
                return {
                  title: "Empty Rectangle",
                  targetCell: { r: otherRow, c: erBoxCol },
                  targetNum: solvedBoard.value[otherRow]![erBoxCol]!,
                  steps: [
                    {
                      label: "Step 1 — Spot the Empty Rectangle in the box",
                      description: `In box ${box+1}, all candidates for ${val} lie in row ${erRow+1} (blue). This creates an "empty rectangle" — the rest of the box has no ${val}. Column ${c+1} has a strong link for ${val}: only in rows ${rA+1} and ${rB+1}.`,
                      highlightCoords: boxCells.map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                    },
                    {
                      label: "Step 2 — Eliminate via combined links",
                      description: `The strong link in column ${c+1} and the box alignment together guarantee that ${val} must be in row ${erRow+1} or in the box column containing the ER. Cell [R${otherRow+1}C${erBoxCol+1}] sees both — therefore ${val} is eliminated from it.`,
                      highlightCoords: [{ r: otherRow, c: erBoxCol, type: 'elimination' }]
                    }
                  ]
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function findWWing(candidates: number[][][]): ComplexHint | null {
    // W-Wing: two bivalue cells [p,q] connected via a strong link on p → eliminate q from cells seeing both bivalue cells
    for (let r1 = 0; r1 < 9; r1++) {
      for (let c1 = 0; c1 < 9; c1++) {
        if (currentBoard.value[r1]![c1] !== 0) continue;
        const cands1 = candidates[r1]![c1]!;
        if (cands1.length !== 2) continue;
        const [p, q] = cands1 as [number, number];

        for (let r2 = 0; r2 < 9; r2++) {
          for (let c2 = 0; c2 < 9; c2++) {
            if (r2 === r1 && c2 === c1) continue;
            if (currentBoard.value[r2]![c2] !== 0) continue;
            const cands2 = candidates[r2]![c2]!;
            if (cands2.length !== 2 || !cands2.includes(p) || !cands2.includes(q)) continue;
            if (seesCell(r1, c1, r2, c2)) continue; // must NOT see each other directly

            // find a strong link on p connecting them (a unit where p appears exactly twice: in a cell seeing c1 and a cell seeing c2)
            // simplification: check rows/cols/boxes where p has exactly 2 occurrences and one sees c1, other sees c2
            let linked = false;
            // check rows
            for (let r = 0; r < 9 && !linked; r++) {
              const pCols = [] as number[];
              for (let c = 0; c < 9; c++) {
                if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(p)) pCols.push(c);
              }
              if (pCols.length !== 2) continue;
              const [ca, cb] = pCols as [number, number];
              if ((seesCell(r1, c1, r, ca) && seesCell(r2, c2, r, cb)) ||
                  (seesCell(r1, c1, r, cb) && seesCell(r2, c2, r, ca))) linked = true;
            }
            // check cols
            for (let c = 0; c < 9 && !linked; c++) {
              const pRows = [] as number[];
              for (let r = 0; r < 9; r++) {
                if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(p)) pRows.push(r);
              }
              if (pRows.length !== 2) continue;
              const [ra, rb] = pRows as [number, number];
              if ((seesCell(r1, c1, ra, c) && seesCell(r2, c2, rb, c)) ||
                  (seesCell(r1, c1, rb, c) && seesCell(r2, c2, ra, c))) linked = true;
            }
            if (!linked) continue;

            const eliminations: HintCoordinate[] = [];
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                if (currentBoard.value[r]![c] !== 0) continue;
                if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
                if (seesCell(r, c, r1, c1) && seesCell(r, c, r2, c2) && candidates[r]![c]!.includes(q)) {
                  eliminations.push({ r, c, type: 'elimination' });
                }
              }
            }
            if (eliminations.length === 0) continue;

            const target = eliminations[0]!;
            return {
              title: "W-Wing",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Step 1 — Find the W-Wing structure",
                  description: `Two cells [R${r1+1}C${c1+1}] and [R${r2+1}C${c2+1}] have the same candidates [${p},${q}] and cannot see each other. They are connected by a "strong link" on digit ${p} — there is a unit where ${p} can only go into two cells, one seeing the first bivalue cell and the other seeing the second. This guarantees at least one of the bivalue cells contains ${q}.`,
                  highlightCoords: [
                    { r: r1, c: c1, type: 'trigger' },
                    { r: r2, c: c2, type: 'trigger' }
                  ]
                },
                {
                  label: "Step 2 — Eliminate q from cells that see both",
                  description: `Every cell that sees both [R${r1+1}C${c1+1}] and [R${r2+1}C${c2+1}] (red) cannot contain ${q} — because one of the bivalue cells always holds ${q}, without exception.`,
                  highlightCoords: eliminations
                }
              ]
            };
          }
        }
      }
    }
    return null;
  }

  function findJellyfish(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      // Row-based Jellyfish: 4 rows each with 2–4 candidates, union of cols = exactly 4
      const rowData: { r: number; cols: number[] }[] = [];
      for (let r = 0; r < 9; r++) {
        const cols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) cols.push(c);
        }
        if (cols.length >= 2 && cols.length <= 4) rowData.push({ r, cols });
      }
      for (let i = 0; i < rowData.length; i++) {
        for (let j = i + 1; j < rowData.length; j++) {
          for (let k = j + 1; k < rowData.length; k++) {
            for (let l = k + 1; l < rowData.length; l++) {
              const ri = rowData[i]!, rj = rowData[j]!, rk = rowData[k]!, rl = rowData[l]!;
              const colUnion = [...new Set([...ri.cols, ...rj.cols, ...rk.cols, ...rl.cols])];
              if (colUnion.length !== 4) continue;
              const eliminations: HintCoordinate[] = [];
              for (const c of colUnion) {
                for (let r = 0; r < 9; r++) {
                  if (r === ri.r || r === rj.r || r === rk.r || r === rl.r) continue;
                  if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) {
                    eliminations.push({ r, c, type: 'elimination' });
                  }
                }
              }
              if (eliminations.length === 0) continue;
              const allRows = [ri, rj, rk, rl];
              const triggerCoords: HintCoordinate[] = allRows.flatMap(rd => rd.cols.map(c => ({ r: rd.r, c, type: 'trigger' as const })));
              const target = eliminations[0]!;
              return {
                title: "Jellyfish",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Step 1 — Find the Jellyfish matrix",
                    description: `Digit ${val} appears in 2–4 places in each of four rows (${allRows.map(rd => rd.r+1).join(', ')}), and all candidates fall within exactly 4 columns. This is a four-dimensional X-Wing (or two-dimensional Swordfish): ${val} is "locked" inside that 4×4 grid (blue).`,
                    highlightCoords: triggerCoords
                  },
                  {
                    label: "Step 2 — Eliminate from those columns",
                    description: `Regardless of the arrangement inside the matrix, ${val} covers all four columns across those four rows. Therefore ${val} cannot appear in any other cell of those columns (red).`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }
    return null;
  }

  function findUniqueRectangle(candidates: number[][][]): ComplexHint | null {
    for (let r1 = 0; r1 < 8; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (Math.floor(r1 / 3) === Math.floor(r2 / 3)) continue;
        for (let c1 = 0; c1 < 8; c1++) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
            const corners = [
              { r: r1, c: c1 }, { r: r1, c: c2 },
              { r: r2, c: c1 }, { r: r2, c: c2 }
            ] as [CellCoord, CellCoord, CellCoord, CellCoord];
            if (corners.some(({ r, c }) => currentBoard.value[r]![c] !== 0)) continue;
            const cands = corners.map(({ r, c }) => candidates[r]![c]!);

            // detect a common pair {a,b} shared by at least 2 corners
            const pairCornerIdx = cands.reduce((acc, cd, i) => cd.length === 2 ? [...acc, i] : acc, [] as number[]);
            if (pairCornerIdx.length < 2) continue;
            const ref = cands[pairCornerIdx[0]!]!;
            if (!pairCornerIdx.slice(1).every(i => {
              const cd = cands[i]!;
              return cd.length === 2 && cd[0] === ref[0] && cd[1] === ref[1];
            })) continue;
            const [a, b] = ref as [number, number];

            // UR Type 1: exactly 3 corners are {a,b}, fourth has {a,b,+extras}
            if (pairCornerIdx.length === 3) {
              const floorIdx = [0,1,2,3].find(i => !pairCornerIdx.includes(i))!;
              const floor = corners[floorIdx]!;
              const floorCands = cands[floorIdx]!;
              if (!floorCands.includes(a) || !floorCands.includes(b)) continue;
              return {
                title: "Unique Rectangle — Type 1",
                targetCell: floor,
                targetNum: solvedBoard.value[floor.r]![floor.c]!,
                steps: [
                  {
                    label: "Step 1 — Find UR Type 1",
                    description: `Three cells of the rectangle have exactly [${a},${b}]. The fourth cell [R${floor.r+1}C${floor.c+1}] has additional candidates. If it also had only ${a} and ${b}, the puzzle would have multiple solutions — impossible in a valid sudoku.`,
                    highlightCoords: pairCornerIdx.map(i => ({ r: corners[i]!.r, c: corners[i]!.c, type: 'trigger' as const }))
                  },
                  {
                    label: "Step 2 — Eliminate the pair from the fourth cell",
                    description: `${a} and ${b} are eliminated from [R${floor.r+1}C${floor.c+1}] to guarantee solution uniqueness. The remaining candidates determine the correct value.`,
                    highlightCoords: [{ r: floor.r, c: floor.c, type: 'elimination' }]
                  }
                ]
              };
            }

            // UR Type 2: exactly 2 corners are {a,b}, the other two each have {a,b,c} for the SAME extra c
            if (pairCornerIdx.length === 2) {
              const extraIdx = [0,1,2,3].filter(i => !pairCornerIdx.includes(i));
              const cd0 = cands[extraIdx[0]!]!, cd1 = cands[extraIdx[1]!]!;
              if (cd0.length !== 3 || cd1.length !== 3) continue;
              if (!cd0.includes(a) || !cd0.includes(b) || !cd1.includes(a) || !cd1.includes(b)) continue;
              const extra0 = cd0.find(v => v !== a && v !== b)!;
              const extra1 = cd1.find(v => v !== a && v !== b)!;
              if (extra0 !== extra1) continue;
              const extraDigit = extra0;
              const exCell0 = corners[extraIdx[0]!]!, exCell1 = corners[extraIdx[1]!]!;
              // eliminate extraDigit from cells that see both extra corners
              const eliminations: HintCoordinate[] = [];
              for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                  if (currentBoard.value[r]![c] !== 0) continue;
                  if ((r === exCell0.r && c === exCell0.c) || (r === exCell1.r && c === exCell1.c)) continue;
                  if (seesCell(r, c, exCell0.r, exCell0.c) && seesCell(r, c, exCell1.r, exCell1.c) && candidates[r]![c]!.includes(extraDigit)) {
                    eliminations.push({ r, c, type: 'elimination' });
                  }
                }
              }
              if (eliminations.length === 0) continue;
              const target = eliminations[0]!;
              return {
                title: "Unique Rectangle — Type 2",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Step 1 — Find UR Type 2",
                    description: `Two cells of the rectangle are exactly [${a},${b}]. The other two are [${a},${b},${extraDigit}] — the same extra candidate ${extraDigit}. If ${extraDigit} is not in one of those cells, the puzzle deadlocks with multiple solutions. Therefore ${extraDigit} must be in one of them.`,
                    highlightCoords: [exCell0, exCell1].map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                  },
                  {
                    label: "Step 2 — Eliminate extra digit from shared peers",
                    description: `Since ${extraDigit} must be in [R${exCell0.r+1}C${exCell0.c+1}] or [R${exCell1.r+1}C${exCell1.c+1}], any cell that sees both (red) cannot contain ${extraDigit}.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }
    return null;
  }

  function findTwoStringKite(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      // For each row with exactly 2 candidates and each column with exactly 2 candidates
      // that share a cell in the same box, we can eliminate val from cell that sees the other row-end and col-end
      for (let r = 0; r < 9; r++) {
        const rCols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) rCols.push(c);
        }
        if (rCols.length !== 2) continue;

        for (let c = 0; c < 9; c++) {
          const cRows: number[] = [];
          for (let r2 = 0; r2 < 9; r2++) {
            if (currentBoard.value[r2]![c] === 0 && candidates[r2]![c]!.includes(val)) cRows.push(r2);
          }
          if (cRows.length !== 2) continue;

          // find intersection: row r must have a candidate in column c, and col c must have candidate in row r
          if (!rCols.includes(c)) continue;
          if (!cRows.includes(r)) continue;

          // shared cell is (r, c) — both strings meet here in the same box
          const rowEnd = rCols.find(cc => cc !== c)!;
          const colEnd = cRows.find(rr => rr !== r)!;

          // the two "tails" are (r, rowEnd) and (colEnd, c)
          // any cell seeing both tails can have val eliminated
          const eliminations: HintCoordinate[] = [];
          for (let er = 0; er < 9; er++) {
            for (let ec = 0; ec < 9; ec++) {
              if (currentBoard.value[er]![ec] !== 0) continue;
              if ((er === r && ec === rowEnd) || (er === colEnd && ec === c)) continue;
              if (seesCell(er, ec, r, rowEnd) && seesCell(er, ec, colEnd, c) && candidates[er]![ec]!.includes(val)) {
                eliminations.push({ r: er, c: ec, type: 'elimination' });
              }
            }
          }
          if (eliminations.length === 0) continue;
          const target = eliminations[0]!;
          return {
            title: "Two-String Kite",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Step 1 — Find the Two-String Kite",
                description: `Digit ${val} has exactly two candidates in row ${r+1} and exactly two in column ${c+1}. Both "kite strings" share cell [R${r+1}C${c+1}] inside the same 3×3 box. Regardless of whether ${val} is in [R${r+1}C${rowEnd+1}] or [R${colEnd+1}C${c+1}] — one end always holds ${val}.`,
                highlightCoords: [
                  { r, c: rCols[0]!, type: 'trigger' },
                  { r, c: rCols[1]!, type: 'trigger' },
                  { r: cRows[0]!, c, type: 'trigger' },
                  { r: cRows[1]!, c, type: 'trigger' }
                ]
              },
              {
                label: "Step 2 — Eliminate from cells that see both ends",
                description: `Cells that see both [R${r+1}C${rowEnd+1}] and [R${colEnd+1}C${c+1}] (red) cannot have ${val} — one of the two kite ends always holds it. This is the equivalent of a Skyscraper but shaped like a kite instead.`,
                highlightCoords: eliminations
              }
            ]
          };
        }
      }
    }
    return null;
  }

  function findSkyscraper(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      // Row-based: two rows each with exactly 2 candidates, sharing exactly one column
      const rowData: { r: number; cols: [number, number] }[] = [];
      for (let r = 0; r < 9; r++) {
        const cols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) cols.push(c);
        }
        if (cols.length === 2) rowData.push({ r, cols: [cols[0]!, cols[1]!] });
      }
      for (let i = 0; i < rowData.length; i++) {
        for (let j = i + 1; j < rowData.length; j++) {
          const ra = rowData[i]!, rb = rowData[j]!;
          // find shared column (the "base") and unshared columns (the "tops")
          let sharedCol = -1, topA = -1, topB = -1;
          if (ra.cols[0] === rb.cols[0]) { sharedCol = ra.cols[0]; topA = ra.cols[1]; topB = rb.cols[1]; }
          else if (ra.cols[0] === rb.cols[1]) { sharedCol = ra.cols[0]; topA = ra.cols[1]; topB = rb.cols[0]; }
          else if (ra.cols[1] === rb.cols[0]) { sharedCol = ra.cols[1]; topA = ra.cols[0]; topB = rb.cols[1]; }
          else if (ra.cols[1] === rb.cols[1]) { sharedCol = ra.cols[1]; topA = ra.cols[0]; topB = rb.cols[0]; }
          if (sharedCol === -1) continue;
          // shared column must be in different boxes (otherwise it's an X-Wing)
          if (Math.floor(ra.r / 3) === Math.floor(rb.r / 3)) continue;

          // eliminate val from cells that see both tops
          const eliminations: HintCoordinate[] = [];
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (currentBoard.value[r]![c] !== 0) continue;
              if ((r === ra.r && c === topA) || (r === rb.r && c === topB)) continue;
              if (seesCell(r, c, ra.r, topA) && seesCell(r, c, rb.r, topB) && candidates[r]![c]!.includes(val)) {
                eliminations.push({ r, c, type: 'elimination' });
              }
            }
          }
          if (eliminations.length === 0) continue;
          const target = eliminations[0]!;
          return {
            title: "Skyscraper",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Step 1 — Find the Skyscraper structure",
                description: `Digit ${val} appears exactly twice in row ${ra.r+1} (cols ${ra.cols[0]+1} and ${ra.cols[1]+1}) and twice in row ${rb.r+1} (cols ${rb.cols[0]+1} and ${rb.cols[1]+1}). They share column ${sharedCol+1} but in different boxes — like a skyscraper leaning on the same pillar. The tops (blue: C${topA+1} and C${topB+1}) must contain ${val} in at least one of those two rows.`,
                highlightCoords: [
                  { r: ra.r, c: ra.cols[0]!, type: 'trigger' },
                  { r: ra.r, c: ra.cols[1]!, type: 'trigger' },
                  { r: rb.r, c: rb.cols[0]!, type: 'trigger' },
                  { r: rb.r, c: rb.cols[1]!, type: 'trigger' }
                ]
              },
              {
                label: "Step 2 — Eliminate from cells that see both tops",
                description: `If ${val} is not at top C${topA+1} in row ${ra.r+1}, it must be at C${topA+1}... and vice versa for the second row. Every cell that sees both tops (red) cannot have ${val} — one of the tops always holds it.`,
                highlightCoords: eliminations
              }
            ]
          };
        }
      }
    }
    return null;
  }

  function findSwordfish(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      // Row-based Swordfish
      const rowData: { r: number; cols: number[] }[] = [];
      for (let r = 0; r < 9; r++) {
        const cols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) cols.push(c);
        }
        if (cols.length >= 2 && cols.length <= 3) rowData.push({ r, cols });
      }
      for (let i = 0; i < rowData.length; i++) {
        for (let j = i + 1; j < rowData.length; j++) {
          for (let k = j + 1; k < rowData.length; k++) {
            const ri = rowData[i]!, rj = rowData[j]!, rk = rowData[k]!;
            const colUnion = [...new Set([...ri.cols, ...rj.cols, ...rk.cols])];
            if (colUnion.length !== 3) continue;
            const eliminations: HintCoordinate[] = [];
            for (const c of colUnion) {
              for (let r = 0; r < 9; r++) {
                if (r === ri.r || r === rj.r || r === rk.r) continue;
                if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) {
                  eliminations.push({ r, c, type: 'elimination' });
                }
              }
            }
            if (eliminations.length === 0) continue;
            const triggerCoords: HintCoordinate[] = [
              ...[...ri.cols].map(c => ({ r: ri.r, c, type: 'trigger' as const })),
              ...[...rj.cols].map(c => ({ r: rj.r, c, type: 'trigger' as const })),
              ...[...rk.cols].map(c => ({ r: rk.r, c, type: 'trigger' as const }))
            ];
            const target = eliminations[0]!;
            return {
              title: "Swordfish",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Step 1 — Find the Swordfish matrix",
                  description: `Digit ${val} appears in 2–3 places in each of rows ${ri.r+1}, ${rj.r+1} and ${rk.r+1}, and all candidates fall within exactly 3 columns. Like a three-dimensional X-Wing: ${val} must be in one of the cells of that 3×3 grid (blue).`,
                  highlightCoords: triggerCoords
                },
                {
                  label: "Step 2 — Eliminate from those columns",
                  description: `Regardless of the arrangement inside the matrix, ${val} covers all three columns across those three rows. Therefore ${val} cannot appear in any other cell of those columns (red) — the elimination applies to entire columns.`,
                  highlightCoords: eliminations
                }
              ]
            };
          }
        }
      }
    }
    return null;
  }

  function findBoxLineReduction(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      // Row → box: val in a row is confined to one box → eliminate from rest of that box
      for (let r = 0; r < 9; r++) {
        const cols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) cols.push(c);
        }
        if (cols.length === 0) continue;
        const boxCols = cols.map(c => Math.floor(c / 3));
        if (boxCols.every(bc => bc === boxCols[0]!)) {
          const boxCol = boxCols[0]! * 3;
          const boxRow = Math.floor(r / 3) * 3;
          const eliminations: HintCoordinate[] = [];
          for (let r2 = boxRow; r2 < boxRow + 3; r2++) {
            if (r2 === r) continue;
            for (let c2 = boxCol; c2 < boxCol + 3; c2++) {
              if (currentBoard.value[r2]![c2] === 0 && candidates[r2]![c2]!.includes(val)) {
                eliminations.push({ r: r2, c: c2, type: 'elimination' });
              }
            }
          }
          if (eliminations.length === 0) continue;
          const target = eliminations[0]!;
          return {
            title: "Box-Line Reduction — Row",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Step 1 — Digit locked to one row inside the box",
                description: `In row ${r+1}, digit ${val} only appears in cells that all lie within the same 3×3 box (blue). This means ${val} must go into one of those cells — exclusively within that row inside the box.`,
                highlightCoords: cols.map(c => ({ r, c, type: 'trigger' as const }))
              },
              {
                label: "Step 2 — Eliminate from the rest of the box",
                description: `Since ${val} must be in row ${r+1} inside that box, it cannot appear in any other cell of that same box (red). This elimination is called Box-Line Reduction — the complement of Pointing Pair.`,
                highlightCoords: eliminations
              }
            ]
          };
        }
      }

      // Col → box: val in a col is confined to one box → eliminate from rest of that box
      for (let c = 0; c < 9; c++) {
        const rows: number[] = [];
        for (let r = 0; r < 9; r++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) rows.push(r);
        }
        if (rows.length === 0) continue;
        const boxRows = rows.map(r => Math.floor(r / 3));
        if (boxRows.every(br => br === boxRows[0]!)) {
          const boxRow = boxRows[0]! * 3;
          const boxCol = Math.floor(c / 3) * 3;
          const eliminations: HintCoordinate[] = [];
          for (let c2 = boxCol; c2 < boxCol + 3; c2++) {
            if (c2 === c) continue;
            for (let r2 = boxRow; r2 < boxRow + 3; r2++) {
              if (currentBoard.value[r2]![c2] === 0 && candidates[r2]![c2]!.includes(val)) {
                eliminations.push({ r: r2, c: c2, type: 'elimination' });
              }
            }
          }
          if (eliminations.length === 0) continue;
          const target = eliminations[0]!;
          return {
            title: "Box-Line Reduction — Column",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Step 1 — Digit locked to one column inside the box",
                description: `In column ${c+1}, digit ${val} only appears in cells that all lie within the same 3×3 box (blue). ${val} must go into one of those cells — exclusively within that column inside the box.`,
                highlightCoords: rows.map(r => ({ r, c, type: 'trigger' as const }))
              },
              {
                label: "Step 2 — Eliminate from the rest of the box",
                description: `Since ${val} must be in column ${c+1} inside that box, it cannot appear in any other cell of that box (red). Box-Line Reduction is the complement of the Pointing Pair technique.`,
                highlightCoords: eliminations
              }
            ]
          };
        }
      }
    }
    return null;
  }

  function findHiddenQuads(candidates: number[][][]): ComplexHint | null {
    const units: { cells: CellCoord[]; label: string }[] = [];
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Row ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Column ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Box ${box+1}` });
    }

    for (const { cells: unitCells, label } of units) {
      const emptyCells = unitCells.filter(({ r, c }) => currentBoard.value[r]![c] === 0);
      const digits = [1,2,3,4,5,6,7,8,9];
      for (let vi = 0; vi < 6; vi++) {
        for (let vj = vi+1; vj < 7; vj++) {
          for (let vk = vj+1; vk < 8; vk++) {
            for (let vl = vk+1; vl < 9; vl++) {
              const quad = [digits[vi]!, digits[vj]!, digits[vk]!, digits[vl]!];
              const cellsWithAny = emptyCells.filter(({ r, c }) => quad.some(v => candidates[r]![c]!.includes(v)));
              if (cellsWithAny.length !== 4) continue;
              if (!quad.every(v => cellsWithAny.some(({ r, c }) => candidates[r]![c]!.includes(v)))) continue;

              const [a,b,c2,d] = cellsWithAny as [CellCoord,CellCoord,CellCoord,CellCoord];
              const eliminations: HintCoordinate[] = [];
              for (const cell of [a,b,c2,d]) {
                for (const cand of candidates[cell.r]![cell.c]!) {
                  if (!quad.includes(cand)) eliminations.push({ r: cell.r, c: cell.c, type: 'elimination' });
                }
              }
              if (eliminations.length === 0) continue;

              return {
                title: `Hidden Quad — ${label}`,
                targetCell: a,
                targetNum: solvedBoard.value[a.r]![a.c]!,
                steps: [
                  {
                    label: "Step 1 — Find the Hidden Quad",
                    description: `Digits ${quad.join(', ')} can only go into four cells within ${label}. These cells have other candidates, but ${quad.join(', ')} are exclusive to this quad — they cannot go anywhere else in the unit.`,
                    highlightCoords: [a,b,c2,d].map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                  },
                  {
                    label: "Step 2 — Eliminate other candidates from the quad",
                    description: `Since ${quad.join(', ')} must fill exactly those four cells, all other candidates within them are impossible and are removed (red). This converts the hidden quad into a naked quad.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }
    return null;
  }

  function findHiddenTriples(candidates: number[][][]): ComplexHint | null {
    const units: { cells: CellCoord[]; label: string }[] = [];
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Row ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Column ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Box ${box+1}` });
    }

    for (const { cells: unitCells, label } of units) {
      const emptyCells = unitCells.filter(({ r, c }) => currentBoard.value[r]![c] === 0);
      // try all combos of 3 digits
      for (let vi = 1; vi <= 7; vi++) {
        for (let vj = vi + 1; vj <= 8; vj++) {
          for (let vk = vj + 1; vk <= 9; vk++) {
            // cells that contain at least one of vi,vj,vk
            const triple = [vi, vj, vk];
            const cellsWithAny = emptyCells.filter(({ r, c }) => triple.some(v => candidates[r]![c]!.includes(v)));
            if (cellsWithAny.length !== 3) continue;
            // each of the three digits must appear in at least one of those cells
            if (!triple.every(v => cellsWithAny.some(({ r, c }) => candidates[r]![c]!.includes(v)))) continue;

            const [a, b, c2] = cellsWithAny as [CellCoord, CellCoord, CellCoord];
            const eliminations: HintCoordinate[] = [];
            for (const cell of [a, b, c2]) {
              for (const cand of candidates[cell.r]![cell.c]!) {
                if (!triple.includes(cand)) eliminations.push({ r: cell.r, c: cell.c, type: 'elimination' });
              }
            }
            if (eliminations.length === 0) continue;

            return {
              title: `Hidden Triple — ${label}`,
              targetCell: a,
              targetNum: solvedBoard.value[a.r]![a.c]!,
              steps: [
                {
                  label: "Step 1 — Find the Hidden Triple",
                  description: `Digits ${vi}, ${vj} and ${vk} can only go into cells [R${a.r+1}C${a.c+1}], [R${b.r+1}C${b.c+1}] and [R${c2.r+1}C${c2.c+1}] within ${label}. This triple is "hidden" — the cells have other candidates, but ${vi}, ${vj}, ${vk} are exclusive to these three cells.`,
                  highlightCoords: [
                    { r: a.r, c: a.c, type: 'trigger' },
                    { r: b.r, c: b.c, type: 'trigger' },
                    { r: c2.r, c: c2.c, type: 'trigger' }
                  ]
                },
                {
                  label: "Step 2 — Eliminate other candidates from the triple",
                  description: `Since ${vi}, ${vj} and ${vk} must fill exactly those three cells, all other candidates in them are impossible (red). Eliminating them reveals new naked singles or pairs.`,
                  highlightCoords: eliminations
                }
              ]
            };
          }
        }
      }
    }
    return null;
  }

  function findHiddenPairs(candidates: number[][][]): ComplexHint | null {
    const units: CellCoord[][] = [];
    for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => ({ r, c })));
    for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => ({ r, c })));
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push(cells);
    }

    for (const unit of units) {
      const emptyCells = unit.filter(({ r, c }) => currentBoard.value[r]![c] === 0);
      for (let vi = 1; vi <= 9; vi++) {
        for (let vj = vi + 1; vj <= 9; vj++) {
          const cellsWithVi = emptyCells.filter(({ r, c }) => candidates[r]![c]!.includes(vi));
          const cellsWithVj = emptyCells.filter(({ r, c }) => candidates[r]![c]!.includes(vj));
          if (cellsWithVi.length !== 2 || cellsWithVj.length !== 2) continue;
          if (cellsWithVi[0]!.r !== cellsWithVj[0]!.r || cellsWithVi[0]!.c !== cellsWithVj[0]!.c) continue;
          if (cellsWithVi[1]!.r !== cellsWithVj[1]!.r || cellsWithVi[1]!.c !== cellsWithVj[1]!.c) continue;

          const a = cellsWithVi[0]!;
          const b = cellsWithVi[1]!;
          const eliminations: HintCoordinate[] = [];
          for (const cell of [a, b]) {
            for (const cand of candidates[cell.r]![cell.c]!) {
              if (cand !== vi && cand !== vj) eliminations.push({ r: cell.r, c: cell.c, type: 'elimination' });
            }
          }
          if (eliminations.length === 0) continue;

          return {
            title: "Hidden Pair",
            targetCell: a,
            targetNum: solvedBoard.value[a.r]![a.c]!,
            steps: [
              {
                label: "Step 1 — Find the Hidden Pair",
                description: `Digits ${vi} and ${vj} can only go into cells [R${a.r+1}C${a.c+1}] and [R${b.r+1}C${b.c+1}] within this unit. Even if those cells have other candidates, ${vi} and ${vj} are "hidden" inside them — they cannot go anywhere else in the unit.`,
                highlightCoords: [
                  { r: a.r, c: a.c, type: 'trigger' },
                  { r: b.r, c: b.c, type: 'trigger' }
                ]
              },
              {
                label: "Step 2 — Eliminate other candidates from the pair",
                description: `Since ${vi} and ${vj} must occupy exactly those two cells, all other candidates in them are impossible and can be eliminated (red). This effectively converts the hidden pair into a naked pair.`,
                highlightCoords: eliminations
              }
            ]
          };
        }
      }
    }
    return null;
  }

  function findXWing(candidates: number[][][]): ComplexHint | null {
    for (let val = 1; val <= 9; val++) {
      const rowsWithTwo: { r: number; cols: [number, number] }[] = [];
      for (let r = 0; r < 9; r++) {
        const cols: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0 && candidates[r]![c]!.includes(val)) cols.push(c);
        }
        if (cols.length === 2) rowsWithTwo.push({ r, cols: [cols[0]!, cols[1]!] });
      }

      for (let i = 0; i < rowsWithTwo.length; i++) {
        for (let j = i + 1; j < rowsWithTwo.length; j++) {
          const r1 = rowsWithTwo[i]!;
          const r2 = rowsWithTwo[j]!;
          if (r1.cols[0] === r2.cols[0] && r1.cols[1] === r2.cols[1]) {
            const c1 = r1.cols[0];
            const c2 = r1.cols[1];
            const eliminations: HintCoordinate[] = [];

            for (let r = 0; r < 9; r++) {
              if (r !== r1.r && r !== r2.r) {
                if (currentBoard.value[r]![c1] === 0 && candidates[r]![c1]!.includes(val)) {
                  eliminations.push({ r, c: c1, type: 'elimination' });
                }
                if (currentBoard.value[r]![c2] === 0 && candidates[r]![c2]!.includes(val)) {
                  eliminations.push({ r, c: c2, type: 'elimination' });
                }
              }
            }

            if (eliminations.length > 0) {
              return {
                title: "X-Wing",
                targetCell: { r: r1.r, c: c1 },
                targetNum: solvedBoard.value[r1.r]![c1]!,
                steps: [
                  {
                    label: "Step 1 — Find the candidate rectangle",
                    description: `Digit ${val} appears exactly twice in row ${r1.r+1} (columns ${c1+1} and ${c2+1}) and exactly twice in row ${r2.r+1} (the same columns). These four cells form a rectangle — the basis of the X-Wing technique. ${val} must lie on one of the two diagonals of that rectangle.`,
                    highlightCoords: [
                      { r: r1.r, c: c1, type: 'trigger' },
                      { r: r1.r, c: c2, type: 'trigger' },
                      { r: r2.r, c: c1, type: 'trigger' },
                      { r: r2.r, c: c2, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Step 2 — Eliminate from the rectangle's columns",
                    description: `Regardless of which diagonal is correct, ${val} must be in columns ${c1+1} and ${c2+1} within those two rows. Therefore ${val} cannot appear anywhere else in those columns. Red cells can have ${val} removed as a candidate.`,
                    highlightCoords: eliminations
                  }
                ]
              };
            }
          }
        }
      }
    }
    return null;
  }

  // --- MAIN HINT DISPATCHER ---
  function triggerComplexHint(hintStatus: { value: string }, hintBody: { value: string }) {
    const candidates = getGridCandidates(currentBoard.value);

    // Evaluate techniques from simplest to most advanced
    let hint = findNakedSingle(candidates);
    if (!hint) hint = findHiddenSingle(candidates);
    if (!hint) hint = findNakedPairs(candidates);
    if (!hint) hint = findHiddenPairs(candidates);
    if (!hint) hint = findNakedTriples(candidates);
    if (!hint) hint = findHiddenTriples(candidates);
    if (!hint) hint = findNakedQuads(candidates);
    if (!hint) hint = findHiddenQuads(candidates);
    if (!hint) hint = findPointingPair(candidates);
    if (!hint) hint = findBoxLineReduction(candidates);
    if (!hint) hint = findXWing(candidates);
    if (!hint) hint = findSwordfish(candidates);
    if (!hint) hint = findJellyfish(candidates);
    if (!hint) hint = findSkyscraper(candidates);
    if (!hint) hint = findTwoStringKite(candidates);
    if (!hint) hint = findEmptyRectangle(candidates);
    if (!hint) hint = findXYWing(candidates);
    if (!hint) hint = findXYZWing(candidates);
    if (!hint) hint = findWWing(candidates);
    if (!hint) hint = findUniqueRectangle(candidates);
    if (!hint) hint = findXYChain(candidates);
    if (!hint) hint = findSueDeCoq(candidates);
    if (!hint) hint = findBUG(candidates);

    // Fallback: fewest-candidates heuristic
    if (!hint) {
      let bestRow = -1;
      let bestCol = -1;
      let bestCandidates: number[] = [];
      let minDomainSize = 10;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (currentBoard.value[r]![c] === 0) {
            const cellCands = candidates[r]![c]!;
            if (cellCands.length > 0 && cellCands.length < minDomainSize) {
              minDomainSize = cellCands.length;
              bestRow = r;
              bestCol = c;
              bestCandidates = cellCands;
            }
          }
        }
      }

      if (bestRow !== -1) {
        const r = bestRow;
        const c = bestCol;
        const targetNum = solvedBoard.value[r]![c]!;
        const falseCandidates = bestCandidates.filter(v => v !== targetNum);
        const blockingCells: HintCoordinate[] = [];

        falseCandidates.forEach(cand => {
          for (let i = 0; i < 9; i++) {
            if (currentBoard.value[r]![i] === cand) blockingCells.push({ r, c: i, type: 'trigger' });
            if (currentBoard.value[i]![c] === cand) blockingCells.push({ r: i, c, type: 'trigger' });
          }
        });

        hint = {
          title: "Candidate Reduction (Analysis)",
          targetCell: { r, c },
          targetNum,
          steps: [
            {
              label: "Step 1 — Cell with fewest candidates",
              description: `Cell [R${r+1}C${c+1}] has the fewest remaining possibilities. Blue cells in its row and column block the wrong candidates, leaving only ${targetNum} as the only mathematically valid option. Try applying the earlier techniques for better understanding.`,
              highlightCoords: blockingCells
            },
            {
              label: "Step 2 — Confirm the answer",
              description: `After eliminating the wrong options, ${targetNum} is the only value that does not violate any sudoku rule for this cell. Click "Apply Answer" to confirm.`,
              highlightCoords: [{ r, c, type: 'trigger' }]
            }
          ]
        };
      }
    }

    if (hint) {
      activeComplexHint.value = hint;
      currentStepIndex.value = 0;
      selectedCell.value = hint.targetCell;
      updateStepHighlights();

      hintStatus.value = hint.title;
      hintBody.value = hint.steps[0]!.description;
    } else {
      hintStatus.value = "No empty cells!";
    }
  }

  function nextHintStep(onComplete: () => void) {
    if (!activeComplexHint.value) return;

    if (currentStepIndex.value < activeComplexHint.value.steps.length - 1) {
      currentStepIndex.value++;
      updateStepHighlights();
    } else {
      applyComplexHint();
      onComplete();
    }
  }

  function prevHintStep() {
    if (!activeComplexHint.value || currentStepIndex.value === 0) return;
    currentStepIndex.value--;
    updateStepHighlights();
  }

  function applyComplexHint() {
    if (!activeComplexHint.value) return;
    const { targetCell, targetNum } = activeComplexHint.value;

    saveHistory();
    currentBoard.value[targetCell.r]![targetCell.c] = targetNum;
    clearRelationalNotes(targetCell.r, targetCell.c, targetNum);
    cancelComplexHint();
  }

  function cancelComplexHint() {
    activeComplexHint.value = null;
    currentStepIndex.value = 0;
    activeHintCell.value = null;
    hintTriggers.value = [];
    hintEliminations.value = [];
  }

  function updateStepHighlights() {
    if (!activeComplexHint.value) {
      hintTriggers.value = [];
      hintEliminations.value = [];
      activeHintCell.value = null;
      return;
    }
    const step = activeComplexHint.value.steps[currentStepIndex.value];
    if (!step) return;
    activeHintCell.value = activeComplexHint.value.targetCell;
    hintTriggers.value = step.highlightCoords.filter(c => c.type === 'trigger');
    hintEliminations.value = step.highlightCoords.filter(c => c.type === 'elimination');
  }

  function restoreGame(save: {
    currentBoard: Grid;
    initialBoard: Grid;
    solvedBoard: Grid;
    notesBoard: NotesGrid;
  }): void {
    currentBoard.value = save.currentBoard.map(row => [...row]) as Grid;
    initialBoard.value = save.initialBoard.map(row => [...row]) as Grid;
    solvedBoard.value = save.solvedBoard.map(row => [...row]) as Grid;
    notesBoard.value = save.notesBoard.map(row => row.map(cell => [...cell])) as NotesGrid;
    selectedCell.value = null;
    activeComplexHint.value = null;
    currentStepIndex.value = 0;
    hintTriggers.value = [];
    hintEliminations.value = [];
    activeHintCell.value = null;
    boardHistory.value = [];
  }

  return {
    currentBoard,
    initialBoard,
    solvedBoard,
    notesBoard,
    selectedCell,
    conflictCells,
    numberCounts,
    activeHintCell,
    hintTriggers,
    hintEliminations,
    activeComplexHint,
    currentStepIndex,
    currentStep,
    isValid,
    getConflictCells,
    getGridCandidates,
    startNewGame,
    loadCustomBoard,
    restoreGame,
    eraseCell,
    clearRelationalNotes,
    saveHistory,
    undoMove,
    checkWinCondition,
    triggerComplexHint,
    nextHintStep,
    prevHintStep,
    applyComplexHint,
    cancelComplexHint
  };
}
