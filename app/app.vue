<script setup lang="ts">
import * as uiLocales from "@nuxt/ui/locale";
import confetti from "canvas-confetti";
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";

import type { CellCoord, Difficulty, FlashCell } from "./types/sudoku";
import type { TechniqueId } from "./utils/sudokuGrader";

import AchievementsScreen from "./components/AchievementsScreen.vue";
import AchievementToast from "./components/AchievementToast.vue";
import ControlPanel from "./components/ControlPanel.vue";
import CustomImport from "./components/CustomImport.vue";
import DifficultySelector from "./components/DifficultySelector.vue";
import GameDashboard from "./components/GameDashboard.vue";
import Numpad from "./components/Numpad.vue";
import SettingsScreen from "./components/SettingsScreen.vue";
import SideExplanationPanel from "./components/SideExplanationPanel.vue";
import StatsScreen from "./components/StatsScreen.vue";
import SudokuAcademy from "./components/SudokuAcademy.vue";
import SudokuGrid from "./components/SudokuGrid.vue";
import { useAchievements } from "./composables/useAchievements";
import { useDailyPuzzle } from "./composables/useDailyPuzzle";
import { useGameSave, type GameSave } from "./composables/useGameSave";
import { usePreferences } from "./composables/usePreferences";
import { useScore } from "./composables/useScore";
import { useSudokuEngine } from "./composables/useSudokuEngine";
import { useTechniqueStats } from "./composables/useTechniqueStats";
import { useTimer } from "./composables/useTimer";
import { haptic } from "./utils/haptics";
import { levelBand, levelFor } from "./utils/level";
import { generatePracticePuzzle } from "./utils/practice";
import { computeScore, type ScoreBreakdown } from "./utils/score";
import { playComplete, playHint, playMistake, playPlace, playUnlock, playWin } from "./utils/sound";
import { starsFor } from "./utils/stars";
import { digitLabel } from "./utils/sudokuColors";

const { t, locale, locales } = useI18n();
const localeMap = uiLocales as Record<string, typeof uiLocales.en>;

useHead(() => ({
  title: t("menu.title"),
  htmlAttrs: { lang: locales.value.find((l) => l.code === locale.value)?.language ?? locale.value },
}));

const {
  colorMode,
  soundEnabled,
  hapticsEnabled,
  digitFirst,
  showTimer,
  mistakeLimit,
  highlightErrors,
} = usePreferences();

// One call per game event: the sound and the vibration, each respecting its own setting.
const CUES = {
  place: [playPlace, "place"],
  mistake: [playMistake, "mistake"],
  complete: [playComplete, "complete"],
  win: [playWin, "win"],
  hint: [playHint, null],
  unlock: [playUnlock, null],
} as const;
function cue(kind: keyof typeof CUES) {
  const [sound, vibration] = CUES[kind];
  if (soundEnabled.value) sound();
  if (vibration && hapticsEnabled.value) haptic(vibration);
}
const engine = useSudokuEngine(colorMode);
const timer = useTimer();

const {
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
  startNewGame,
  restoreGame,
  eraseCell,
  clearRelationalNotes,
  saveHistory,
  undoMove,
  redoMove,
  redoHistory,
  boardHistory,
  triggerComplexHint,
  nextHintStep,
  prevHintStep,
  cancelComplexHint,
  checkWinCondition,
  loadCustomBoard,
} = engine;

const gameSave = useGameSave();
const techStats = useTechniqueStats();
const achievements = useAchievements();
// Ids of achievements just unlocked, shown as toasts until they time out or are clicked.
const toastIds = ref<string[]>([]);
const dailyPuzzle = useDailyPuzzle();
const isDailyMode = ref(false);
// Set while playing a technique-practice puzzle: no score, achievements or autosave slot.
const practiceTechnique = ref<TechniqueId | null>(null);
const practiceLoading = ref(false);

const notesMode = ref<boolean>(false);
const mistakes = ref<number>(0);
const hintStatus = ref<string>(t("game.ready"));
const hintBody = ref<string>("");
const currentScreen = ref<
  | "menu"
  | "difficulty"
  | "game"
  | "academy"
  | "custom-import"
  | "stats"
  | "achievements"
  | "settings"
>("menu");
const activeDifficulty = ref<Difficulty>("medium");

const showModal = ref<boolean>(false);
const modalTitle = ref<string>("");
const modalMessage = ref<string>("");
const isWinState = ref<boolean>(false);

const pendingResume = ref<{ save: GameSave; level: Difficulty } | null>(null);

const hintsUsed = ref<number>(0);
const techniqueLog = ref<string[]>([]);
const mistakeExplainer = ref<string>("");

const flashCells = ref<FlashCell[]>([]);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

const score = useScore();
const lastScore = ref<ScoreBreakdown | null>(null);
const isNewBest = ref<boolean>(false);
const lifetimeTotal = ref<number>(0);
// Set when the just-won game crossed a level threshold, for the win modal banner.
const reachedLevel = ref<number | null>(null);
const displayedScore = ref<number>(0); // animated count-up of lastScore.total

// Count `displayedScore` up to the final total over ~0.8s for a little flourish.
function animateScoreCountUp(to: number) {
  const start = performance.now();
  const duration = 800;
  displayedScore.value = 0;
  function tick(now: number) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    displayedScore.value = Math.round(to * eased);
    if (p < 1) requestAnimationFrame(tick);
    else displayedScore.value = to;
  }
  requestAnimationFrame(tick);
}

// Lifetime per-technique usage from localStorage; refreshed when the win modal opens
const techStatsTotals = computed(() => {
  void showModal.value;
  return techStats.getAll();
});

