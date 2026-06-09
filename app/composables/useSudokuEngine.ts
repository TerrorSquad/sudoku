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
    if (difficulty === 'lako') removeCount = 30;
    if (difficulty === 'tesko') removeCount = 52;
    if (difficulty === 'ekspert') removeCount = 58;

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
            title: "Jedini Kandidat (Naked Single)",
            targetCell: { r, c },
            targetNum,
            steps: [
              {
                label: "Korak 1 — Pronađi blokirajuće ćelije",
                description: `Ćelija [Red ${r+1}, Kol ${c+1}] je okružena svim ostalim brojevima. Plavo označene ćelije u njenom redu, koloni i kutiji blokiraju svaki broj osim ${targetNum}. Naked Single znači da je samo jedan kandidat ostao — direktno vidljiv bez dodatne analize.`,
                highlightCoords: triggers
              },
              {
                label: "Korak 2 — Upiši jedini preostali broj",
                description: `Pošto su svi ostali brojevi (1–9, osim ${targetNum}) eliminirani iz ove ćelije konfliktima u njenom redu, koloni i kutiji, ${targetNum} je jedina ispravna vrijednost.`,
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
            title: "Skriveni Samac (Hidden Single) — Red",
            targetCell: { r, c },
            targetNum: val,
            steps: [
              {
                label: "Korak 1 — Skeniraj cijeli red",
                description: `Pregledaj sve prazne ćelije u redu ${r+1}. Broj ${val} nije moguć ni u jednoj drugoj ćeliji toga reda — blokiraju ga njihove kolone ili kutije. Popunjene ćelije (plavo) otkrivaju zašto. Ovo se zove Hidden Single jer je ${val} "skriven" unutar reda — ne vidi ga se odmah.`,
                highlightCoords: triggers
              },
              {
                label: "Korak 2 — Jedino slobodno mjesto za taj broj",
                description: `Budući da ${val} može stati samo u ćeliju [Red ${r+1}, Kol ${c+1}] unutar čitavog reda, to je jedino ispravno mjesto. Upisujemo ${val}.`,
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
            title: "Skriveni Samac (Hidden Single) — Kolona",
            targetCell: { r, c },
            targetNum: val,
            steps: [
              {
                label: "Korak 1 — Skeniraj cijelu kolonu",
                description: `Pregledaj sve prazne ćelije u koloni ${c+1}. Broj ${val} nije moguć ni u jednoj drugoj ćeliji te kolone — blokiraju ga njihovi redovi ili kutije. Popunjene ćelije (plavo) pokazuju zašto su ostale pozicije isključene.`,
                highlightCoords: triggers
              },
              {
                label: "Korak 2 — Jedino slobodno mjesto za taj broj",
                description: `Budući da ${val} može stati samo u ćeliju [Red ${r+1}, Kol ${c+1}] unutar čitave kolone ${c+1}, to je jedino ispravno mjesto. Upisujemo ${val}.`,
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
            title: "Skriveni Samac (Hidden Single) — Kutija",
            targetCell: { r, c },
            targetNum: val,
            steps: [
              {
                label: "Korak 1 — Skeniraj 3×3 kutiju",
                description: `Pogledaj kutiju ${box+1} (redovi ${startRow+1}–${startRow+3}, kolone ${startCol+1}–${startCol+3}). Broj ${val} nije moguć ni u jednoj drugoj praznoj ćeliji te kutije — blokiraju ga okolni redovi i kolone. Popunjene ćelije (plavo) to potvrđuju.`,
                highlightCoords: triggers
              },
              {
                label: "Korak 2 — Jedino slobodno mjesto u kutiji",
                description: `Budući da ${val} može stati samo u ćeliju [Red ${r+1}, Kol ${c+1}] unutar čitave kutije ${box+1}, to je jedino ispravno mjesto. Upisujemo ${val}.`,
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
                title: "Goli Par (Naked Pair) — Red",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi Goli Par",
                    description: `U redu ${r+1}, ćelije u kolonama ${a.c+1} i ${b.c+1} imaju isključivo iste kandidate [${a.v1}, ${a.v2}]. Goli Par znači: ova dva broja moraju ući u jednu od tih dviju ćelija — niti koji drugi broj ne može tamo, a ${a.v1} i ${a.v2} ne mogu nigdje drugdje u redu.`,
                    highlightCoords: [
                      { r, c: a.c, type: 'trigger' },
                      { r, c: b.c, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Korak 2 — Eliminiši par iz ostatka reda",
                    description: `Pošto su ${a.v1} i ${a.v2} "zaključani" u te dvije ćelije, sigurno ne mogu biti ni u jednoj drugoj ćeliji reda ${r+1}. Crveno označene ćelije mogu imati ${a.v1} ili ${a.v2} uklonjene iz liste kandidata, što otvara nove mogućnosti.`,
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
                title: "Goli Par (Naked Pair) — Kolona",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi Goli Par u koloni",
                    description: `U koloni ${c+1}, ćelije u redovima ${a.r+1} i ${b.r+1} imaju isključivo iste kandidate [${a.v1}, ${a.v2}]. Ta dva broja moraju ući u jednu od tih dviju ćelija — niti koji drugi nije moguć tamo, a ${a.v1} i ${a.v2} ne mogu biti nigdje drugdje u toj koloni.`,
                    highlightCoords: [
                      { r: a.r, c, type: 'trigger' },
                      { r: b.r, c, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Korak 2 — Eliminiši par iz ostatka kolone",
                    description: `Pošto su ${a.v1} i ${a.v2} "zaključani" u te dvije ćelije u koloni ${c+1}, mogu se ukloniti iz svih ostalih ćelija iste kolone (crveno). Ovo sužava kandidate i olakšava sljedeće korake.`,
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
                title: "Goli Par (Naked Pair) — Kutija",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi Goli Par u kutiji",
                    description: `U kutiji ${box+1}, ćelije [Red ${a.r+1}, Kol ${a.c+1}] i [Red ${b.r+1}, Kol ${b.c+1}] dijele iste kandidate [${a.v1}, ${a.v2}]. To znači da ${a.v1} i ${a.v2} moraju ući u jednu od tih dviju ćelija, bez izuzetka.`,
                    highlightCoords: [
                      { r: a.r, c: a.c, type: 'trigger' },
                      { r: b.r, c: b.c, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Korak 2 — Eliminiši par iz ostatka kutije",
                    description: `Budući da su ${a.v1} i ${a.v2} ekskluzivno vezani za te dvije ćelije u kutiji ${box+1}, mogu se ukloniti iz svih ostalih praznih ćelija iste kutije (crveno). Ovo može otvoriti nove Naked Single ili Hidden Single mogućnosti.`,
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
              title: "Pokazivački Par (Pointing Pair) — Red",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Korak 1 — Uoči poravnanje unutar kutije",
                  description: `U kutiji ${box+1}, svi preostali kandidati za broj ${val} nalaze se isključivo u redu ${targetRow+1} (plavo). Ovo znači da ${val} mora ići u jednu od tih ćelija — i ni u koju drugu u toj kutiji.`,
                  highlightCoords: cells.map(cell => ({ r: cell.r, c: cell.c, type: 'trigger' as const }))
                },
                {
                  label: "Korak 2 — Eliminiši iz ostatka reda",
                  description: `Zbog poravnanja unutar kutije, ${val} ne može biti ni u jednoj drugoj ćeliji reda ${targetRow+1} van te kutije. Crvene ćelije mogu imati ${val} uklonjen iz svojih kandidata, što simplifikuje dalje rješavanje.`,
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
              title: "Pokazivački Par (Pointing Pair) — Kolona",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Korak 1 — Uoči poravnanje unutar kutije",
                  description: `U kutiji ${box+1}, svi preostali kandidati za broj ${val} nalaze se isključivo u koloni ${targetCol+1} (plavo). Ovo znači da ${val} mora ići u jednu od tih ćelija — i ni u koju drugu u toj kutiji.`,
                  highlightCoords: cells.map(cell => ({ r: cell.r, c: cell.c, type: 'trigger' as const }))
                },
                {
                  label: "Korak 2 — Eliminiši iz ostatka kolone",
                  description: `Zbog poravnanja unutar kutije, ${val} ne može biti ni u jednoj drugoj ćeliji kolone ${targetCol+1} van te kutije. Crvene ćelije mogu imati ${val} uklonjen iz svojih kandidata.`,
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
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Red ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Kolona ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Kutija ${box+1}` });
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
              title: `Gola Trojka (Naked Triple) — ${label}`,
              targetCell: a,
              targetNum: solvedBoard.value[a.r]![a.c]!,
              steps: [
                {
                  label: "Korak 1 — Pronađi Golu Trojku",
                  description: `Ćelije [R${a.r+1}K${a.c+1}], [R${b.r+1}K${b.c+1}] i [R${c2.r+1}K${c2.c+1}] zajedno sadrže tačno tri različita kandidata: ${v1}, ${v2}, ${v3}. Svaka ćelija ima samo podskup od ta tri broja (2 ili 3). Zajedno, ova trojka "zaključava" te brojeve — nijedan od tri broja ne može otići negdje drugdje u ${label}.`,
                  highlightCoords: [
                    { r: a.r, c: a.c, type: 'trigger' },
                    { r: b.r, c: b.c, type: 'trigger' },
                    { r: c2.r, c: c2.c, type: 'trigger' }
                  ]
                },
                {
                  label: "Korak 2 — Eliminiši trojku iz ostatka jedinice",
                  description: `Pošto ${v1}, ${v2} i ${v3} moraju ući u te tri ćelije, mogu se ukloniti iz svih ostalih ćelija u ${label} (crveno). Ovo drastično sužava mogućnosti.`,
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
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Red ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Kolona ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Kutija ${box+1}` });
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
                title: `Gola Četvorka (Naked Quad) — ${label}`,
                targetCell: a,
                targetNum: solvedBoard.value[a.r]![a.c]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi Golu Četvorku",
                    description: `Četiri ćelije u ${label} zajedno sadrže tačno četiri kandidata: ${v1}, ${v2}, ${v3}, ${v4}. Svaka ćelija ima samo podskup od ta četiri broja. Ova četvorka ih "zaključava" — nijedan od četiri broja ne može ići u drugu ćeliju iste jedinice.`,
                    highlightCoords: [a,b,c2,d].map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                  },
                  {
                    label: "Korak 2 — Eliminiši četvorku iz ostatka jedinice",
                    description: `Kandidati ${v1}, ${v2}, ${v3} i ${v4} mogu se ukloniti iz svih ostalih ćelija u ${label} (crveno), jer su ekskluzivno rezervisani za te četiri ćelije.`,
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
                  title: "XY-Wing (Napredna Tehnika)",
                  targetCell: { r: target.r, c: target.c },
                  targetNum: solvedBoard.value[target.r]![target.c]!,
                  steps: [
                    {
                      label: "Korak 1 — Pronađi XY-Wing strukturu",
                      description: `Pivot ćelija [R${pr+1}K${pc+1}] ima kandidate [${x},${y}]. Pincer 1 [R${r1+1}K${c1+1}] ima [${x},${z}] i vidi pivot. Pincer 2 [R${r2+1}K${c2+1}] ima [${y},${z}] i vidi pivot. Bez obzira na to koji kandidat pivot odabere, jedan od pincera mora sadržavati ${z}.`,
                      highlightCoords: [
                        { r: pr, c: pc, type: 'trigger' },
                        { r: r1, c: c1, type: 'trigger' },
                        { r: r2, c: c2, type: 'trigger' }
                      ]
                    },
                    {
                      label: "Korak 2 — Eliminiši zajednički kandidat",
                      description: `Svaka ćelija koja vidi oba pincera (crveno) ne može sadržavati ${z} — jer će jedan od pincera uvijek imati ${z}. Eliminacija je garantovana bez obzira na rješenje pivota.`,
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
                  title: "XYZ-Wing (Napredna Tehnika)",
                  targetCell: { r: target.r, c: target.c },
                  targetNum: solvedBoard.value[target.r]![target.c]!,
                  steps: [
                    {
                      label: "Korak 1 — Pronađi XYZ-Wing strukturu",
                      description: `Pivot [R${pr+1}K${pc+1}] ima tri kandidata [${x},${y},${z}]. Oba pincera [R${r1+1}K${c1+1}] i [R${r2+1}K${c2+1}] vide pivot i sadrže ${z} plus jedan od ${x} ili ${y}. Za razliku od XY-Wing, pivot ovdje i sam sadrži ${z}, pa eliminacija vrijedi samo za ćelije koje vide SVA tri člana.`,
                      highlightCoords: [
                        { r: pr, c: pc, type: 'trigger' },
                        { r: r1, c: c1, type: 'trigger' },
                        { r: r2, c: c2, type: 'trigger' }
                      ]
                    },
                    {
                      label: "Korak 2 — Eliminiši z iz ćelija koje vide sve tri",
                      description: `Ćelije koje vide pivot i oba pincera (crveno) sigurno ne mogu sadržavati ${z} — jer ga u svim scenarijima zauzimaju neka od tri ćelije. Ovo je restriktivnija, ali moćnija verzija XY-Wing.`,
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
                  title: `XY-Chain (Lanac dužine ${chain.length})`,
                  targetCell: { r: target.r, c: target.c },
                  targetNum: solvedBoard.value[target.r]![target.c]!,
                  steps: [
                    {
                      label: "Korak 1 — Pronađi XY-Chain",
                      description: `Lanac bivalentnih ćelija: ${chainDesc}. Svake dvije susjedne ćelije dijele jedan kandidat i "vide" jedna drugu. Bez obzira na smjer rješavanja lanca, broj ${exitDigit} mora biti na jednom od dva kraja lanca (plavo).`,
                      highlightCoords: chain.map(ch => ({ r: ch.r, c: ch.c, type: 'trigger' as const }))
                    },
                    {
                      label: "Korak 2 — Eliminiši zajednički kandidat",
                      description: `Ćelije koje vide oba kraja lanca (crveno) nikad ne mogu imati ${exitDigit} — jedan kraj lanca uvijek sadrži ${exitDigit}. Ova eliminacija može otvoriti put do rješenja.`,
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
          label: "Korak 1 — Detektuj BUG+1 stanje",
          description: `Gotovo svaka prazna ćelija ima tačno dva kandidata — to je "Bivalue Universal Grave" (BUG) stanje. Jedina iznimka je ćelija [R${r+1}K${c+1}] koja ima tri kandidata: [${triCands.join(',')}]. Ako ne unesemo pravi broj ovdje, sudoku bi pao u deadlock s više rješenja.`,
          highlightCoords: [{ r, c, type: 'trigger' }]
        },
        {
          label: "Korak 2 — Upiši BUG digit",
          description: `Jedini kandidat koji narušava simetričnost BUG-a je ${bugDigit} — pojavljuje se neparno puta u svom redu, koloni ili kutiji. Upisivanjem ${bugDigit} se razrješava BUG i garantuje jedinstvenost rješenja.`,
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
                  title: "Prazni Pravougaonik (Empty Rectangle)",
                  targetCell: { r: otherRow, c: erBoxCol },
                  targetNum: solvedBoard.value[otherRow]![erBoxCol]!,
                  steps: [
                    {
                      label: "Korak 1 — Uoči Prazni Pravougaonik u kutiji",
                      description: `U kutiji ${box+1}, svi kandidati za ${val} nalaze se u redu ${erRow+1} (plavo). Ovo stvara "prazni pravougaonik" — ostatak kutije nema ${val}. Kolona ${c+1} ima jaku vezu za ${val}: jedino u redovima ${rA+1} i ${rB+1}.`,
                      highlightCoords: boxCells.map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                    },
                    {
                      label: "Korak 2 — Eliminiši kombinacijom veza",
                      description: `Jaka veza u koloni ${c+1} i poravnanje unutar kutije zajedno garantuju da ${val} mora biti u redu ${erRow+1} ili u koloni kutije koja sadrži ER. Ćelija [R${otherRow+1}K${erBoxCol+1}] vidi obje — stoga ${val} se eliminira iz nje.`,
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
              title: "W-Wing (Napredna Tehnika)",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Korak 1 — Pronađi W-Wing strukturu",
                  description: `Dvije ćelije [R${r1+1}K${c1+1}] i [R${r2+1}K${c2+1}] imaju iste kandidate [${p},${q}] i ne vide jedna drugu. Spojene su "jakom vezom" na broj ${p} — postoji jedinica gdje ${p} može ići samo u dvije ćelije, jedna vidi prvu bivalentnu, druga drugu. Ovo garantuje da bar jedna od bivalentnih ćelija sadrži ${q}.`,
                  highlightCoords: [
                    { r: r1, c: c1, type: 'trigger' },
                    { r: r2, c: c2, type: 'trigger' }
                  ]
                },
                {
                  label: "Korak 2 — Eliminiši q iz ćelija koje vide obje",
                  description: `Svaka ćelija koja vidi i [R${r1+1}K${c1+1}] i [R${r2+1}K${c2+1}] (crveno) ne može sadržavati ${q} — jer jedna od bivalentnih ćelija uvijek sadrži ${q}, bez izuzetka.`,
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
                title: "Meduza (Jellyfish)",
                targetCell: { r: target.r, c: target.c },
                targetNum: solvedBoard.value[target.r]![target.c]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi Jellyfish matricu",
                    description: `Broj ${val} pojavljuje se u 2–4 mjesta u svakom od četiri reda (${allRows.map(rd => rd.r+1).join(', ')}), a svi kandidati padaju unutar tačno 4 kolone. Ovo je četverodimenzionalni X-Wing (ili dvodimenzionalni Swordfish): ${val} je "zaključan" unutar te 4×4 mreže (plavo).`,
                    highlightCoords: triggerCoords
                  },
                  {
                    label: "Korak 2 — Eliminiši iz tih kolona",
                    description: `Bez obzira na raspored unutar matrice, ${val} pokriva sve četiri kolone u ta četiri reda. Stoga ${val} ne može biti ni u kojoj drugoj ćeliji tih kolona (crveno).`,
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
    // Type 1: three corners have exactly {a,b}, fourth has {a,b,...} — eliminate a,b from fourth
    for (let r1 = 0; r1 < 8; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (Math.floor(r1 / 3) === Math.floor(r2 / 3)) continue; // must be different box-rows
        for (let c1 = 0; c1 < 8; c1++) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue; // must be different box-cols
            const corners = [
              { r: r1, c: c1 }, { r: r1, c: c2 },
              { r: r2, c: c1 }, { r: r2, c: c2 }
            ] as [CellCoord, CellCoord, CellCoord, CellCoord];

            if (corners.some(({ r, c }) => currentBoard.value[r]![c] !== 0)) continue;
            const cands = corners.map(({ r, c }) => candidates[r]![c]!);

            // find corners with exactly 2 candidates all equal to same pair
            const pairCorners = corners.filter((_, i) => cands[i]!.length === 2);
            if (pairCorners.length !== 3) continue;

            const ref = cands[corners.indexOf(pairCorners[0]!)]!;
            if (ref.length !== 2) continue;
            const [a, b] = ref as [number, number];
            if (!pairCorners.every(({ r, c }) => {
              const cd = candidates[r]![c]!;
              return cd.length === 2 && cd.includes(a) && cd.includes(b);
            })) continue;

            // find the "floor" corner (the one NOT in pairCorners)
            const floorCorner = corners.find(({ r, c }) => !pairCorners.some(p => p.r === r && p.c === c))!;
            const floorCands = candidates[floorCorner.r]![floorCorner.c]!;
            if (!floorCands.includes(a) || !floorCands.includes(b)) continue;

            const eliminations: HintCoordinate[] = [
              { r: floorCorner.r, c: floorCorner.c, type: 'elimination' }
            ];

            return {
              title: "Jedinstveni Pravougaonik — Tip 1 (Unique Rectangle)",
              targetCell: floorCorner,
              targetNum: solvedBoard.value[floorCorner.r]![floorCorner.c]!,
              steps: [
                {
                  label: "Korak 1 — Pronađi Jedinstveni Pravougaonik",
                  description: `Četiri ćelije formiraju pravougaonik koji presijecaju dva reda i dvije kolone, svaka u drugoj 3×3 kutiji. Tri od četiri ćelije imaju tačno iste kandidate [${a},${b}]. Ako bi i četvrta ćelija imala samo ${a} i ${b}, sudoku bi imao više rješenja — što je nemoguće u ispravnom sudokuu.`,
                  highlightCoords: pairCorners.map(({ r, c }) => ({ r, c, type: 'trigger' as const }))
                },
                {
                  label: "Korak 2 — Eliminiši par iz četvrte ćelije",
                  description: `Ćelija [R${floorCorner.r+1}K${floorCorner.c+1}] mora sadržavati nešto osim ${a} i ${b} kako bi se garantovalo jedinstvenost rješenja. Stoga ${a} i ${b} se eliminišu iz nje — ostatak kandidata daje pravo rješenje.`,
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
            title: "Zmaj s Dva Kraka (Two-String Kite)",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Korak 1 — Pronađi Two-String Kite",
                description: `Broj ${val} ima tačno dva kandidata u redu ${r+1} i tačno dva kandidata u koloni ${c+1}. Oba "kraka zmaja" dijele ćeliju [R${r+1}K${c+1}] unutar iste 3×3 kutije. Bez obzira na to da li je ${val} u [R${r+1}K${rowEnd+1}] ili [R${colEnd+1}K${c+1}] — jedan kraj uvijek sadrži ${val}.`,
                highlightCoords: [
                  { r, c: rCols[0]!, type: 'trigger' },
                  { r, c: rCols[1]!, type: 'trigger' },
                  { r: cRows[0]!, c, type: 'trigger' },
                  { r: cRows[1]!, c, type: 'trigger' }
                ]
              },
              {
                label: "Korak 2 — Eliminiši iz ćelija koje vide oba kraja",
                description: `Ćelije koje vide i [R${r+1}K${rowEnd+1}] i [R${colEnd+1}K${c+1}] (crveno) sigurno ne mogu imati ${val} — jedan od ta dva kraja ga uvijek zauzima. Ovo je ekvivalent Skyscrapera, ali orijentisan kao zmaj umjesto kao neboder.`,
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
            title: "Neboder (Skyscraper)",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Korak 1 — Pronađi Skyscraper strukturu",
                description: `Broj ${val} pojavljuje se tačno dva puta u redu ${ra.r+1} (kolone ${ra.cols[0]+1} i ${ra.cols[1]+1}) i dva puta u redu ${rb.r+1} (kolone ${rb.cols[0]+1} i ${rb.cols[1]+1}). Dijele jednu kolonu (${sharedCol+1}) ali u različitim kutijama — kao neboder koji se naslanja na isti stub. Vrhovi (plavo: K${topA+1} i K${topB+1}) moraju sadržavati ${val} u bar jednom od ta dva reda.`,
                highlightCoords: [
                  { r: ra.r, c: ra.cols[0]!, type: 'trigger' },
                  { r: ra.r, c: ra.cols[1]!, type: 'trigger' },
                  { r: rb.r, c: rb.cols[0]!, type: 'trigger' },
                  { r: rb.r, c: rb.cols[1]!, type: 'trigger' }
                ]
              },
              {
                label: "Korak 2 — Eliminiši iz ćelija koje vide oba vrha",
                description: `Ako ${val} nije u vrhu K${topA+1} reda ${ra.r+1}, mora biti u K${topA+1}... i obratno za drugi red. Svaka ćelija koja vidi oba vrha (crveno) sigurno ne može imati ${val} — jedan od vrhova ga uvijek sadrži.`,
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
              title: "Swordfish (Napredna Tehnika)",
              targetCell: { r: target.r, c: target.c },
              targetNum: solvedBoard.value[target.r]![target.c]!,
              steps: [
                {
                  label: "Korak 1 — Pronađi Swordfish matricu",
                  description: `Broj ${val} javlja se u 2–3 mjesta u svakom od redova ${ri.r+1}, ${rj.r+1} i ${rk.r+1}, a svi ti kandidati padaju unutar tačno 3 kolone. Kao trodimenzionalni X-Wing: ${val} mora biti u jednoj od ćelija te 3×3 mreže (plavo).`,
                  highlightCoords: triggerCoords
                },
                {
                  label: "Korak 2 — Eliminiši iz tih kolona",
                  description: `Bez obzira na raspored unutar matrice, ${val} pokriva sve tri kolone u ta tri reda. Stoga ${val} ne može biti ni u kojoj drugoj ćeliji tih kolona (crveno) — eliminacija vrijedi za cijele kolone.`,
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
            title: "Redukcija Red→Kutija (Box-Line Reduction)",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Korak 1 — Broj zaključan u jedan red unutar kutije",
                description: `U redu ${r+1}, broj ${val} pojavljuje se samo u ćelijama koje su sve unutar iste 3×3 kutije (plavo). To znači da ${val} mora ići u jednu od tih ćelija — ekskluzivno za taj red unutar kutije.`,
                highlightCoords: cols.map(c => ({ r, c, type: 'trigger' as const }))
              },
              {
                label: "Korak 2 — Eliminiši iz ostatka kutije",
                description: `Pošto ${val} mora biti u redu ${r+1} unutar te kutije, ne može biti ni u kojoj drugoj ćeliji te iste kutije (crveno). Ova eliminacija se zove Box-Line Reduction — suprotna od Pointing Pair.`,
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
            title: "Redukcija Kolona→Kutija (Box-Line Reduction)",
            targetCell: { r: target.r, c: target.c },
            targetNum: solvedBoard.value[target.r]![target.c]!,
            steps: [
              {
                label: "Korak 1 — Broj zaključan u jednu kolonu unutar kutije",
                description: `U koloni ${c+1}, broj ${val} pojavljuje se samo u ćelijama koje su sve unutar iste 3×3 kutije (plavo). ${val} mora ući u jednu od tih ćelija — ekskluzivno za tu kolonu unutar kutije.`,
                highlightCoords: rows.map(r => ({ r, c, type: 'trigger' as const }))
              },
              {
                label: "Korak 2 — Eliminiši iz ostatka kutije",
                description: `Pošto ${val} mora biti u koloni ${c+1} unutar te kutije, ne može biti u nijednoj drugoj ćeliji te kutije (crveno). Box-Line Reduction je komplement Pointing Pair tehnike.`,
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
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Red ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Kolona ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Kutija ${box+1}` });
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
                title: `Skrivena Četvorka (Hidden Quad) — ${label}`,
                targetCell: a,
                targetNum: solvedBoard.value[a.r]![a.c]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi Skrivenu Četvorku",
                    description: `Brojevi ${quad.join(', ')} mogu ići samo u četiri ćelije unutar ${label}. Ove ćelije imaju i druge kandidate, ali ${quad.join(', ')} su ekskluzivni za ovu četvorku — nigdje drugdje u jedinici ne mogu stati.`,
                    highlightCoords: [a,b,c2,d].map(x => ({ r: x.r, c: x.c, type: 'trigger' as const }))
                  },
                  {
                    label: "Korak 2 — Eliminiši ostale kandidate iz četvorke",
                    description: `Pošto ${quad.join(', ')} moraju popuniti upravo te četiri ćelije, svi ostali kandidati unutar njih su nemogući i brišu se (crveno). Ovo pretvara skrivenu četvorku u golu četvorku (Naked Quad).`,
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
    for (let r = 0; r < 9; r++) units.push({ cells: Array.from({ length: 9 }, (_, c) => ({ r, c })), label: `Red ${r+1}` });
    for (let c = 0; c < 9; c++) units.push({ cells: Array.from({ length: 9 }, (_, r) => ({ r, c })), label: `Kolona ${c+1}` });
    for (let box = 0; box < 9; box++) {
      const sr = Math.floor(box / 3) * 3, sc = (box % 3) * 3;
      const cells: CellCoord[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ r: sr + i, c: sc + j });
      units.push({ cells, label: `Kutija ${box+1}` });
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
              title: `Skrivena Trojka (Hidden Triple) — ${label}`,
              targetCell: a,
              targetNum: solvedBoard.value[a.r]![a.c]!,
              steps: [
                {
                  label: "Korak 1 — Pronađi Skrivenu Trojku",
                  description: `Brojevi ${vi}, ${vj} i ${vk} mogu ići samo u ćelije [R${a.r+1}K${a.c+1}], [R${b.r+1}K${b.c+1}] i [R${c2.r+1}K${c2.c+1}] unutar ${label}. Ova trojka je "skrivena" — ćelije imaju i druge kandidate, ali ${vi}, ${vj}, ${vk} su ekskluzivni za ove tri ćelije.`,
                  highlightCoords: [
                    { r: a.r, c: a.c, type: 'trigger' },
                    { r: b.r, c: b.c, type: 'trigger' },
                    { r: c2.r, c: c2.c, type: 'trigger' }
                  ]
                },
                {
                  label: "Korak 2 — Eliminiši ostale kandidate iz trojke",
                  description: `Pošto ${vi}, ${vj} i ${vk} moraju popuniti upravo te tri ćelije, svi drugi kandidati u njima su nemogući (crveno). Eliminacijom se otkrivaju novi goli singletoni ili parovi.`,
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
            title: "Skriveni Par (Hidden Pair)",
            targetCell: a,
            targetNum: solvedBoard.value[a.r]![a.c]!,
            steps: [
              {
                label: "Korak 1 — Pronađi Skriveni Par",
                description: `Brojevi ${vi} i ${vj} mogu ići samo u ćelije [Red ${a.r+1}, Kol ${a.c+1}] i [Red ${b.r+1}, Kol ${b.c+1}] unutar ove jedinice. Čak i ako te ćelije imaju više kandidata, ${vi} i ${vj} su "skriveni" unutar njih — ne mogu ići nigdje drugdje u jedinici.`,
                highlightCoords: [
                  { r: a.r, c: a.c, type: 'trigger' },
                  { r: b.r, c: b.c, type: 'trigger' }
                ]
              },
              {
                label: "Korak 2 — Eliminiši ostale kandidate iz para",
                description: `Pošto ${vi} i ${vj} moraju zauzeti upravo te dvije ćelije, svi ostali kandidati u njima su nemogući i mogu se eliminisati (crveno). Ovo efektivno pretvara skriveni par u goli par (Naked Pair).`,
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
                title: "X-Wing (Napredna Tehnika)",
                targetCell: { r: r1.r, c: c1 },
                targetNum: solvedBoard.value[r1.r]![c1]!,
                steps: [
                  {
                    label: "Korak 1 — Pronađi pravougaonik kandidata",
                    description: `Broj ${val} javlja se tačno na dva mjesta u redu ${r1.r+1} (kolone ${c1+1} i ${c2+1}) i tačno na dva mjesta u redu ${r2.r+1} (iste kolone). Ova četiri polja formiraju pravougaonik — osnovu X-Wing tehnike. ${val} mora biti na jednoj od dviju dijagonala tog pravougaonika.`,
                    highlightCoords: [
                      { r: r1.r, c: c1, type: 'trigger' },
                      { r: r1.r, c: c2, type: 'trigger' },
                      { r: r2.r, c: c1, type: 'trigger' },
                      { r: r2.r, c: c2, type: 'trigger' }
                    ]
                  },
                  {
                    label: "Korak 2 — Eliminiši iz kolona pravougaonika",
                    description: `Bez obzira na to koja dijagonala je ispravna, ${val} mora biti u kolonama ${c1+1} i ${c2+1} unutar ta dva reda. Stoga ${val} ne može biti nigdje drugdje u tim kolonama. Crvene ćelije mogu imati ${val} uklonjen kao kandidata.`,
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
    if (!hint) hint = findNakedTriples(candidates);
    if (!hint) hint = findNakedQuads(candidates);
    if (!hint) hint = findHiddenQuads(candidates);
    if (!hint) hint = findHiddenTriples(candidates);
    if (!hint) hint = findHiddenPairs(candidates);
    if (!hint) hint = findBoxLineReduction(candidates);
    if (!hint) hint = findPointingPair(candidates);
    if (!hint) hint = findXWing(candidates);
    if (!hint) hint = findSwordfish(candidates);
    if (!hint) hint = findJellyfish(candidates);
    if (!hint) hint = findXYWing(candidates);
    if (!hint) hint = findXYZWing(candidates);
    if (!hint) hint = findSkyscraper(candidates);
    if (!hint) hint = findTwoStringKite(candidates);
    if (!hint) hint = findUniqueRectangle(candidates);
    if (!hint) hint = findXYChain(candidates);
    if (!hint) hint = findBUG(candidates);
    if (!hint) hint = findEmptyRectangle(candidates);
    if (!hint) hint = findWWing(candidates);

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
          title: "Redukcija Kandidata (Analiza)",
          targetCell: { r, c },
          targetNum,
          steps: [
            {
              label: "Korak 1 — Ćelija s najmanje kandidata",
              description: `Ćelija [Red ${r+1}, Kol ${c+1}] ima najmanji broj preostalih mogućnosti. Plave ćelije u njenom redu i koloni blokiraju pogrešne kandidate, ostavljajući samo ${targetNum} kao jedinu matematički validnu opciju. Pokušaj primijeniti prethodne tehnike za bolje razumijevanje.`,
              highlightCoords: blockingCells
            },
            {
              label: "Korak 2 — Potvrdi rješenje",
              description: `Nakon eliminacije pogrešnih opcija, ${targetNum} je jedina vrijednost koja ne krši nijedno pravilo sudokua za ovu ćeliju. Klikni "Upiši Broj" za potvrdu.`,
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
      hintStatus.value = "Nema slobodnih polja!";
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
