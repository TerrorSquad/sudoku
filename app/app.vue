<script setup lang="ts">
import * as uiLocales from "@nuxt/ui/locale";
import confetti from "canvas-confetti";
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

import type { CellCoord, Difficulty } from "./types/sudoku";

import ControlPanel from "./components/ControlPanel.vue";
import CustomImport from "./components/CustomImport.vue";
import DifficultySelector from "./components/DifficultySelector.vue";
import GameDashboard from "./components/GameDashboard.vue";
import LocaleSwitcher from "./components/LocaleSwitcher.vue";
import Numpad from "./components/Numpad.vue";
import SideExplanationPanel from "./components/SideExplanationPanel.vue";
import StatsScreen from "./components/StatsScreen.vue";
import SudokuAcademy from "./components/SudokuAcademy.vue";
import SudokuGrid from "./components/SudokuGrid.vue";
import { useDailyPuzzle } from "./composables/useDailyPuzzle";
import { useGameSave, type GameSave } from "./composables/useGameSave";
import { useScore } from "./composables/useScore";
import { useSudokuEngine } from "./composables/useSudokuEngine";
import { useTechniqueStats } from "./composables/useTechniqueStats";
import { useTimer } from "./composables/useTimer";
import { readJSON, writeJSON } from "./utils/safeJson";
import { computeScore, type ScoreBreakdown } from "./utils/score";
import { playMistake, playPlace, playWin } from "./utils/sound";
import { digitLabel } from "./utils/sudokuColors";

const { t, locale, locales } = useI18n();
const localeMap = uiLocales as Record<string, typeof uiLocales.en>;

useHead(() => ({
  htmlAttrs: { lang: locales.value.find((l) => l.code === locale.value)?.language ?? locale.value },
}));

const COLOR_MODE_KEY = "sudoku_v1_pref_color_mode";
const colorMode = ref<boolean>(readJSON(COLOR_MODE_KEY, false));
watch(colorMode, (v) => writeJSON(COLOR_MODE_KEY, v));

const SOUND_KEY = "sudoku_v1_pref_sound";
const soundEnabled = ref<boolean>(readJSON(SOUND_KEY, true));
watch(soundEnabled, (v) => writeJSON(SOUND_KEY, v));
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
  triggerComplexHint,
  nextHintStep,
  prevHintStep,
  cancelComplexHint,
  checkWinCondition,
  loadCustomBoard,
} = engine;

const gameSave = useGameSave();
const techStats = useTechniqueStats();
const dailyPuzzle = useDailyPuzzle();
const isDailyMode = ref(false);

const notesMode = ref<boolean>(false);
const mistakes = ref<number>(0);
const hintStatus = ref<string>(t("game.ready"));
const hintBody = ref<string>("");
const currentScreen = ref<"menu" | "difficulty" | "game" | "academy" | "custom-import" | "stats">(
  "menu",
);
const activeDifficulty = ref<Difficulty>("medium");

const showModal = ref<boolean>(false);
const modalTitle = ref<string>("");
const modalMessage = ref<string>("");
const isWinState = ref<boolean>(false);

const pendingResume = ref<{ save: GameSave; level: Difficulty } | null>(null);

const hintsUsed = ref<number>(0);
const techniqueLog = ref<string[]>([]);
const mistakeExplainer = ref<string>("");

const flashCells = ref<CellCoord[]>([]);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

const score = useScore();
const lastScore = ref<ScoreBreakdown | null>(null);
const isNewBest = ref<boolean>(false);
const lifetimeTotal = ref<number>(0);
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
const dailyStreak = computed(() => {
  void currentScreen.value;
  return dailyPuzzle.getStreak();
});