// Depend on currentScreen so these refresh when returning to the menu
// after completing the daily (localStorage itself is not reactive).
const dailyRecord = computed(() => {
  void currentScreen.value;
  return dailyPuzzle.getRecord();
});
// Lifetime score drives the level; refreshed on screen change like the daily record above.
const playerLevel = computed(() => {
  void currentScreen.value;
  return levelFor(score.getStats().total);
});
const dailyStreak = computed(() => {
  void currentScreen.value;
  return dailyPuzzle.getStreak();
});

// Auto-save on every meaningful state change while a game is active.
// Guard showModal: the watcher fires on the next tick AFTER triggerLocalModal
// clears the save — without this guard the save would be re-created immediately.
watch(
  [currentBoard, notesBoard, mistakes, hintsUsed],
  () => {
    if (currentScreen.value !== "game" || showModal.value || practiceTechnique.value) return;
    if (!currentBoard.value || !initialBoard.value) return;
    gameSave.save({
      currentBoard: currentBoard.value,
      initialBoard: initialBoard.value,
      solvedBoard: solvedBoard.value,
      notesBoard: notesBoard.value,
      difficulty: activeDifficulty.value,
      timerSeconds: timer.timerSeconds.value,
      mistakes: mistakes.value,
      hintsUsed: hintsUsed.value,
    });
  },
  { deep: true },
);

function triggerLocalModal(title: string, message: string, win: boolean = false) {
  modalTitle.value = title;
  modalMessage.value = message;
  isWinState.value = win;
  showModal.value = true;
  reachedLevel.value = null;
  timer.stopTimer();
  if (!practiceTechnique.value) gameSave.clearDifficulty(activeDifficulty.value);
  if (win) {
    cue("win");
    flashWin();
    if (practiceTechnique.value) {
      lastScore.value = null;
    } else {
      if (isDailyMode.value) dailyPuzzle.markComplete(timer.timerSeconds.value, mistakes.value);
      const breakdown = computeScore({
        difficulty: activeDifficulty.value,
        timeSeconds: timer.timerSeconds.value,
        mistakes: mistakes.value,
        hintsUsed: hintsUsed.value,
      });
      const result = score.record(
        activeDifficulty.value,
        breakdown.total,
        timer.timerSeconds.value,
      );
      lastScore.value = breakdown;
      isNewBest.value = result.isNewBest;
      lifetimeTotal.value = result.stats.total;
      const before = levelFor(result.previousTotal).level;
      const after = levelFor(result.stats.total).level;
      reachedLevel.value = after > before ? after : null;
      const unlocked = achievements.evaluate({
        difficulty: activeDifficulty.value,
        timeSeconds: timer.timerSeconds.value,
        mistakes: mistakes.value,
        hintsUsed: hintsUsed.value,
        isDaily: isDailyMode.value,
        colorMode: colorMode.value,
        hour: new Date().getHours(),
        gamesWon: result.stats.gamesWon,
        winsAtDifficulty: result.stats.perDifficulty[activeDifficulty.value]?.wins ?? 0,
        dailyStreak: isDailyMode.value ? dailyPuzzle.getStreak() : 0,
        distinctTechniques: Object.keys(techStats.getAll()).length,
      });
      toastIds.value.push(...unlocked);
      if (unlocked.length) cue("unlock");
      animateScoreCountUp(breakdown.total);
    }
    confetti({
      disableForReducedMotion: true,
      particleCount: 160,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#345fc9", "#6b92e9", "#bdd1f7", "#fbbf24", "#34d399"],
    });
  } else {
    lastScore.value = null;
  }
}

function handleModalClose() {
  showModal.value = false;
  practiceTechnique.value = null;
  isDailyMode.value = false;
  currentScreen.value = "menu";
  timer.resetTimer();
}

function resumeSavedGame(s: GameSave) {
  practiceTechnique.value = null;
  restoreGame(s);
  activeDifficulty.value = s.difficulty;
  mistakes.value = s.mistakes;
  hintStatus.value = t("game.ready");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = s.hintsUsed ?? 0;
  techniqueLog.value = [];
  timer.resetTimer();
  timer.timerSeconds.value = s.timerSeconds;
  timer.startTimer();
  currentScreen.value = "game";
}

function handleStartGame(level: Difficulty) {
  practiceTechnique.value = null;
  gameSave.clearDifficulty(level);
  activeDifficulty.value = level;
  mistakes.value = 0;
  hintStatus.value = t("game.newBoard");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  startNewGame(level);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = "game";
}

// A difficulty already has a saved game — ask before silently overwriting it.
function handleChooseDifficulty(level: Difficulty) {
  const existing = gameSave.loadDifficulty(level);
  if (existing) {
    pendingResume.value = { save: existing, level };
  } else {
    handleStartGame(level);
  }
}

function handleResumeConfirm() {
  if (!pendingResume.value) return;
  resumeSavedGame(pendingResume.value.save);
  pendingResume.value = null;
}

function handleResumeDecline() {
  if (!pendingResume.value) return;
  handleStartGame(pendingResume.value.level);
  pendingResume.value = null;
}

// Digit-first input: the numpad arms a digit, and tapping a cell places it. Tapping a given
// does nothing but select; tapping a cell that already holds the armed digit removes it.
const activeDigit = ref<number | null>(null);

function handleNumpad(num: number) {
  if (digitFirst.value) {
    activeDigit.value = activeDigit.value === num ? null : num;
    return;
  }
  handleInputNumber(num);
}

function handleSelectCell(coord: CellCoord) {
  selectedCell.value = coord;
  if (digitFirst.value && activeDigit.value && initialBoard.value[coord.r]![coord.c] === 0) {
    handleInputNumber(activeDigit.value);
  }
}

