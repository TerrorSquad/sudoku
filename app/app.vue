<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useSudokuEngine } from "./composables/useSudokuEngine";
import { useTimer } from "./composables/useTimer";

import GameDashboard from "./components/GameDashboard.vue";
import DifficultySelector from "./components/DifficultySelector.vue";
import SudokuGrid from "./components/SudokuGrid.vue";
import ControlPanel from "./components/ControlPanel.vue";
import Numpad from "./components/Numpad.vue";
import SideExplanationPanel from "./components/SideExplanationPanel.vue";
import SudokuAcademy from "./components/SudokuAcademy.vue";
import StatsScreen from "./components/StatsScreen.vue";
import CustomImport from "./components/CustomImport.vue";
import LocaleSwitcher from "./components/LocaleSwitcher.vue";

import type { CellCoord, Difficulty } from "./types/sudoku";
import confetti from "canvas-confetti";
import { useGameSave } from "./composables/useGameSave";
import { useTechniqueStats } from "./composables/useTechniqueStats";
import { useDailyPuzzle } from "./composables/useDailyPuzzle";
import { useScore } from "./composables/useScore";
import { computeScore, type ScoreBreakdown } from "./utils/score";
import * as uiLocales from "@nuxt/ui/locale";

const { t, locale, locales } = useI18n();
const localeMap = uiLocales as Record<string, typeof uiLocales.en>;

useHead(() => ({
  htmlAttrs: { lang: locales.value.find((l) => l.code === locale.value)?.language ?? locale.value },
}));

const engine = useSudokuEngine();
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
  getGridCandidates,
  loadCustomBoard,
} = engine;

const gameSave = useGameSave();
const techStats = useTechniqueStats();
const dailyPuzzle = useDailyPuzzle();
const isDailyMode = ref(false);

const notesMode = ref<boolean>(false);
const showAllCandidates = ref<boolean>(false);
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

const hintsUsed = ref<number>(0);
const techniqueLog = ref<string[]>([]);
const mistakeExplainer = ref<string>("");

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