// Auto-save on every meaningful state change while a game is active.
// Guard showModal: the watcher fires on the next tick AFTER triggerLocalModal
// clears the save — without this guard the save would be re-created immediately.
watch(
  [currentBoard, notesBoard, mistakes],
  () => {
    if (currentScreen.value !== "game" || showModal.value) return;
    if (!currentBoard.value || !initialBoard.value) return;
    gameSave.save({
      currentBoard: currentBoard.value,
      initialBoard: initialBoard.value,
      solvedBoard: solvedBoard.value,
      notesBoard: notesBoard.value,
      difficulty: activeDifficulty.value,
      timerSeconds: timer.timerSeconds.value,
      mistakes: mistakes.value,
    });
  },
  { deep: true },
);

function triggerLocalModal(title: string, message: string, win: boolean = false) {
  modalTitle.value = title;
  modalMessage.value = message;
  isWinState.value = win;
  showModal.value = true;
  timer.stopTimer();
  gameSave.clearDifficulty(activeDifficulty.value);
  if (win) {
    if (soundEnabled.value) playWin();
    if (isDailyMode.value) dailyPuzzle.markComplete(timer.timerSeconds.value, mistakes.value);
    const breakdown = computeScore({
      difficulty: activeDifficulty.value,
      timeSeconds: timer.timerSeconds.value,
      mistakes: mistakes.value,
      hintsUsed: hintsUsed.value,
    });
    const result = score.record(activeDifficulty.value, breakdown.total, timer.timerSeconds.value);
    lastScore.value = breakdown;
    isNewBest.value = result.isNewBest;
    lifetimeTotal.value = result.stats.total;
    animateScoreCountUp(breakdown.total);
    confetti({
      particleCount: 160,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#f59e0b", "#34d399"],
    });
  } else {
    lastScore.value = null;
  }
}

function handleModalClose() {
  showModal.value = false;
  isDailyMode.value = false;
  currentScreen.value = "menu";
  timer.resetTimer();
}

function resumeSavedGame(s: GameSave) {
  restoreGame(s);
  activeDifficulty.value = s.difficulty;
  mistakes.value = s.mistakes;
  hintStatus.value = t("game.ready");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  timer.resetTimer();
  timer.timerSeconds.value = s.timerSeconds;
  timer.startTimer();
  currentScreen.value = "game";
}