// An armed digit is meaningless once the player leaves the game, turns the mode off, or has
// placed all nine of it.
watch([currentScreen, digitFirst], () => {
  if (currentScreen.value !== "game" || !digitFirst.value) activeDigit.value = null;
});
watch(numberCounts, (counts) => {
  if (activeDigit.value && counts[activeDigit.value]! >= 9) activeDigit.value = null;
});

// A correct placement may finish a row, column, and/or box — flash every
// cell of each newly-completed unit. "Complete" means every cell already
// matches the solution, not just non-empty (a wrong-but-unconflicting digit
// can sit in a cell without being flagged, so equality is the real check).
function flashCompletedUnits(r: number, c: number) {
  // Cells ripple outward from the digit just placed: 45 ms per step of distance.
  const RIPPLE_MS = 45;
  const cells: FlashCell[] = [];
  const add = (cr: number, cc: number) =>
    cells.push({ r: cr, c: cc, delay: Math.max(Math.abs(cr - r), Math.abs(cc - c)) * RIPPLE_MS });

  if ([...Array(9).keys()].every((i) => currentBoard.value[r]![i] === solvedBoard.value[r]![i])) {
    for (let i = 0; i < 9; i++) add(r, i);
  }
  if ([...Array(9).keys()].every((i) => currentBoard.value[i]![c] === solvedBoard.value[i]![c])) {
    for (let i = 0; i < 9; i++) add(i, c);
  }
  const boxR = r - (r % 3);
  const boxC = c - (c % 3);
  let boxComplete = true;
  for (let i = 0; i < 3 && boxComplete; i++) {
    for (let j = 0; j < 3; j++) {
      if (currentBoard.value[boxR + i]![boxC + j] !== solvedBoard.value[boxR + i]![boxC + j]) {
        boxComplete = false;
        break;
      }
    }
  }
  if (boxComplete) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) add(boxR + i, boxC + j);
    }
  }

  if (!cells.length) return;
  cue("complete");
  runFlash(cells);
}

// Longest delay + the 0.7 s animation, with headroom, then clear so the next flash can replay.
function runFlash(cells: FlashCell[]) {
  if (flashTimeout) clearTimeout(flashTimeout);
  flashCells.value = cells;
  const longest = Math.max(...cells.map((c) => c.delay));
  flashTimeout = setTimeout(() => {
    flashCells.value = [];
  }, longest + 900);
}

// Winning sweeps a diagonal wave across the whole board before the result appears.
function flashWin() {
  const cells: FlashCell[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) cells.push({ r, c, delay: (r + c) * 45 });
  }
  runFlash(cells);
}

function handleInputNumber(num: number) {
  if (timer.isPaused.value || !selectedCell.value) return;
  const { r, c } = selectedCell.value;

  if (initialBoard.value[r]![c] !== 0) return;

  // Manual entry dismisses any active step-by-step hint and resets the hint
  // chain — the board the hint was reasoning about no longer matches what the
  // player is doing.
  if (activeComplexHint.value) cancelComplexHint();
  engine.resetHintChain();

  saveHistory();

  if (notesMode.value) {
    if (currentBoard.value[r]![c] !== 0) return;
    notesBoard.value[r]![c]![num] = !notesBoard.value[r]![c]![num];
  } else {
    if (currentBoard.value[r]![c] === num) {
      currentBoard.value[r]![c] = 0;
    } else {
      currentBoard.value[r]![c] = num;

      const conflicts = engine.getConflictCells(r, c, num);
      if (num !== solvedBoard.value[r]![c] || conflicts.length > 0) {
        mistakes.value++;
        // With "Highlight mistakes" off the entry stays unmarked and can't end the game;
        // it still counts toward the score.
        if (highlightErrors.value) {
          cue("mistake");
          if (conflicts.length > 0) {
            const inRow = conflicts.some((cc) => cc.r === r);
            const inCol = conflicts.some((cc) => cc.c === c);
            const inBox = conflicts.some((cc) => cc.r !== r && cc.c !== c);
            const where = inRow
              ? t("game.whereRow", { n: r + 1 })
              : inCol
                ? t("game.whereCol", { n: c + 1 })
                : inBox
                  ? t("game.whereBox")
                  : t("game.whereCell");
            hintStatus.value = t("game.conflictWith", { where });
            const first = conflicts[0]!;
            mistakeExplainer.value = t("game.whyConflict", {
              num: digitLabel(num, colorMode.value, t),
              r: first.r + 1,
              c: first.c + 1,
            });
          } else {
            hintStatus.value = t("game.wrongDigit");
            mistakeExplainer.value = t("game.whyWrong", {
              num: digitLabel(num, colorMode.value, t),
            });
          }
          if (mistakeLimit.value > 0 && mistakes.value >= mistakeLimit.value) {
            triggerLocalModal(t("modal.gameOver"), t("modal.gameOverMsg"));
          }
        }
      } else {
        cue("place");
        mistakeExplainer.value = "";
        clearRelationalNotes(r, c, num);
        flashCompletedUnits(r, c);
        if (checkWinCondition()) {
          triggerLocalModal(
            t("modal.win"),
            t("modal.winMsg", {
              difficulty: activeDifficulty.value,
              time: timer.formatTime(timer.timerSeconds.value),
            }),
            true,
          );
        }
      }
    }
  }
}

function handleNextStep() {
  const title = activeComplexHint.value?.title;
  const wasPlacement = !!engine.activeMove.value?.placement;
  nextHintStep(() => {
    if (title) {
      if (!techniqueLog.value.includes(title)) techniqueLog.value.push(title);
      techStats.record(title);
    }
    hintsUsed.value++;
    if (wasPlacement) cue("place");
    if (checkWinCondition()) {
      triggerLocalModal(
        t("modal.win"),
        t("modal.winHintMsg", { time: timer.formatTime(timer.timerSeconds.value) }),
        true,
      );
    } else {
      hintStatus.value = wasPlacement ? t("game.cellFilled") : t("game.candidatesCleared");
      hintBody.value = "";
    }
  });
}