const savedInfo = computed(() => {
  if (!gameSave.hasSave.value) return null;
  const s = gameSave.loadMostRecent();
  if (!s) return null;
  return { difficulty: s.difficulty, time: timer.formatTime(s.timerSeconds) };
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

function handleContinueGame() {
  const s = gameSave.loadMostRecent();
  if (!s) return;
  restoreGame(s);
  activeDifficulty.value = s.difficulty;
  mistakes.value = s.mistakes;
  hintStatus.value = t("game.ready");
  hintBody.value = "";
  mistakeExplainer.value = "";
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
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  startNewGame(level);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = "game";
}

function handleSelectCell(coord: CellCoord) {
  selectedCell.value = coord;
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
          mistakeExplainer.value = t("game.whyConflict", { num, r: first.r + 1, c: first.c + 1 });
        } else {
          hintStatus.value = t("game.wrongDigit");
          mistakeExplainer.value = t("game.whyWrong", { num });
        }
        if (mistakes.value >= 3) {
          triggerLocalModal(t("modal.gameOver"), t("modal.gameOverMsg"));
        }
      } else {
        mistakeExplainer.value = "";
        clearRelationalNotes(r, c, num);
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

onMounted(() => window.addEventListener("keydown", handleKeyDown));
onUnmounted(() => window.removeEventListener("keydown", handleKeyDown));
</script>

<template>
  <UApp :locale="localeMap[locale] ?? uiLocales.en">
    <div
      class="app-shell min-h-screen w-full antialiased flex flex-col dark:text-zinc-100 dark:bg-[#0c0a09] text-zinc-900 bg-white"
    >
      <!-- Theme + locale switcher - temporarily disabled -->
      <!-- <div class="absolute top-3 right-3 z-40 flex items-center gap-2">
      <LocaleSwitcher />
      <UColorModeButton />
    </div> -->

      <!-- MENU -->
      <div
        v-if="currentScreen === 'menu'"
        class="flex flex-col justify-center items-center flex-1 px-6 py-12 gap-10"
      >
        <div class="text-center">
          <h1
            class="text-5xl sm:text-6xl font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent tracking-tight"
          >
            {{ $t("menu.title") }}
          </h1>
          <p class="text-[11px] text-zinc-500 mt-3 uppercase tracking-widest font-semibold">
            {{ $t("menu.subtitle") }}
          </p>
        </div>
        <div class="flex flex-col items-center gap-3 w-full max-w-xs">
          <!-- Continue saved game -->
          <div v-if="gameSave.hasSave.value" class="w-full">
            <button
              @click="handleContinueGame"
              class="w-full py-4 px-6 border font-bold text-sm transition-all active:scale-95 dark:bg-emerald-900/40 dark:border-emerald-600/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 dark:hover:border-emerald-500 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400"
            >
              {{ $t("menu.continue") }}
            </button>
            <p
              v-if="savedInfo"
              class="text-[11px] text-zinc-500 text-center mt-1.5 uppercase tracking-wider font-semibold"
            >
              {{
                $t("menu.continueSub", { difficulty: savedInfo.difficulty, time: savedInfo.time })
              }}
            </p>
          </div>

          <!-- New game -->
          <button
            @click="currentScreen = 'difficulty'"
            class="w-full py-4 px-6 border font-bold text-sm transition-all active:scale-95 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 bg-zinc-50 border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400"
          >
            {{ $t("menu.start") }}
          </button>

          <!-- Daily challenge -->
          <button
            @click="handleStartDaily"
            :disabled="!!dailyRecord"
            :class="
              dailyRecord
                ? 'dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-600 bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                : 'dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 dark:text-zinc-100 bg-zinc-50 border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400 text-zinc-900'
            "
            class="w-full py-4 px-6 border font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            class="text-[11px] text-amber-600 dark:text-amber-400 text-center -mt-1 uppercase tracking-wider font-semibold"
          >
            🔥 {{ $t("menu.dailyStreak", { n: dailyStreak }) }}
          </p>

          <!-- Custom puzzle -->
          <button
            @click="currentScreen = 'custom-import'"
            class="w-full py-3 px-6 bg-transparent border font-semibold text-xs text-zinc-500 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 dark:border-zinc-800 dark:hover:text-zinc-300 dark:hover:border-zinc-700 border-zinc-300 hover:text-zinc-700 hover:border-zinc-400"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            class="w-full py-3 px-6 bg-transparent border font-semibold text-xs text-zinc-500 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 dark:border-zinc-800 dark:hover:text-zinc-300 dark:hover:border-zinc-700 border-zinc-300 hover:text-zinc-700 hover:border-zinc-400"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            class="w-full py-3 px-6 bg-transparent border font-semibold text-xs text-zinc-500 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 dark:border-zinc-800 dark:hover:text-zinc-300 dark:hover:border-zinc-700 border-zinc-300 hover:text-zinc-700 hover:border-zinc-400"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        @select-difficulty="handleStartGame"
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
        class="flex flex-col lg:grid lg:max-3xl:grid-cols-12 3xl:grid-cols-[240px_minmax(0,1fr)_420px] gap-4 lg:gap-6 3xl:gap-6 w-full max-w-7xl 3xl:max-w-[1900px] sm:px-5 3xl:px-8 sm:py-3"
      >
        <!-- 3xl left sidebar: shortcuts & branding -->
        <div class="hidden 3xl:flex flex-col gap-6 sticky top-3 3xl:col-span-1">
          <div>
            <p class="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">
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
                  class="font-game text-xs font-bold px-2 py-1 border shrink-0 min-w-[60px] text-center dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 bg-zinc-100 border-zinc-300 text-zinc-700"
                  >{{ s.key }}</kbd
                >
                <span class="text-sm dark:text-zinc-400 text-zinc-600">{{ s.desc }}</span>
              </li>
            </ul>
          </div>

          <div class="border-t pt-4 dark:border-zinc-800 border-zinc-200">
            <p class="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">
              {{ $t("sidebar.legend") }}
            </p>
            <ul class="space-y-3 text-sm dark:text-zinc-400 text-zinc-600">
              <li class="flex items-center gap-3">
                <span
                  class="w-4 h-4 shrink-0 border dark:bg-zinc-100 dark:border-zinc-600 bg-zinc-900 border-zinc-400"
                />
                {{ $t("sidebar.legendGiven") }}
              </li>
              <li class="flex items-center gap-3">
                <span
                  class="w-4 h-4 shrink-0 border dark:bg-violet-300/30 dark:border-violet-400 bg-violet-600/30 border-violet-500"
                />
                {{ $t("sidebar.legendEntry") }}
              </li>
              <li class="flex items-center gap-3">
                <span class="w-4 h-4 shrink-0 bg-rose-500/20 border border-rose-400" />
                {{ $t("sidebar.legendConflict") }}
              </li>
              <li class="flex items-center gap-3">
                <span class="w-4 h-4 shrink-0 bg-violet-950/60 border border-violet-400" />
                {{ $t("sidebar.legendSelected") }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Center / main game column -->
        <div class="lg:max-3xl:col-span-7 3xl:col-span-1 flex flex-col gap-3 w-full">
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
              class="flex items-start justify-between gap-2 border px-3 py-2 text-xs leading-relaxed bg-rose-500/10 border-rose-500/30 dark:text-rose-300 text-rose-700"
            >
              <p>{{ mistakeExplainer }}</p>
              <button
                @click="mistakeExplainer = ''"
                :aria-label="$t('modal.close')"
                class="shrink-0 font-bold px-1 transition-colors dark:hover:text-rose-100 hover:text-rose-900"
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
              :show-all-candidates="showAllCandidates"
              :dynamic-candidates="currentBoard ? getGridCandidates(currentBoard) : []"
              @select-cell="handleSelectCell"
            />
          </div>
          <div class="flex flex-col gap-2 mx-2 sm:mx-0">
            <ControlPanel
              :notes-mode="notesMode"
              @undo="undoMove"
              @erase="eraseCell(selectedCell)"
              @toggle-notes="notesMode = !notesMode"
              @trigger-hint="handleTriggerHint"
              @auto-notes="handleAutoFillNotes"
            />

            <Numpad :counts="numberCounts" @input-number="handleInputNumber" />
          </div>
        </div>

        <!-- Right / hint panel — on mobile only takes space once a hint is active -->
        <div
          :class="activeComplexHint ? 'block' : 'hidden lg:block'"
          class="lg:max-3xl:col-span-5 3xl:col-span-1 lg:sticky lg:top-3 text-sm font-medium 3xl:min-w-0"
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
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      >
        <div
          class="modal-pop border w-full max-w-sm p-6 shadow-2xl text-center dark:bg-zinc-900 bg-white"
          :class="
            isWinState
              ? 'border-emerald-500/60 border-t-4 border-t-emerald-500'
              : 'border-rose-500/40 border-t-4 border-t-rose-500'
          "
        >
          <h3
            class="text-xl font-black mb-2 uppercase tracking-tight dark:text-zinc-100 text-zinc-900"
          >
            {{ modalTitle }}
          </h3>
          <p class="text-sm mb-4 leading-relaxed dark:text-zinc-400 text-zinc-600">
            {{ modalMessage }}
          </p>

          <!-- Score headline -->
          <div v-if="isWinState && lastScore" class="mb-5">
            <p class="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
              {{ $t("modal.scoreTotal") }}
            </p>
            <p
              class="text-5xl font-black tabular-nums bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent leading-tight"
            >
              {{ displayedScore }}
            </p>
            <p
              v-if="isNewBest"
              class="score-badge inline-block mt-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 dark:text-amber-300 text-amber-700"
            >
              ★ {{ $t("modal.scoreNewBest") }}
            </p>

            <!-- breakdown -->
            <div
              class="mt-3 text-left border dark:border-zinc-800 dark:divide-zinc-800 border-zinc-200 divide-zinc-200 divide-y text-xs"
            >
              <div class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreBase") }}</span>
                <span class="font-bold tabular-nums dark:text-zinc-200 text-zinc-800">{{
                  lastScore.base
                }}</span>
              </div>
              <div v-if="lastScore.speedBonus" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreSpeed") }}</span>
                <span class="font-bold tabular-nums dark:text-emerald-400 text-emerald-600"
                  >+{{ lastScore.speedBonus }}</span
                >
              </div>
              <div v-if="lastScore.flawlessBonus" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreFlawless") }}</span>
                <span class="font-bold tabular-nums dark:text-emerald-400 text-emerald-600"
                  >+{{ lastScore.flawlessBonus }}</span
                >
              </div>
              <div v-if="lastScore.mistakePenalty" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreMistakePenalty") }}</span>
                <span class="font-bold tabular-nums dark:text-rose-400 text-rose-600"
                  >−{{ lastScore.mistakePenalty }}</span
                >
              </div>
              <div v-if="lastScore.hintPenalty" class="flex justify-between px-3 py-1.5">
                <span class="text-zinc-500">{{ $t("modal.scoreHintPenalty") }}</span>
                <span class="font-bold tabular-nums dark:text-amber-400 text-amber-700"
                  >−{{ lastScore.hintPenalty }}</span
                >
              </div>
              <div class="flex justify-between px-3 py-1.5 bg-zinc-500/5">
                <span class="text-zinc-500 uppercase tracking-wider font-semibold">{{
                  $t("modal.scoreLifetime")
                }}</span>
                <span class="font-bold tabular-nums dark:text-zinc-300 text-zinc-700">{{
                  lifetimeTotal
                }}</span>
              </div>
            </div>
          </div>

          <!-- Win summary -->
          <div
            v-if="isWinState"
            class="mb-5 text-left border dark:border-zinc-800 dark:divide-zinc-800 border-zinc-200 divide-zinc-200 divide-y"
          >
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{{
                $t("modal.difficulty")
              }}</span>
              <span class="text-xs font-bold capitalize dark:text-zinc-200 text-zinc-800">{{
                activeDifficulty
              }}</span>
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{{
                $t("game.mistakes")
              }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  mistakes === 0
                    ? 'dark:text-emerald-400 text-emerald-600'
                    : 'dark:text-rose-400 text-rose-600'
                "
                >{{ mistakes }} / 3</span
              >
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{{
                $t("modal.hintsUsed")
              }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  hintsUsed === 0
                    ? 'dark:text-emerald-400 text-emerald-600'
                    : 'dark:text-amber-400 text-amber-700'
                "
                >{{ hintsUsed }}</span
              >
            </div>
            <div v-if="techniqueLog.length" class="px-3 py-2">
              <p class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">
                {{ $t("modal.techniquesUsed") }}
              </p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="name in techniqueLog"
                  :key="name"
                  :title="$t('modal.usedTotal', { n: techStatsTotals[name] ?? 1 })"
                  class="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 dark:text-amber-400 text-amber-700 font-semibold"
                  >{{ name }}
                  <span class="opacity-70">×{{ techStatsTotals[name] ?? 1 }}</span></span
                >
              </div>
            </div>
          </div>

          <button
            @click="handleModalClose"
            class="w-full py-3 text-sm font-bold uppercase transition-all border dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300"
          >
            {{ $t("modal.close") }}
          </button>
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