function handleStartGame(level: Difficulty) {
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

function handleSelectCell(coord: CellCoord) {
  selectedCell.value = coord;
}

// A correct placement may finish a row, column, and/or box — flash every
// cell of each newly-completed unit. "Complete" means every cell already
// matches the solution, not just non-empty (a wrong-but-unconflicting digit
// can sit in a cell without being flagged, so equality is the real check).
function flashCompletedUnits(r: number, c: number) {
  const cells: CellCoord[] = [];

  if ([...Array(9).keys()].every((i) => currentBoard.value[r]![i] === solvedBoard.value[r]![i])) {
    for (let i = 0; i < 9; i++) cells.push({ r, c: i });
  }
  if ([...Array(9).keys()].every((i) => currentBoard.value[i]![c] === solvedBoard.value[i]![c])) {
    for (let i = 0; i < 9; i++) cells.push({ r: i, c });
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
      for (let j = 0; j < 3; j++) cells.push({ r: boxR + i, c: boxC + j });
    }
  }

  if (!cells.length) return;
  if (flashTimeout) clearTimeout(flashTimeout);
  flashCells.value = cells;
  flashTimeout = setTimeout(() => {
    flashCells.value = [];
  }, 600);
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
        if (soundEnabled.value) playMistake();
        mistakes.value++;
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
          mistakeExplainer.value = t("game.whyWrong", { num: digitLabel(num, colorMode.value, t) });
        }
        if (mistakes.value >= 3) {
          triggerLocalModal(t("modal.gameOver"), t("modal.gameOverMsg"));
        }
      } else {
        if (soundEnabled.value) playPlace();
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
    if (wasPlacement && soundEnabled.value) playPlace();
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
  if (wasPlacement && soundEnabled.value) playPlace();
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

function handleLoadCustomPuzzle(board: import("./types/sudoku").Grid) {
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

function exitToMenu() {
  timer.stopTimer();
  cancelComplexHint();
  currentScreen.value = "menu";
}

function handleKeyDown(e: KeyboardEvent) {
  if (currentScreen.value !== "game" || timer.isPaused.value) return;
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
      class="app-shell flex min-h-screen w-full flex-col bg-white text-zinc-900 antialiased dark:bg-[#0c0a09] dark:text-zinc-100"
    >
      <!-- Theme + locale switcher — hidden during gameplay so it doesn't float over the dashboard -->
      <div
        v-if="currentScreen !== 'game'"
        class="absolute top-3 right-3 z-40 flex items-center gap-2"
      >
        <LocaleSwitcher />
        <UColorModeButton />
      </div>

      <!-- MENU -->
      <div
        v-if="currentScreen === 'menu'"
        class="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12"
      >
        <div class="text-center">
          <h1
            class="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl"
          >
            {{ $t("menu.title") }}
          </h1>
          <p class="mt-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
            {{ $t("menu.subtitle") }}
          </p>
        </div>
        <div class="flex w-full max-w-xs flex-col items-center gap-3">
          <!-- New game -->
          <button
            @click="currentScreen = 'difficulty'"
            class="w-full border border-zinc-300 bg-zinc-50 px-6 py-4 text-sm font-bold transition-all hover:border-zinc-400 hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {{ $t("menu.start") }}
          </button>

          <!-- Daily challenge -->
          <button
            @click="handleStartDaily"
            :disabled="!!dailyRecord"
            :class="
              dailyRecord
                ? 'cursor-default border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-600'
                : 'border-zinc-300 bg-zinc-50 text-zinc-900 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'
            "
            class="flex w-full items-center justify-center gap-2 border px-6 py-4 text-sm font-bold transition-all active:scale-95"
          >
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span v-if="dailyRecord">{{ $t("menu.dailyCompleted") }}</span>
            <span v-else>{{ $t("menu.dailyChallenge") }}</span>
          </button>
          <p
            v-if="dailyStreak > 0"
            class="-mt-1 text-center text-[11px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400"
          >
            🔥 {{ $t("menu.dailyStreak", { n: dailyStreak }) }}
          </p>

          <!-- Custom puzzle -->
          <button
            @click="currentScreen = 'custom-import'"
            class="flex w-full items-center justify-center gap-2 border border-zinc-300 bg-transparent px-6 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase transition-all hover:border-zinc-400 hover:text-zinc-700 active:scale-95 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {{ $t("menu.customPuzzle") }}
          </button>

          <!-- Academy -->
          <button
            @click="currentScreen = 'academy'"
            class="flex w-full items-center justify-center gap-2 border border-zinc-300 bg-transparent px-6 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase transition-all hover:border-zinc-400 hover:text-zinc-700 active:scale-95 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            {{ $t("menu.academy") }}
          </button>

          <!-- Statistics -->
          <button
            @click="currentScreen = 'stats'"
            class="flex w-full items-center justify-center gap-2 border border-zinc-300 bg-transparent px-6 py-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase transition-all hover:border-zinc-400 hover:text-zinc-700 active:scale-95 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {{ $t("menu.stats") }}
          </button>
        </div>
      </div>

      <!-- DIFFICULTY -->
      <DifficultySelector
        v-else-if="currentScreen === 'difficulty'"
        :active-difficulty="activeDifficulty"
        v-model:color-mode="colorMode"
        v-model:sound-enabled="soundEnabled"
        @select-difficulty="handleChooseDifficulty"
        @back-to-menu="currentScreen = 'menu'"
      />

      <!-- ACADEMY -->
      <SudokuAcademy
        v-else-if="currentScreen === 'academy'"
        @back-to-menu="currentScreen = 'menu'"
      />

      <!-- STATISTICS -->
      <StatsScreen v-else-if="currentScreen === 'stats'" @back-to-menu="currentScreen = 'menu'" />

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
            <p class="mb-4 text-xs font-bold tracking-widest text-zinc-600 uppercase">
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
            <p class="mb-4 text-xs font-bold tracking-widest text-zinc-600 uppercase">
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
                <span class="h-4 w-4 shrink-0 border border-violet-400 bg-violet-950/60" />
                {{ $t("sidebar.legendSelected") }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Center / main game column -->
        <div class="flex w-full flex-col gap-3 3xl:col-span-1 lg:max-3xl:col-span-7">
          <div class="flex flex-col">
            <GameDashboard
              :formatted-time="timer.formatTime(timer.timerSeconds.value)"
              :is-paused="timer.isPaused.value"
              :mistakes="mistakes"
              :max-mistakes="3"
              :difficulty="activeDifficulty"
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
              @select-cell="handleSelectCell"
            />
          </div>
          <div class="mx-2 flex flex-col gap-2 sm:mx-0">
            <ControlPanel
              :notes-mode="notesMode"
              @undo="undoMove"
              @erase="eraseCell(selectedCell)"
              @toggle-notes="notesMode = !notesMode"
              @trigger-hint="handleTriggerHint"
              @auto-notes="handleAutoFillNotes"
            />

            <Numpad
              :counts="numberCounts"
              :color-mode="colorMode"
              @input-number="handleInputNumber"
            />
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

      <!-- MODAL -->
      <div
        v-if="showModal"
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
          <h3
            class="mb-2 text-xl font-black tracking-tight text-zinc-900 uppercase dark:text-zinc-100"
          >
            {{ modalTitle }}
          </h3>
          <p class="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {{ modalMessage }}
          </p>

          <!-- Score headline -->
          <div v-if="isWinState && lastScore" class="mb-5">
            <p class="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
              {{ $t("modal.scoreTotal") }}
            </p>
            <p
              class="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-5xl leading-tight font-black text-transparent tabular-nums"
            >
              {{ displayedScore }}
            </p>
            <p
              v-if="isNewBest"
              class="score-badge mt-1 inline-block border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black tracking-widest text-amber-700 uppercase dark:text-amber-300"
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
                <span class="font-semibold tracking-wider text-zinc-500 uppercase">{{
                  $t("modal.scoreLifetime")
                }}</span>
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
              <span class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{{
                $t("modal.difficulty")
              }}</span>
              <span class="text-xs font-bold text-zinc-800 capitalize dark:text-zinc-200">{{
                activeDifficulty
              }}</span>
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{{
                $t("game.mistakes")
              }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  mistakes === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
                >{{ mistakes }} / 3</span
              >
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{{
                $t("modal.hintsUsed")
              }}</span>
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
              <p class="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
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
            class="w-full border border-zinc-300 bg-zinc-100 py-3 text-sm font-bold text-zinc-900 uppercase transition-all hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
          <h3
            class="mb-2 text-xl font-black tracking-tight text-zinc-900 uppercase dark:text-zinc-100"
          >
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
              class="w-full border border-emerald-300 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 uppercase transition-all hover:border-emerald-400 hover:bg-emerald-100 active:scale-95 dark:border-emerald-600/60 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/60"
            >
              {{ $t("resume.continue") }}
            </button>
            <button
              @click="handleResumeDecline"
              class="w-full border border-zinc-300 bg-zinc-50 py-3 text-sm font-bold uppercase transition-all hover:border-zinc-400 hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {{ $t("resume.newGame") }}
            </button>
            <button
              @click="pendingResume = null"
              class="w-full py-2 text-xs font-bold tracking-wider text-zinc-500 uppercase transition-colors hover:text-rose-600 dark:hover:text-rose-400"
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

<!-- Non-scoped: the .dark ancestor lives on <html>, outside this component's
     scope, so the dark backdrop needs a global rule. Only the gradient is set
     here (background-image), leaving the base color to the Tailwind utilities. -->
<style>
.app-shell {
  background-image: radial-gradient(
    1100px 560px at 50% -12%,
    rgba(139, 92, 246, 0.06),
    transparent 60%
  );
}
.dark .app-shell {
  background-image:
    radial-gradient(1100px 600px at 50% -14%, rgba(139, 92, 246, 0.14), transparent 56%),
    radial-gradient(900px 520px at 88% 6%, rgba(34, 211, 238, 0.07), transparent 60%);
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