function handleTriggerHint() {
  if (activeComplexHint.value) {
    handleInstantApplyHint();
  } else {
    cue("hint");
    triggerComplexHint(hintStatus, hintBody);
  }
}

function handleInstantApplyHint() {
  if (!activeComplexHint.value) return;
  const name = activeComplexHint.value.title;
  const wasPlacement = !!engine.activeMove.value?.placement;
  hintsUsed.value++;
  if (!techniqueLog.value.includes(name)) techniqueLog.value.push(name);
  techStats.record(name);
  engine.applyComplexHint();
  if (wasPlacement) cue("place");
  if (checkWinCondition()) {
    triggerLocalModal(t("modal.win"), t("modal.winInstantMsg"), true);
  } else {
    hintStatus.value = wasPlacement ? t("game.instantApplied") : t("game.candidatesCleared");
    hintBody.value = "";
  }
}

function handleAutoFillNotes() {
  saveHistory();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard.value[r]![c] === 0) {
        notesBoard.value[r]![c] = Array(10).fill(false);
        for (let val = 1; val <= 9; val++) {
          if (engine.isValid(currentBoard.value, r, c, val)) {
            notesBoard.value[r]![c]![val] = true;
          }
        }
      }
    }
  }
  hintStatus.value = t("game.notesFilled");
}

function handleStartDaily() {
  practiceTechnique.value = null;
  isDailyMode.value = true;
  activeDifficulty.value = "medium";
  mistakes.value = 0;
  hintStatus.value = t("game.newBoard");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  loadCustomBoard(dailyPuzzle.getBoard());
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = "game";
}

function handleLoadCustomPuzzle(
  board: import("./types/sudoku").Grid,
  practice: TechniqueId | null = null,
) {
  practiceTechnique.value = practice;
  activeDifficulty.value = "custom";
  mistakes.value = 0;
  hintStatus.value = t("game.newBoard");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  loadCustomBoard(board);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = "game";
}

let practiceToken = 0;
async function handlePractice(technique: TechniqueId) {
  if (practiceLoading.value) return; // a double-click must not start two searches
  practiceLoading.value = true;
  const token = ++practiceToken;
  try {
    const p = await generatePracticePuzzle(technique);
    // The player may have left the Academy while the search ran; don't yank them into a game.
    if (token !== practiceToken || currentScreen.value !== "academy") return;
    handleLoadCustomPuzzle(p.board, technique);
    if (p.notes) {
      for (const [key, digits] of Object.entries(p.notes)) {
        const [r, c] = key.split("-").map(Number) as [number, number];
        for (const d of digits) notesBoard.value[r]![c]![d] = true;
      }
      hintStatus.value = t("practice.drill");
    } else {
      hintStatus.value = t("practice.puzzle");
    }
  } finally {
    practiceLoading.value = false;
  }
}

function exitToMenu() {
  practiceTechnique.value = null;
  timer.stopTimer();
  cancelComplexHint();
  currentScreen.value = "menu";
}

const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

const clamp = (n: number) => Math.min(8, Math.max(0, n));

// Arrow keys walk the grid (clamped at the edges); focus follows so screen readers announce the cell.
function moveSelection(dr: number, dc: number) {
  const cur = selectedCell.value;
  // With nothing selected, the first arrow press lands on the top-left cell.
  const r = cur ? clamp(cur.r + dr) : 0;
  const c = cur ? clamp(cur.c + dc) : 0;
  selectedCell.value = { r, c }; // not handleSelectCell: arrows must never place an armed digit
  nextTick(() => document.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus());
}

// Undo/redo can both change whether the board is solved, so route them through the same win
// check as a placement; and never act behind a modal (a second win would double-record).
function undo() {
  if (showModal.value || practiceLoading.value) return;
  undoMove();
}
function redo() {
  if (showModal.value || practiceLoading.value) return;
  redoMove();
  if (checkWinCondition()) {
    triggerLocalModal(
      t("modal.win"),
      t("modal.winMsg", {
        difficulty: activeDifficulty.value,
        time: timer.formatTime(timer.timerSeconds.value),
      }),
      true,
    );
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (currentScreen.value !== "game" || timer.isPaused.value) return;
  if (showModal.value || practiceLoading.value) return;
  // Browser/OS shortcuts (Cmd+R, Ctrl+A, Cmd+N…) must not trigger game actions; only
  // undo/redo are claimed: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y.
  if (e.metaKey || e.ctrlKey) {
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) undo();
    else if ((k === "z" && e.shiftKey) || k === "y") redo();
    else return;
    e.preventDefault();
    return;
  }
  if (e.key === "Escape" && activeDigit.value) {
    activeDigit.value = null;
    return;
  }
  const arrow = ARROW_STEPS[e.key];
  if (arrow) {
    e.preventDefault();
    moveSelection(arrow[0], arrow[1]);
    return;
  }
  if (e.key >= "1" && e.key <= "9") {
    handleInputNumber(parseInt(e.key));
  } else if (e.key === "Backspace" || e.key === "Delete") {
    eraseCell(selectedCell.value);
  } else if (e.key.toLowerCase() === "n") {
    notesMode.value = !notesMode.value;
  } else if (e.key.toLowerCase() === "h") {
    handleTriggerHint();
  } else if (e.key.toLowerCase() === "a") {
    handleAutoFillNotes();
  }
}

