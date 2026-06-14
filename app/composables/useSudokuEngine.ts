import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

import type { Grid, NotesGrid, CellCoord, HintCoordinate } from "../types/sudoku";

import {
  solveBoard,
  cloneGrid,
  isValidPlacement,
  getGridCandidates,
  getConflictCells as findConflictCells,
} from "../utils/sudokuCore";
import {
  generateGradedPuzzle,
  nextHint,
  type SolveMove,
  type DigitAt,
} from "../utils/sudokuGrader";

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
  const { t } = useI18n();

  const currentBoard = ref<Grid>(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill(0)),
  );
  const initialBoard = ref<Grid>(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill(0)),
  );
  const solvedBoard = ref<Grid>(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill(0)),
  );
  const notesBoard = ref<NotesGrid>(
    Array(9)
      .fill(null)
      .map(() =>
        Array(9)
          .fill(null)
          .map(() => Array(10).fill(false)),
      ),
  );
  const boardHistory = ref<{ board: Grid; notes: NotesGrid }[]>([]);

  const selectedCell = ref<CellCoord | null>(null);

  const activeComplexHint = ref<ComplexHint | null>(null);
  const currentStepIndex = ref<number>(0);

  const activeHintCell = ref<CellCoord | null>(null);
  const hintTriggers = ref<CellCoord[]>([]);
  const hintEliminations = ref<CellCoord[]>([]);

  // The structured move backing the active hint, and the candidate eliminations
  // already shown to the player this hint-chain — replayed by nextHint so an
  // elimination unlocks the placement it leads to. Cleared on any board change
  // the player makes (new game, load, undo, erase, manual entry).
  const activeMove = ref<SolveMove | null>(null);
  const appliedEliminations = ref<DigitAt[]>([]);

  function resetHintChain() {
    appliedEliminations.value = [];
    activeMove.value = null;
  }

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

  // Validity, conflicts and candidates live in utils/sudokuCore (pure, unit-tested).
  const isValid = isValidPlacement;

  function getConflictCells(row: number, col: number, num: number): CellCoord[] {
    return findConflictCells(currentBoard.value, row, col, num);
  }

  // --- GAME MANAGEMENT ---
  function startNewGame(difficulty: string) {
    const { puzzle, solution } = generateGradedPuzzle(difficulty);

    initialBoard.value = puzzle.map((row) => [...row]);
    currentBoard.value = puzzle.map((row) => [...row]);
    solvedBoard.value = solution;

    notesBoard.value = Array(9)
      .fill(null)
      .map(() =>
        Array(9)
          .fill(null)
          .map(() => Array(10).fill(false)),
      );
    boardHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
    resetHintChain();
  }

  function loadCustomBoard(board: Grid) {
    initialBoard.value = board.map((row) => [...row]);
    currentBoard.value = board.map((row) => [...row]);

    const solved = solveBoard(board);
    solvedBoard.value = solved ?? cloneGrid(board);

    notesBoard.value = Array(9)
      .fill(null)
      .map(() =>
        Array(9)
          .fill(null)
          .map(() => Array(10).fill(false)),
      );
    boardHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
    resetHintChain();
  }

  function eraseCell(coord: CellCoord | null) {
    if (!coord) return;
    const { r, c } = coord;
    if (initialBoard.value[r]![c] !== 0) return;

    saveHistory();
    currentBoard.value[r]![c] = 0;
    notesBoard.value[r]![c] = Array(10).fill(false);
    cancelComplexHint();
    resetHintChain();
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
    const boardCopy = currentBoard.value.map((row) => [...row]);
    const notesCopy = notesBoard.value.map((row) => row.map((cell) => [...cell]));
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
    resetHintChain();
  }

  function checkWinCondition(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r]![c] !== solvedBoard.value[r]![c]) return false;
      }
    }
    return true;
  }

  // --- MAIN HINT DISPATCHER ---
  // Hints come from the grader's logical solver (sudokuGrader.nextHint), which
  // returns the next genuinely-justified move: a placement of a forced single,
  // or the removal of specific candidates. We never read the answer key, so a
  // hint can never place a digit its own explanation didn't justify.
  function buildHintFromMove(move: SolveMove): ComplexHint {
    const tech = move.technique;
    const digitsStr = move.digits.join(", ");
    const findDesc = t(`hint.move.${tech}.desc`, {
      num: move.digits[0] ?? 0,
      digits: digitsStr,
      count: move.eliminations.length,
    });
    const triggerCoords: HintCoordinate[] = move.triggers.map((c) => ({
      r: c.r,
      c: c.c,
      type: "trigger",
    }));

    let targetCell: CellCoord;
    let actionStep: ExplanationStep;
    if (move.placement) {
      targetCell = { r: move.placement.r, c: move.placement.c };
      actionStep = {
        label: t("hint.move.placeLabel"),
        description: t("hint.move.placeStep", {
          num: move.placement.num,
          row: move.placement.r + 1,
          col: move.placement.c + 1,
        }),
        highlightCoords: [{ r: targetCell.r, c: targetCell.c, type: "trigger" }],
      };
    } else {
      const focus = move.triggers[0] ?? move.eliminations[0]!;
      targetCell = { r: focus.r, c: focus.c };
      actionStep = {
        label: t("hint.move.eliminateLabel"),
        description: t("hint.move.eliminateStep", {
          digits: digitsStr,
          count: move.eliminations.length,
        }),
        highlightCoords: move.eliminations.map((e) => ({
          r: e.r,
          c: e.c,
          type: "elimination" as const,
        })),
      };
    }

    return {
      title: t(`hint.move.${tech}.name`),
      targetCell,
      targetNum: move.placement?.num ?? 0,
      steps: [
        { label: t("hint.move.findLabel"), description: findDesc, highlightCoords: triggerCoords },
        actionStep,
      ],
    };
  }

  function triggerComplexHint(hintStatus: { value: string }, hintBody: { value: string }) {
    const move = nextHint(currentBoard.value, appliedEliminations.value);
    if (!move) {
      activeMove.value = null;
      hintStatus.value = t("hint.move.none");
      return;
    }
    activeMove.value = move;
    const hint = buildHintFromMove(move);
    activeComplexHint.value = hint;
    currentStepIndex.value = 0;
    selectedCell.value = hint.targetCell;
    updateStepHighlights();

    hintStatus.value = hint.title;
    hintBody.value = hint.steps[0]!.description;
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
    const move = activeMove.value;
    if (!move) return;

    saveHistory();
    if (move.placement) {
      const { r, c, num } = move.placement;
      currentBoard.value[r]![c] = num;
      clearRelationalNotes(r, c, num);
    } else {
      // Elimination: reveal the affected cells' candidates with the eliminated
      // digit removed, so the deduction is visible. Detection persists the
      // removal via appliedEliminations (replayed by the next hint).
      const baseCands = getGridCandidates(currentBoard.value);
      const byCell = new Map<string, Set<number>>();
      for (const e of move.eliminations) {
        const key = `${e.r},${e.c}`;
        if (!byCell.has(key)) {
          const set = new Set<number>(baseCands[e.r]![e.c]!);
          for (const prev of appliedEliminations.value) {
            if (prev.r === e.r && prev.c === e.c) set.delete(prev.num);
          }
          byCell.set(key, set);
        }
        byCell.get(key)!.delete(e.num);
      }
      for (const [key, set] of byCell) {
        const [r, c] = key.split(",").map(Number) as [number, number];
        const notes = Array(10).fill(false);
        for (const n of set) notes[n] = true;
        notesBoard.value[r]![c] = notes;
      }
      appliedEliminations.value.push(...move.eliminations);
    }
    cancelComplexHint();
  }

  function cancelComplexHint() {
    activeComplexHint.value = null;
    activeMove.value = null;
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
    hintTriggers.value = step.highlightCoords.filter((c) => c.type === "trigger");
    hintEliminations.value = step.highlightCoords.filter((c) => c.type === "elimination");
  }

  function restoreGame(save: {
    currentBoard: Grid;
    initialBoard: Grid;
    solvedBoard: Grid;
    notesBoard: NotesGrid;
  }): void {
    currentBoard.value = save.currentBoard.map((row) => [...row]) as Grid;
    initialBoard.value = save.initialBoard.map((row) => [...row]) as Grid;
    solvedBoard.value = save.solvedBoard.map((row) => [...row]) as Grid;
    notesBoard.value = save.notesBoard.map((row) => row.map((cell) => [...cell])) as NotesGrid;
    selectedCell.value = null;
    activeComplexHint.value = null;
    currentStepIndex.value = 0;
    hintTriggers.value = [];
    hintEliminations.value = [];
    activeHintCell.value = null;
    boardHistory.value = [];
    resetHintChain();
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
    cancelComplexHint,
    resetHintChain,
    activeMove,
  };
}
