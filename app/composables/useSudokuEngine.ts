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
    if (!hint) hint = findPointingPair(candidates);
    if (!hint) hint = findXWing(candidates);

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