// Switching tabs/apps shouldn't quietly burn time against the player's score.
function handlePageHidden() {
  if (document.hidden && currentScreen.value === "game" && !timer.isPaused.value) {
    timer.togglePause();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  document.addEventListener("visibilitychange", handlePageHidden);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("visibilitychange", handlePageHidden);
  if (flashTimeout) clearTimeout(flashTimeout);
});
</script>

<template>
  <UApp :locale="localeMap[locale] ?? uiLocales.en">
    <div
      class="app-shell flex min-h-screen w-full flex-col bg-zinc-50 text-zinc-900 antialiased dark:bg-[#0d141b] dark:text-zinc-100"
    >
      <Transition name="screen" mode="out-in">
        <!-- MENU -->
        <div
          v-if="currentScreen === 'menu'"
          class="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12"
        >
          <div class="text-center">
            <h1
              class="wordmark relative isolate inline-block text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50"
            >
              {{ $t("menu.title") }}
            </h1>
            <p class="mt-3 text-[11px] font-semibold text-zinc-500">
              {{ $t("menu.subtitle") }}
            </p>
            <!-- Level / progress -->
            <div class="mx-auto mt-5 w-full max-w-[220px]" data-testid="level-badge">
              <p class="text-[11px] font-bold text-violet-600 dark:text-violet-300">
                {{ $t("level.label", { n: playerLevel.level }) }}
                <span class="text-zinc-500"
                  >· {{ $t(`level.title.${levelBand(playerLevel.level)}`) }}</span
                >
              </p>
              <div class="mt-1.5 h-1.5 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                <div
                  class="h-full bg-violet-600 hover:bg-violet-700"
                  :style="{ width: `${Math.round(playerLevel.progress * 100)}%` }"
                />
              </div>
            </div>
          </div>
          <div class="flex w-full max-w-sm flex-col items-center gap-3">
            <!-- New game -->
            <button
              @click="currentScreen = 'difficulty'"
              class="w-full bg-violet-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-700 hover:brightness-110 active:scale-95"
            >
              {{ $t("menu.start") }}
            </button>

            <!-- Daily challenge -->
            <button
              @click="handleStartDaily"
              :disabled="!!dailyRecord"
              :class="
                dailyRecord
                  ? 'cursor-default border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-600'
                  : 'border-violet-500/60 bg-violet-500/5 text-violet-700 hover:bg-violet-500/10 dark:border-violet-400/50 dark:text-violet-200 dark:hover:bg-violet-400/10'
              "
              class="flex w-full items-center justify-center gap-2 border px-6 py-4 text-sm font-bold transition-all active:scale-95"
            >
              <AppIcon
                class="h-4 w-4 shrink-0"
                path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
              <span v-if="dailyRecord">{{ $t("menu.dailyCompleted") }}</span>
              <span v-else>{{ $t("menu.dailyChallenge") }}</span>
            </button>
            <p
              v-if="dailyStreak > 0"
              class="-mt-1 text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400"
            >
              🔥 {{ $t("menu.dailyStreak", { n: dailyStreak }) }}
            </p>

            <div class="grid w-full grid-cols-2 gap-3">
              <!-- Custom puzzle -->
              <button
                @click="currentScreen = 'custom-import'"
                class="flex flex-col items-center justify-center gap-1.5 border border-zinc-300 bg-transparent px-2 py-4 text-center text-[11px] leading-tight font-semibold text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <AppIcon
                  class="h-4 w-4"
                  path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
                {{ $t("menu.customPuzzle") }}
              </button>

              <!-- Academy -->
              <button
                @click="currentScreen = 'academy'"
                class="flex flex-col items-center justify-center gap-1.5 border border-zinc-300 bg-transparent px-2 py-4 text-center text-[11px] leading-tight font-semibold text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <AppIcon
                  class="h-4 w-4"
                  path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
                {{ $t("menu.academy") }}
              </button>

              <!-- Statistics -->
              <button
                @click="currentScreen = 'stats'"
                class="flex flex-col items-center justify-center gap-1.5 border border-zinc-300 bg-transparent px-2 py-4 text-center text-[11px] leading-tight font-semibold text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <AppIcon
                  class="h-4 w-4"
                  path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
                {{ $t("menu.stats") }}
              </button>

              <!-- Achievements -->
              <button
                @click="currentScreen = 'achievements'"
                class="flex flex-col items-center justify-center gap-1.5 border border-zinc-300 bg-transparent px-2 py-4 text-center text-[11px] leading-tight font-semibold text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <AppIcon
                  class="h-4 w-4"
                  path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
                />
                {{ $t("menu.achievements") }}
              </button>

              <!-- Settings -->
              <button
                @click="currentScreen = 'settings'"
                class="col-span-2 flex flex-col items-center justify-center gap-1.5 border border-zinc-300 bg-transparent px-2 py-4 text-center text-[11px] leading-tight font-semibold text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <AppIcon
                  class="h-4 w-4"
                  path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.65 7.65 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                {{ $t("menu.settings") }}
              </button>
            </div>
          </div>
        </div>

        <!-- DIFFICULTY -->
        <DifficultySelector
          v-else-if="currentScreen === 'difficulty'"
          :active-difficulty="activeDifficulty"
          @select-difficulty="handleChooseDifficulty"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- ACADEMY -->
        <SudokuAcademy
          v-else-if="currentScreen === 'academy'"
          @back-to-menu="currentScreen = 'menu'"
          @practice="handlePractice"
        />

        <!-- STATISTICS -->
        <StatsScreen
          v-else-if="currentScreen === 'stats'"
          @back-to-menu="currentScreen = 'menu'"
          @start-game="currentScreen = 'difficulty'"
        />

        <!-- ACHIEVEMENTS -->
        <AchievementsScreen
          v-else-if="currentScreen === 'achievements'"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- SETTINGS -->
        <SettingsScreen
          v-else-if="currentScreen === 'settings'"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- CUSTOM IMPORT -->
        <CustomImport
          v-else-if="currentScreen === 'custom-import'"
          @load-puzzle="handleLoadCustomPuzzle"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- GAME -->
        <div
          v-else-if="currentScreen === 'game'"
          class="flex w-full max-w-7xl flex-col gap-4 3xl:max-w-[1900px] 3xl:grid-cols-[240px_minmax(0,1fr)_420px] 3xl:gap-6 3xl:px-8 sm:px-5 sm:py-3 lg:grid lg:gap-6 lg:max-3xl:grid-cols-12"
        >
          <!-- 3xl left sidebar: shortcuts & branding -->
          <div class="sticky top-3 hidden flex-col gap-6 3xl:col-span-1 3xl:flex">
            <div>
              <p class="mb-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                {{ $t("sidebar.keyboard") }}
              </p>
              <ul class="space-y-3">
                <li
                  v-for="(s, i) in [
                    { key: '1–9', desc: $t('sidebar.shortcutInputNumber') },
                    { key: 'Backspace', desc: $t('sidebar.shortcutEraseCell') },
                    { key: 'N', desc: $t('sidebar.shortcutToggleNotes') },
                    { key: 'H', desc: $t('sidebar.shortcutGetHint') },
                    { key: 'A', desc: $t('sidebar.shortcutAutoFillNotes') },
                    { key: 'Ctrl+Z', desc: $t('sidebar.shortcutUndo') },
                    { key: 'Ctrl+Y', desc: $t('sidebar.shortcutRedo') },
                  ]"
                  :key="i"
                  class="flex items-center gap-3"
                >
                  <kbd
                    class="min-w-[60px] shrink-0 border border-zinc-300 bg-zinc-100 px-2 py-1 text-center font-game text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    >{{ s.key }}</kbd
                  >
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">{{ s.desc }}</span>
                </li>
              </ul>
            </div>

            <div class="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p class="mb-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                {{ $t("sidebar.legend") }}
              </p>
              <ul class="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li class="flex items-center gap-3">
                  <span
                    class="h-4 w-4 shrink-0 border border-zinc-400 bg-zinc-900 dark:border-zinc-600 dark:bg-zinc-100"
                  />
                  {{ $t("sidebar.legendGiven") }}
                </li>
                <li class="flex items-center gap-3">
                  <span
                    class="h-4 w-4 shrink-0 border border-violet-500 bg-violet-600/30 dark:border-violet-400 dark:bg-violet-300/30"
                  />
                  {{ $t("sidebar.legendEntry") }}
                </li>
                <li class="flex items-center gap-3">
                  <span class="h-4 w-4 shrink-0 border border-rose-400 bg-rose-500/20" />
                  {{ $t("sidebar.legendConflict") }}
                </li>
                <li class="flex items-center gap-3">
                  <span
                    class="h-4 w-4 shrink-0 border border-violet-300 bg-violet-200 dark:border-violet-400/70 dark:bg-violet-500/35"
                  />
                  {{ $t("sidebar.legendSame") }}
                </li>
                <li class="flex items-center gap-3">
                  <span
                    class="h-4 w-4 shrink-0 border-2 border-amber-500 bg-amber-200 dark:border-amber-300 dark:bg-amber-400/30"
                  />
                  {{ $t("sidebar.legendSelected") }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Center / main game column -->
          <div class="flex w-full flex-col 3xl:col-span-1 lg:gap-3 lg:max-3xl:col-span-7">
            <GameDashboard
              :formatted-time="timer.formatTime(timer.timerSeconds.value)"
              :is-paused="timer.isPaused.value"
              :mistakes="mistakes"
              :max-mistakes="mistakeLimit"
              :show-timer="showTimer"
              :show-mistakes="highlightErrors"
              :difficulty="
                practiceTechnique
                  ? `${$t('practice.label')} · ${$t(`hint.move.${practiceTechnique}.name`)}`
                  : activeDifficulty
              "
              @toggle-pause="timer.togglePause()"
              @exit-game="exitToMenu"
            />

            <!-- Why-wrong explainer -->
            <div
              v-if="mistakeExplainer"
              class="flex items-start justify-between gap-2 border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300"
            >
              <p>{{ mistakeExplainer }}</p>
              <button
                @click="mistakeExplainer = ''"
                :aria-label="$t('modal.close')"
                class="shrink-0 px-1 font-bold transition-colors hover:text-rose-900 dark:hover:text-rose-100"
              >
                ✕
              </button>
            </div>

            <div class="relative flex flex-col gap-3">
              <SudokuGrid
                :current-board="currentBoard"
                :initial-board="initialBoard"
                :solved-board="solvedBoard"
                :notes-board="notesBoard"
                :selected-cell="selectedCell"
                :active-hint-cell="activeHintCell"
                :hint-triggers="hintTriggers"
                :hint-eliminations="hintEliminations"
                :conflict-cells="conflictCells"
                :color-mode="colorMode"
                :flash-cells="flashCells"
                :show-errors="highlightErrors"
                :active-digit="activeDigit"
                @select-cell="handleSelectCell"
              />
              <div class="mx-2 flex flex-col gap-2 sm:mx-0">
                <ControlPanel
                  :notes-mode="notesMode"
                  :can-undo="boardHistory.length > 0"
                  :can-redo="redoHistory.length > 0"
                  @undo="undo"
                  @redo="redo"
                  @erase="eraseCell(selectedCell)"
                  @toggle-notes="notesMode = !notesMode"
                  @trigger-hint="handleTriggerHint"
                  @auto-notes="handleAutoFillNotes"
                />

                <Numpad
                  :counts="numberCounts"
                  :color-mode="colorMode"
                  @input-number="handleNumpad"
                  :active-digit="activeDigit"
                  :digit-first="digitFirst"
                />
              </div>

              <!-- PAUSE OVERLAY -->
              <div
                v-if="timer.isPaused.value"
                class="pause-overlay absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/80 backdrop-blur-sm"
              >
                <AppIcon
                  class="h-12 w-12 text-zinc-300"
                  path="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <p class="text-xl font-black text-zinc-100">
                  {{ $t("game.pausedTitle") }}
                </p>
                <button
                  @click="timer.togglePause()"
                  class="border-2 border-emerald-500 bg-emerald-600 px-10 py-4 text-base font-black text-white transition-all hover:bg-emerald-700 active:scale-95"
                >
                  {{ $t("game.resume") }}
                </button>
              </div>
            </div>
          </div>

          <!-- Right / hint panel — on mobile only takes space once a hint is active -->
          <div
            :class="activeComplexHint ? 'block' : 'hidden lg:block'"
            class="text-sm font-medium 3xl:col-span-1 3xl:min-w-0 lg:sticky lg:top-3 lg:max-3xl:col-span-5"
          >
            <SideExplanationPanel
              :active-complex-hint="activeComplexHint"
              :current-step-index="currentStepIndex"
              :current-step="currentStep"
              @next-step="handleNextStep"
              @prev-step="prevHintStep"
              @cancel="cancelComplexHint"
            />
          </div>
        </div>
      </Transition>

      <div
        v-if="practiceLoading"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-sm"
        role="status"
      >
        <span
          class="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-transparent"
        />
        <p class="text-sm font-semibold text-zinc-100">{{ $t("practice.generating") }}</p>
      </div>

      <AchievementToast
        :ids="toastIds"
        @dismiss="(id) => (toastIds = toastIds.filter((x) => x !== id))"
      />

      <!-- MODAL -->
      <div
        v-if="showModal"
        :class="isWinState ? 'modal-delay' : ''"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      >
        <div
          class="modal-pop w-full max-w-sm border bg-white p-6 text-center shadow-2xl dark:bg-zinc-900"
          :class="
            isWinState
              ? 'border-t-4 border-emerald-500/60 border-t-emerald-500'
              : 'border-t-4 border-rose-500/40 border-t-rose-500'
          "
        >
          <h3 class="mb-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {{ modalTitle }}
          </h3>
          <p class="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {{ modalMessage }}
          </p>

          <!-- Star rating -->
          <div
            v-if="isWinState"
            class="mb-4 flex justify-center gap-1.5"
            role="img"
            :aria-label="$t('modal.stars', { n: starsFor(mistakes, hintsUsed) })"
          >
            <span
              v-for="n in 3"
              :key="n"
              :style="{ animationDelay: `${n * 120}ms` }"
              :class="
                n <= starsFor(mistakes, hintsUsed)
                  ? 'star-pop text-amber-400'
                  : 'text-zinc-300 dark:text-zinc-700'
              "
              class="text-3xl leading-none"
              aria-hidden="true"
              >★</span
            >
          </div>

          <p
            v-if="isWinState && reachedLevel"
            class="score-badge mb-4 border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-700 dark:text-violet-300"
          >
            ▲ {{ $t("level.up", { n: reachedLevel }) }}
          </p>

          <!-- Score headline -->
          <div v-if="isWinState && lastScore" class="mb-5">
            <p class="text-[11px] font-semibold text-zinc-500">
              {{ $t("modal.scoreTotal") }}
            </p>
            <p
              class="text-5xl leading-tight font-black text-zinc-900 tabular-nums dark:text-zinc-50"
            >
              {{ displayedScore }}
            </p>
            <p
              v-if="isNewBest"
              class="score-badge mt-1 inline-block border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300"
            >
              ★ {{ $t("modal.scoreNewBest") }}
            </p>

            <!-- breakdown -->
            <div
              class="mt-3 divide-y divide-zinc-200 border border-zinc-200 text-left text-xs dark:divide-zinc-800 dark:border-zinc-800"
            >
              <div class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreBase") }}</span>
                <span class="font-bold text-zinc-800 tabular-nums dark:text-zinc-200">{{
                  lastScore.base
                }}</span>
              </div>
              <div v-if="lastScore.speedBonus" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreSpeed") }}</span>
                <span class="font-bold text-emerald-600 tabular-nums dark:text-emerald-400"
                  >+{{ lastScore.speedBonus }}</span
                >
              </div>
              <div v-if="lastScore.flawlessBonus" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreFlawless") }}</span>
                <span class="font-bold text-emerald-600 tabular-nums dark:text-emerald-400"
                  >+{{ lastScore.flawlessBonus }}</span
                >
              </div>
              <div v-if="lastScore.mistakePenalty" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreMistakePenalty") }}</span>
                <span class="font-bold text-rose-600 tabular-nums dark:text-rose-400"
                  >−{{ lastScore.mistakePenalty }}</span
                >
              </div>
              <div v-if="lastScore.hintPenalty" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreHintPenalty") }}</span>
                <span class="font-bold text-amber-700 tabular-nums dark:text-amber-400"
                  >−{{ lastScore.hintPenalty }}</span
                >
              </div>
              <div class="flex justify-between bg-zinc-500/5 px-3 py-1.5">
                <span class="font-semibold text-zinc-500">{{ $t("modal.scoreLifetime") }}</span>
                <span class="font-bold text-zinc-700 tabular-nums dark:text-zinc-300">{{
                  lifetimeTotal
                }}</span>
              </div>
            </div>
          </div>

          <!-- Win summary -->
          <div
            v-if="isWinState"
            class="mb-5 divide-y divide-zinc-200 border border-zinc-200 text-left dark:divide-zinc-800 dark:border-zinc-800"
          >
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold text-zinc-500">{{ $t("modal.difficulty") }}</span>
              <span class="text-xs font-bold text-zinc-800 capitalize dark:text-zinc-200">{{
                activeDifficulty
              }}</span>
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold text-zinc-500">{{ $t("game.mistakes") }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  mistakes === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
                >{{ mistakes }}{{ mistakeLimit ? ` / ${mistakeLimit}` : "" }}</span
              >
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold text-zinc-500">{{ $t("modal.hintsUsed") }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  hintsUsed === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                "
                >{{ hintsUsed }}</span
              >
            </div>
            <div v-if="techniqueLog.length" class="px-3 py-2">
              <p class="mb-2 text-xs font-semibold text-zinc-500">
                {{ $t("modal.techniquesUsed") }}
              </p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="name in techniqueLog"
                  :key="name"
                  :title="$t('modal.usedTotal', { n: techStatsTotals[name] ?? 1 })"
                  class="border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                  >{{ name }}
                  <span class="opacity-70">×{{ techStatsTotals[name] ?? 1 }}</span></span
                >
              </div>
            </div>
          </div>

          <button
            @click="handleModalClose"
            class="w-full border border-zinc-300 bg-zinc-100 py-3 text-sm font-bold text-zinc-900 transition-all hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {{ $t("modal.close") }}
          </button>
        </div>
      </div>

      <!-- RESUME PROMPT -->
      <div
        v-if="pendingResume"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      >
        <div
          class="modal-pop w-full max-w-sm border border-t-4 border-t-violet-500 bg-white p-6 text-center shadow-2xl dark:bg-zinc-900"
        >
          <h3 class="mb-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {{ $t("resume.title") }}
          </h3>
          <p class="mb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {{
              $t("resume.message", {
                difficulty: $t(`difficulty.${pendingResume.level}`),
                time: timer.formatTime(pendingResume.save.timerSeconds),
              })
            }}
          </p>
          <div class="flex flex-col gap-2">
            <button
              @click="handleResumeConfirm"
              class="w-full border border-emerald-300 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 transition-all hover:border-emerald-400 hover:bg-emerald-100 active:scale-95 dark:border-emerald-600/60 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/60"
            >
              {{ $t("resume.continue") }}
            </button>
            <button
              @click="handleResumeDecline"
              class="w-full border border-zinc-300 bg-zinc-50 py-3 text-sm font-bold transition-all hover:border-zinc-400 hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {{ $t("resume.newGame") }}
            </button>
            <button
              @click="pendingResume = null"
              class="w-full py-2 text-xs font-bold text-zinc-500 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              {{ $t("resume.cancel") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </UApp>
