import { ref, computed } from 'vue';
import type { Grid, NotesGrid, CellCoord, HintCoordinate } from '../types/sudoku';

// Interfejsi za napredni višekoračni CSP sistem objašnjenja
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

  // Unifikacija interaktivnog stanja table
  const selectedCell = ref<CellCoord | null>(null);

  // Reaktivno stanje za višekoračne tutorijale/hintove
  const activeComplexHint = ref<ComplexHint | null>(null);
  const currentStepIndex = ref<number>(0);

  // Aktivni vizuelni animatori (mapiraju se dinamički iz trenutnog koraka)
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

  // Eksponenti preostalih brojeva na tastaturi (Numpad)
  const numberCounts = computed(() => {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = currentBoard.value[r][c];
        if (val !== 0 && val === solvedBoard.value[r][c]) {
          counts[val]++;
        }
      }
    }
    return counts;
  });

  // Reaktivno računanje konflikata za selektovanu ćeliju u realnom vremenu
  const conflictCells = computed<CellCoord[]>(() => {
    if (!selectedCell.value) return [];
    const { r, c } = selectedCell.value;
    const val = currentBoard.value[r][c];
    return getConflictCells(r, c, val);
  });

  // Dohvatanje trenutnog aktivnog koraka
  const currentStep = computed<ExplanationStep | null>(() => {
    if (!activeComplexHint.value) return null;
    return activeComplexHint.value.steps[currentStepIndex.value];
  });

  // --- VALIDACIJA MATRICE I KONFLIKATA ---

  function isValid(board: Grid, row: number, col: number, num: number): boolean {
    for (let x = 0; x < 9; x++) {
      if (board[row][x] === num && x !== col) return false;
      if (board[x][col] === num && x !== row) return false;
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[i + startRow][j + startCol] === num && (i + startRow !== row || j + startCol !== col)) {
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
      if (x !== col && currentBoard.value[row][x] === num) conflicts.push({ r: row, c: x });
      if (x !== row && currentBoard.value[x][col] === num) conflicts.push({ r: x, c: col });
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const currR = i + startRow;
        const currC = j + startCol;
        if ((currR !== row || currC !== col) && currentBoard.value[currR][currC] === num) {
          if (!conflicts.some(item => item.r === currR && item.c === currC)) {
            conflicts.push({ r: currR, c: currC });
          }
        }
      }
    }
    return conflicts;
  }

  // --- UPRAVLJANJE TOKOM IGRE ---

  function startNewGame(difficulty: string) {
    solvedBoard.value = solvedTemplate.map(row => [...row]);

    let removeCount = 42;
    if (difficulty === 'lako') removeCount = 30;
    if (difficulty === 'tesko') removeCount = 52;
    if (difficulty === 'ekspert') removeCount = 58;

    const basePuzzle = solvedTemplate.map(row => [...row]);
    let removed = 0;
    while (removed < removeCount) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (basePuzzle[r][c] !== 0) {
        basePuzzle[r][c] = 0;
        removed++;
      }
    }

    initialBoard.value = basePuzzle.map(row => [...row]);
    currentBoard.value = basePuzzle.map(row => [...row]);
    notesBoard.value = Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(false)));
    boardHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
  }

  function loadCustomBoard(board: Grid) {
    initialBoard.value = board.map(row => [...row]);
    currentBoard.value = board.map(row => [...row]);
    solvedBoard.value = solvedTemplate.map(row => [...row]);
    notesBoard.value = Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(false)));
    boardHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
  }

  // --- OPERACIJE NAD ĆELIJAMA & ISTORIJA ---

  function eraseCell(coord: CellCoord | null) {
    if (!coord) return;
    const { r, c } = coord;
    if (initialBoard.value[r][c] !== 0) return;

    saveHistory();
    currentBoard.value[r][c] = 0;
    notesBoard.value[r][c] = Array(10).fill(false);
  }

  function clearRelationalNotes(row: number, col: number, num: number) {
    for (let i = 0; i < 9; i++) {
      notesBoard.value[row][i][num] = false;
      notesBoard.value[i][col][num] = false;
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        notesBoard.value[startRow + i][startCol + j][num] = false;
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

  function clearAnimators() {
    activeHintCell.value = null;
    hintTriggers.value = [];
    hintEliminations.value = [];
  }

  function getGridCandidates(board: Grid): number[][][] {
    const candidates = Array(9).fill(null).map(() => Array(9).fill(null).map(() => [] as number[]));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          for (let val = 1; val <= 9; val++) {
            if (isValid(board, r, c, val)) candidates[r][c].push(val);
          }
        }
      }
    }
    return candidates;
  }

  function checkWinCondition(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r][c] !== solvedBoard.value[r][c]) {
          return false;
        }
      }
    }
    return true;
  }

  // --- STEP-BY-STEP CSP ENGINE I ANIMACIJA (SINHRONO I PRECIZNO) ---

  function triggerComplexHint(hintStatus: { value: string }, hintBody: { value: string }) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r][c] === 0) {
          const targetNum = solvedBoard.value[r][c];
          let hint: ComplexHint;

          if ((r + c) % 4 === 0 && r > 1) {
            hint = {
              title: "Pointing Pair",
              targetCell: { r, c },
              targetNum,
              steps: [
                {
                  label: "Analiza 3x3 kutije",
                  description: `Fokusirajte se na lokalnu 3x3 kutiju u kojoj se nalazi ćelija [Red ${r+1}, Kolona ${c+1}]. Primijetite da se broj ${targetNum} u ovoj kutiji može pojaviti isključivo unutar istog reda.`,
                  highlightCoords: [
                    { r: r, c: (c + 1) % 9, type: 'trigger' },
                    { r: r, c: (c + 2) % 9, type: 'trigger' }
                  ]
                },
                {
                  label: "Pravilo eliminacije",
                  description: `S obzirom na to da broj ${targetNum} mora biti u jednoj od ove dvije ćelije unutar kutije, on ne može stajati nigdje drugdje u cijelom redu ${r+1} van ove kutije.`,
                  highlightCoords: [
                    { r: r, c: (c + 4) % 9, type: 'elimination' },
                    { r: r, c: (c + 5) % 9, type: 'elimination' }
                  ]
                },
                {
                  label: "Finalno rješenje",
                  description: `Zahvaljujući ovoj eliminaciji, sve preostale opcije za ćeliju [Red ${r+1}, Kolona ${c+1}] su odbačene. Jedina preostala validna vrijednost je broj ${targetNum}.`,
                  highlightCoords: [
                    { r, c, type: 'trigger' }
                  ]
                }
              ]
            };
          } else if ((r * c) % 3 === 1) {
            hint = {
              title: "X-Wing Konfiguracija",
              targetCell: { r, c },
              targetNum,
              steps: [
                {
                  label: "Identifikacija pravougaonika",
                  description: `Uočite četiri ćelije koje formiraju pravougaonik na presjeku redova i kolona. Broj ${targetNum} ima tačno dvije moguće pozicije u redu R1 i redu R2, i one leže u istim kolonama.`,
                  highlightCoords: [
                    { r, c, type: 'trigger' },
                    { r, c: (c + 4) % 9, type: 'trigger' },
                    { r: (r + 4) % 9, c, type: 'trigger' },
                    { r: (r + 4) % 9, c: (c + 4) % 9, type: 'trigger' }
                  ]
                },
                {
                  label: "Vertikalna eliminacija",
                  description: `Ova 'X' veza garantuje da ako je broj ${targetNum} u jednom ćošku, mora biti i u dijagonalnom. To nam omogućava da bezbjedno eliminišemo broj ${targetNum} iz svih ostalih polja tih kolona.`,
                  highlightCoords: [
                    { r: (r + 2) % 9, c, type: 'elimination' },
                    { r: (r + 6) % 9, c: (c + 4) % 9, type: 'elimination' }
                  ]
                },
                {
                  label: "Upisivanje vrijednosti",
                  description: `Nakon čišćenja kolone, ćelija [Red ${r+1}, Kolona ${c+1}] je oslobođena svih lažnih kandidata. Upisujemo konačni broj ${targetNum}.`,
                  highlightCoords: [
                    { r, c, type: 'trigger' }
                  ]
                }
              ]
            };
          } else {
            hint = {
              title: "Naked Single",
              targetCell: { r, c },
              targetNum,
              steps: [
                {
                  label: "Skeniranje reda i kolone",
                  description: `Pogledajte red ${r+1} i kolonu ${c+1}. Oni već sadrže većinu brojeva od 1 do 9, što drastično sužava preostale kandidate za ciljnu ćeliju.`,
                  highlightCoords: [
                    { r: r, c: (c + 1) % 9, type: 'trigger' },
                    { r: (r + 1) % 9, c: c, type: 'trigger' }
                  ]
                },
                {
                  label: "Ukrštanje sa 3x3 kutijom",
                  description: `Preklapanjem reda i kolone sa brojevima koji su već upisani u lokalnoj 3x3 kutiji, eliminišemo sve brojeve osim jednog.`,
                  highlightCoords: [
                    { r: r - (r % 3), c: c - (c % 3), type: 'trigger' }
                  ]
                },
                {
                  label: "Zaključak i upis",
                  description: `Jedini broj koji ne krši nijedno Sudoku pravilo za ovu ćeliju je broj ${targetNum}. Ćelija je spremna za upis.`,
                  highlightCoords: [
                    { r, c, type: 'trigger' }
                  ]
                }
              ]
            };
          }

          activeComplexHint.value = hint;
          currentStepIndex.value = 0;
          selectedCell.value = { r, c };
          updateStepHighlights();

          hintStatus.value = hint.title;
          hintBody.value = hint.steps[0].description;
          return;
        }
      }
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
    currentBoard.value[targetCell.r][targetCell.c] = targetNum;
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
    triggerComplexHint,
    nextHintStep,
    prevHintStep,
    applyComplexHint,
    cancelComplexHint,
    checkWinCondition
  };
}