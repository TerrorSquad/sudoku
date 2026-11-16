import { ref, computed, onScopeDispose, type Ref } from "vue";
import { useI18n } from "vue-i18n";

import type { Grid, NotesGrid, CellCoord, HintCoordinate } from "../types/sudoku";

import { emptyNotes } from "../utils/gridNav";
import { circled, patternMarks, strikes, withGhosts, type Mark } from "../utils/patternMarks";
import { digitLabel } from "../utils/sudokuColors";
import {
  solveBoard,
  cloneGrid,
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
  /** The cell a placement fills; null for a hint that only removes candidates. */
  targetCell: CellCoord | null;
  steps: ExplanationStep[];
  /** Points at a wrong entry instead of a technique; applying it clears targetCell. */
  wrongEntry?: boolean;
}

export function useSudokuEngine(
  colorMode: Ref<boolean> = ref(false),
  // "Highlight mistakes" off: remaining-digit counts must not reveal which entries are wrong.
  countWrongDigits: Ref<boolean> = ref(false),
) {
  const { t } = useI18n();

  const emptyGrid = (): Grid => Array.from({ length: 9 }, () => Array(9).fill(0));

  const currentBoard = ref<Grid>(emptyGrid());
  const initialBoard = ref<Grid>(emptyGrid());
  const solvedBoard = ref<Grid>(emptyGrid());
  const notesBoard = ref<NotesGrid>(emptyNotes());
  const boardHistory = ref<{ board: Grid; notes: NotesGrid }[]>([]);
  // Undone states, newest first to redo; cleared by any fresh edit or a new game.
  const redoHistory = ref<{ board: Grid; notes: NotesGrid }[]>([]);

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

  // The hint's pattern in pen on the board once a step shows it (what it removes or places only on
  // the step that says so). Applying a hint strikes the removed marks through, or circles the placed
  // digit, for a moment.
  const appliedMarks = ref<Mark[]>([]);
  let appliedTimer: ReturnType<typeof setTimeout> | undefined;
  const hintMarks = computed<Mark[]>(() => {
    const move = activeMove.value;
    const hint = activeComplexHint.value;
    // The last step is the one that says what to remove or place.
    const showsResult = !!hint && currentStepIndex.value === hint.steps.length - 1;
    if (!move || (!hintTriggers.value.length && !showsResult)) return appliedMarks.value;
    const cands = getGridCandidates(currentBoard.value);
    const has = (r: number, c: number, n: number) => {
      const notes = notesBoard.value[r]![c]!;
      return notes.some(Boolean) ? !!notes[n] : cands[r]![c]!.includes(n);
    };
    const showsNotes = (r: number, c: number) => notesBoard.value[r]![c]!.some(Boolean);
    return withGhosts(patternMarks(move, has, showsResult), showsNotes);
  });
  // A new or resumed board, and undo/redo, start clean.
  function clearApplied() {
    clearTimeout(appliedTimer);
    appliedMarks.value = [];
  }
  function showApplied(move: SolveMove | null) {
    if (!move) return;
    appliedMarks.value = move.placement ? [circled(move.placement)] : strikes(move.eliminations);
    clearTimeout(appliedTimer);
    appliedTimer = setTimeout(() => (appliedMarks.value = []), 1400);
  }
  // Silently: unit tests run the engine outside any component.
  onScopeDispose(() => clearTimeout(appliedTimer), true);

  // The next hint worth showing. A gap in the player's notes is never fed to the solver as a
  // deduction (it may be a guess, or just unfinished notes, and reading it could smuggle in the
  // answer). Instead, a removal the notes already show counts as done: such a move joins the
  // chain silently and the solver looks again, so a hint never asks to remove what's gone.
  function nextUsefulHint(): SolveMove | null {
    for (let i = 0; i < 300; i++) {
      const move = nextHint(currentBoard.value, appliedEliminations.value);
      if (!move || move.placement) return move;
      const todo = move.eliminations.filter(({ r, c, num }) => {
        const notes = notesBoard.value[r]![c]!;
        return !notes.some(Boolean) || notes[num];
      });
      if (todo.length) return { ...move, eliminations: todo };
      appliedEliminations.value.push(...move.eliminations);
    }
    return null;
  }

  // A wrong entry the player made (kept on the board when "Highlight mistakes" is off). The
  // solver takes every digit on the board as true, so it must come out before any hint is sound.
  function findWrongEntry(): CellCoord | null {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = currentBoard.value[r]![c]!;
        const sol = solvedBoard.value[r]![c]!;
        if (initialBoard.value[r]![c] === 0 && val !== 0 && sol !== 0 && val !== sol)
          return { r, c };
      }
    }
    return null;
  }

  function buildWrongEntryHint({ r, c }: CellCoord): ComplexHint {
    const params = {
      num: digitLabel(currentBoard.value[r]![c]!, colorMode.value, t),
      row: r + 1,
      col: c + 1,
    };
    return {
      title: t("hint.wrong.name"),
      targetCell: { r, c },
      wrongEntry: true,
      steps: [
        {
          label: t("hint.wrong.findLabel"),
          description: t("hint.wrong.desc", params),
          highlightCoords: [],
        },
        {
          label: t("hint.wrong.clearLabel"),
          description: t("hint.wrong.clearStep", params),
          highlightCoords: [],
        },
      ],
    };
  }

  function resetHintChain() {
    appliedEliminations.value = [];
    activeMove.value = null;
  }

  const numberCounts = computed(() => {
    const counts = Array(10).fill(0) as number[];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = currentBoard.value[r]![c]!;
        if (val !== 0 && (countWrongDigits.value || val === solvedBoard.value[r]![c]!))
          counts[val]!++;
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

  // Conflicts and candidates live in utils/sudokuCore (pure, unit-tested).
  function getConflictCells(row: number, col: number, num: number): CellCoord[] {
    return findConflictCells(currentBoard.value, row, col, num);
  }

  // --- GAME MANAGEMENT ---
  // What every fresh board (new, custom or restored) starts without.
  function resetGameState() {
    boardHistory.value = [];
    redoHistory.value = [];
    selectedCell.value = null;
    cancelComplexHint();
    resetHintChain();
    clearApplied();
  }

  /** `generated` comes from utils/puzzlePool in the app; tests let it generate in place. */
  function startNewGame(
    difficulty: string,
    generated: { puzzle: Grid; solution: Grid } = generateGradedPuzzle(difficulty),
  ) {
    const { puzzle, solution } = generated;

    initialBoard.value = puzzle.map((row) => row.concat());
    currentBoard.value = puzzle.map((row) => row.concat());
    solvedBoard.value = solution;

    notesBoard.value = emptyNotes();
    resetGameState();
  }

  function loadCustomBoard(board: Grid) {
    initialBoard.value = board.map((row) => [...row]);
    currentBoard.value = board.map((row) => [...row]);

    const solved = solveBoard(board);
    solvedBoard.value = solved ?? cloneGrid(board);

    notesBoard.value = emptyNotes();
    resetGameState();
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
    boardHistory.value.push(snapshot());
    if (boardHistory.value.length > 25) boardHistory.value.shift();
    redoHistory.value = [];
  }

  function snapshot() {
    return {
      board: currentBoard.value.map((row) => [...row]),
      notes: notesBoard.value.map((row) => row.map((cell) => [...cell])),
    };
  }

  function undoMove() {
    clearApplied();
    const prevState = boardHistory.value.pop();
    if (!prevState) return;
    redoHistory.value.push(snapshot());
    currentBoard.value = prevState.board;
    notesBoard.value = prevState.notes;
    cancelComplexHint();
    resetHintChain();
  }

  function redoMove() {
    clearApplied();
    const nextState = redoHistory.value.pop();
    if (!nextState) return;
    boardHistory.value.push(snapshot());
    currentBoard.value = nextState.board;
    notesBoard.value = nextState.notes;
    cancelComplexHint();
    resetHintChain();
  }

  // Every empty cell's notes become exactly its candidates; filled cells keep theirs.
  function autoFillNotes() {
    saveHistory();
    const cands = getGridCandidates(currentBoard.value);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard.value[r]![c] !== 0) continue;
        const notes = Array(10).fill(false);
        for (const n of cands[r]![c]!) notes[n] = true;
        notesBoard.value[r]![c] = notes;
      }
    }
  }

  // What the digit at (r, c) completes: each row, column or box through it whose every cell
  // matches the solution (not just non-empty: a wrong-but-unconflicting digit can sit unflagged),
  // and the digit itself once all nine are in and right. A cell in two of them is listed twice.
  function completedAt(r: number, c: number) {
    const board = currentBoard.value;
    const solved = solvedBoard.value;
    const boxR = r - (r % 3);
    const boxC = c - (c % 3);
    const units = [
      Array.from({ length: 9 }, (_, i) => ({ r, c: i })),
      Array.from({ length: 9 }, (_, i) => ({ r: i, c })),
      Array.from({ length: 9 }, (_, i) => ({ r: boxR + Math.floor(i / 3), c: boxC + (i % 3) })),
    ].filter((unit) => unit.every((p) => board[p.r]![p.c] === solved[p.r]![p.c]));
    const num = board[r]![c]!;
    const digitCells = solved.flatMap((row, sr) =>
      row.flatMap((v, sc) => (v === num ? [{ r: sr, c: sc }] : [])),
    );
    const digitDone = digitCells.every((p) => board[p.r]![p.c] === num);
    return {
      units: units.length,
      digitDone,
      cells: [...units.flat(), ...(digitDone ? digitCells : [])] as CellCoord[],
    };
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
    const digitsStr = move.digits.map((d) => digitLabel(d, colorMode.value, t)).join(", ");
    const findDesc = t(`hint.move.${tech}.desc`, {
      num: digitLabel(move.digits[0] ?? 0, colorMode.value, t),
      digits: digitsStr,
      count: move.eliminations.length,
    });
    const triggerCoords: HintCoordinate[] = move.triggers.map((c) => ({
      r: c.r,
      c: c.c,
      type: "trigger",
    }));

    let targetCell: CellCoord | null = null;
    let actionStep: ExplanationStep;
    if (move.placement) {
      targetCell = { r: move.placement.r, c: move.placement.c };
      actionStep = {
        label: t("hint.move.placeLabel"),
        description: t("hint.move.placeStep", {
          num: digitLabel(move.placement.num, colorMode.value, t),
          row: move.placement.r + 1,
          col: move.placement.c + 1,
        }),
        highlightCoords: [], // the target is drawn on its own, in the legend's green
      };
    } else {
      actionStep = {
        label: t("hint.move.eliminateLabel"),
        description: t("hint.move.eliminateStep", {
          // The digits removed (for hidden subsets, the other candidates, not the subset).
          digits: [...new Set(move.eliminations.map((e) => e.num))]
            .map((d) => digitLabel(d, colorMode.value, t))
            .join(", "),
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
      steps: [
        { label: t("hint.move.findLabel"), description: findDesc, highlightCoords: triggerCoords },
        actionStep,
      ],
    };
  }

  /**
   * The next hint without starting it: where it acts (a placement, else the first removal) and
   * its move, which is null when the hint is about a wrong entry.
   */
  function peekHint(): { at: CellCoord; move: SolveMove | null } | null {
    const wrong = findWrongEntry();
    if (wrong) return { at: wrong, move: null };
    const move = nextUsefulHint();
    const at = move?.placement ?? move?.eliminations[0] ?? move?.triggers[0];
    return at && move ? { at: { r: at.r, c: at.c }, move } : null;
  }

  /** Starts the next hint; returns the status line to announce. */
  function triggerComplexHint(): string {
    const wrong = findWrongEntry();
    const move = wrong ? null : nextUsefulHint();
    if (!wrong && !move) {
      activeMove.value = null;
      return t("hint.move.none");
    }
    activeMove.value = move;
    const hint = wrong ? buildWrongEntryHint(wrong) : buildHintFromMove(move!);
    activeComplexHint.value = hint;
    currentStepIndex.value = 0;
    // The selection's yellow would cover a hint cell's colour, so clear it while the hint shows.
    selectedCell.value = null;
    updateStepHighlights();
    return hint.title;
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
    const hint = activeComplexHint.value;
    if (hint?.wrongEntry && hint.targetCell) {
      eraseCell(hint.targetCell); // also cancels the hint and resets the chain
      return;
    }
    const move = activeMove.value;
    if (!move) return;

    saveHistory();
    if (move.placement) {
      const { r, c, num } = move.placement;
      currentBoard.value[r]![c] = num;
      clearRelationalNotes(r, c, num);
    } else {
      // Elimination: cross the digit out of the player's notes. A cell without notes first
      // gets its candidates (minus earlier removals) so the deduction is visible. The removal
      // persists via appliedEliminations (replayed by the next hint).
      const baseCands = getGridCandidates(currentBoard.value);
      for (const { r, c, num } of move.eliminations) {
        const notes = notesBoard.value[r]![c]!;
        if (!notes.some(Boolean)) {
          for (const n of baseCands[r]![c]!) {
            notes[n] = !appliedEliminations.value.some(
              (p) => p.r === r && p.c === c && p.num === n,
            );
          }
        }
        notes[num] = false;
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
    resetGameState();
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
    getConflictCells,
    getGridCandidates,
    startNewGame,
    loadCustomBoard,
    restoreGame,
    eraseCell,
    clearRelationalNotes,
    saveHistory,
    undoMove,
    redoMove,
    redoHistory,
    boardHistory,
    checkWinCondition,
    autoFillNotes,
    completedAt,
    triggerComplexHint,
    peekHint,
    findWrongEntry,
    nextHintStep,
    prevHintStep,
    applyComplexHint,
    cancelComplexHint,
    resetHintChain,
    activeMove,
    hintMarks,
    showApplied,
  };
}