</template>

<style scoped>
@keyframes trigger-glow {
  0%,
  100% {
    background-color: rgba(99, 102, 241, 0.25);
    box-shadow: inset 0 0 10px rgba(99, 102, 241, 0.4);
  }
  50% {
    background-color: rgba(99, 102, 241, 0.5);
    box-shadow: inset 0 0 18px rgba(99, 102, 241, 0.8);
  }
}
@keyframes elimination-blink {
  0%,
  100% {
    background-color: rgba(244, 63, 94, 0.2);
    box-shadow: inset 0 0 8px rgba(244, 63, 94, 0.3);
  }
  50% {
    background-color: rgba(244, 63, 94, 0.55);
    box-shadow: inset 0 0 16px rgba(244, 63, 94, 0.7);
  }
}
:deep(.bg-indigo-500\/30) {
  animation: trigger-glow 1.2s infinite ease-in-out !important;
}
:deep(.bg-rose-500\/30) {
  animation: elimination-blink 1.2s infinite ease-in-out !important;
}
</style>

<!-- Non-scoped: the .dark ancestor lives on <html>, outside this component's scope. -->
<style>
/* The one loud thing: a highlighter stroke under the wordmark. */
.wordmark::after {
  content: "";
  position: absolute;
  z-index: -1;
  left: -0.12em;
  right: -0.12em;
  bottom: 0.04em;
  height: 0.36em;
  background: rgba(252, 211, 77, 0.75);
  transform: skewX(-8deg) rotate(-0.8deg);
  transform-origin: left center;
  animation: swipe 0.7s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.dark .wordmark::after {
  background: rgba(251, 191, 36, 0.38);
}
@keyframes swipe {
  from {
    transform: skewX(-8deg) rotate(-0.8deg) scaleX(0);
  }
  to {
    transform: skewX(-8deg) rotate(-0.8deg) scaleX(1);
  }
}

/* Screen changes: a short fade with a small settle, not a slide. */
.screen-enter-active,
.screen-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.screen-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.screen-leave-to {
  opacity: 0;
}

/* The result appears after the win wave has swept the board. */
@keyframes modal-delay {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.modal-delay {
  animation: modal-delay 0.3s 0.9s ease-out both;
}

/* Honour the OS "reduce motion" setting: keep the state changes, drop the movement. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0s !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@keyframes star-pop {
  0% {
    transform: scale(0) rotate(-30deg);
    opacity: 0;
  }
  70% {
    transform: scale(1.3) rotate(8deg);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}
.star-pop {
  animation: star-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes modal-pop {
  0% {
    transform: scale(0.85) translateY(8px);
    opacity: 0;
  }
  60% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
.modal-pop {
  animation: modal-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes score-badge {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  70% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.score-badge {
  animation: score-badge 0.4s 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
</style>
