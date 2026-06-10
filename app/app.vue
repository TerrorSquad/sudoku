<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useSudokuEngine } from './composables/useSudokuEngine';
import { useTimer } from './composables/useTimer';

import GameDashboard from './components/GameDashboard.vue';
import DifficultySelector from './components/DifficultySelector.vue';
import SudokuGrid from './components/SudokuGrid.vue';
import ControlPanel from './components/ControlPanel.vue';
import Numpad from './components/Numpad.vue';
import SideExplanationPanel from './components/SideExplanationPanel.vue';
import SudokuAcademy from './components/SudokuAcademy.vue';
import CustomImport from './components/CustomImport.vue';

import type { CellCoord, Difficulty } from './types/sudoku';
import confetti from 'canvas-confetti';
import { useGameSave } from './composables/useGameSave';
import { useTechniqueStats } from './composables/useTechniqueStats';
import { useDailyPuzzle } from './composables/useDailyPuzzle';

const { t } = useI18n();

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
const hintStatus = ref<string>(t('game.ready'));
const hintBody = ref<string>('');
const currentScreen = ref<'menu' | 'difficulty' | 'game' | 'academy' | 'custom-import'>('menu');
const activeDifficulty = ref<Difficulty>('medium');

const showModal = ref<boolean>(false);
const modalTitle = ref<string>('');
const modalMessage = ref<string>('');
const isWinState = ref<boolean>(false);

const hintsUsed = ref<number>(0);
const techniqueLog = ref<string[]>([]);

const dailyRecord = computed(() => dailyPuzzle.getRecord());

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
    if (currentScreen.value !== 'game' || showModal.value) return;
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
  { deep: true }
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
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 }, colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#f59e0b', '#34d399'] });
  }
}

function handleModalClose() {
  showModal.value = false;
  isDailyMode.value = false;
  currentScreen.value = 'menu';
  timer.resetTimer();
}

function handleContinueGame() {
  const s = gameSave.loadMostRecent();
  if (!s) return;
  restoreGame(s);
  activeDifficulty.value = s.difficulty;
  mistakes.value = s.mistakes;
  hintStatus.value = t('game.ready');
  hintBody.value = '';
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  timer.resetTimer();
  timer.timerSeconds.value = s.timerSeconds;
  timer.startTimer();
  currentScreen.value = 'game';
}

function handleStartGame(level: Difficulty) {
  gameSave.clearDifficulty(level);
  activeDifficulty.value = level;
  mistakes.value = 0;
  hintStatus.value = t('game.newBoard');
  hintBody.value = '';
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  startNewGame(level);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = 'game';
}

function handleSelectCell(coord: CellCoord) {
  selectedCell.value = coord;
}

function handleInputNumber(num: number) {
  if (timer.isPaused.value || !selectedCell.value) return;
  const { r, c } = selectedCell.value;

  if (initialBoard.value[r]![c] !== 0) return;

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
          const inRow = conflicts.some(cc => cc.r === r);
          const inCol = conflicts.some(cc => cc.c === c);
          const inBox = conflicts.some(cc => cc.r !== r && cc.c !== c);
          const where = inRow ? `row ${r + 1}` : inCol ? `col ${c + 1}` : inBox ? 'this box' : 'another cell';
          hintStatus.value = `Conflicts with ${where}!`;
        } else {
          hintStatus.value = 'Wrong digit here!';
        }
        if (mistakes.value >= 3) {
          triggerLocalModal(t('modal.gameOver'), t('modal.gameOverMsg'));
        }
      } else {
        clearRelationalNotes(r, c, num);
        if (checkWinCondition()) {
          triggerLocalModal(
            t('modal.win'),
            t('modal.winMsg', { difficulty: activeDifficulty.value, time: timer.formatTime(timer.timerSeconds.value) }),
            true
          );
        }
      }
    }
  }
}

function handleNextStep() {
  const title = activeComplexHint.value?.title;
  nextHintStep(() => {
    if (title) {
      if (!techniqueLog.value.includes(title)) techniqueLog.value.push(title);
      techStats.record(title);
    }
    hintsUsed.value++;
    if (checkWinCondition()) {
      triggerLocalModal(
        t('modal.win'),
        t('modal.winHintMsg', { time: timer.formatTime(timer.timerSeconds.value) }),
        true
      );
    } else {
      hintStatus.value = t('game.cellFilled');
      hintBody.value = '';
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
  hintsUsed.value++;
  if (!techniqueLog.value.includes(name)) techniqueLog.value.push(name);
  techStats.record(name);
  engine.applyComplexHint();
  if (checkWinCondition()) {
    triggerLocalModal(t('modal.win'), t('modal.winInstantMsg'), true);
  } else {
    hintStatus.value = t('game.instantApplied');
    hintBody.value = '';
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
  hintStatus.value = t('game.notesFilled');
}

function handleStartDaily() {
  isDailyMode.value = true;
  activeDifficulty.value = 'medium';
  mistakes.value = 0;
  hintStatus.value = t('game.newBoard');
  hintBody.value = '';
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  loadCustomBoard(dailyPuzzle.getBoard());
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = 'game';
}

function handleLoadCustomPuzzle(board: import('./types/sudoku').Grid) {
  activeDifficulty.value = 'custom';
  mistakes.value = 0;
  hintStatus.value = t('game.newBoard');
  hintBody.value = '';
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  loadCustomBoard(board);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = 'game';
}

function exitToMenu() {
  timer.stopTimer();
  cancelComplexHint();
  currentScreen.value = 'menu';
}

function handleKeyDown(e: KeyboardEvent) {
  if (currentScreen.value !== 'game' || timer.isPaused.value) return;
  if (e.key >= '1' && e.key <= '9') {
    handleInputNumber(parseInt(e.key));
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    eraseCell(selectedCell.value);
  } else if (e.key.toLowerCase() === 'n') {
    notesMode.value = !notesMode.value;
  } else if (e.key.toLowerCase() === 'h') {
    handleTriggerHint();
  } else if (e.key.toLowerCase() === 'a') {
    handleAutoFillNotes();
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
</script>

<template>
  <div class="min-h-screen w-full text-zinc-100 antialiased bg-[#0c0a09] flex flex-col">

    <!-- MENU -->
    <div v-if="currentScreen === 'menu'" class="flex flex-col justify-center items-center flex-1 px-6 py-12 gap-10">
      <div class="text-center">
        <h1 class="text-5xl sm:text-6xl font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
          {{ $t('menu.title') }}
        </h1>
        <p class="text-[11px] text-zinc-500 mt-3 uppercase tracking-widest font-semibold">
          {{ $t('menu.subtitle') }}
        </p>
      </div>
      <div class="flex flex-col items-center gap-3 w-full max-w-xs">
        <!-- Continue saved game -->
        <div v-if="gameSave.hasSave.value" class="w-full">
          <button
            @click="handleContinueGame"
            class="w-full py-4 px-6 bg-emerald-900/40 border border-emerald-600/60 font-bold text-sm text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-500 transition-all active:scale-95"
          >
            {{ $t('menu.continue') }}
          </button>
          <p v-if="savedInfo" class="text-[11px] text-zinc-500 text-center mt-1.5 uppercase tracking-wider font-semibold">
            {{ $t('menu.continueSub', { difficulty: savedInfo.difficulty, time: savedInfo.time }) }}
          </p>
        </div>

        <!-- New game -->
        <button
          @click="currentScreen = 'difficulty'"
          class="w-full py-4 px-6 bg-zinc-900 border border-zinc-700 font-bold text-sm hover:bg-zinc-800 hover:border-zinc-600 transition-all active:scale-95"
        >
          {{ $t('menu.start') }}
        </button>

        <!-- Daily challenge -->
        <button
          @click="handleStartDaily"
          :disabled="!!dailyRecord"
          :class="dailyRecord
            ? 'bg-emerald-950/20 border-emerald-800 text-emerald-600 cursor-default'
            : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-100'"
          class="w-full py-4 px-6 border font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span v-if="dailyRecord">Daily — Completed ✓</span>
          <span v-else>Daily Challenge</span>
        </button>

        <!-- Custom puzzle -->
        <button
          @click="currentScreen = 'custom-import'"
          class="w-full py-3 px-6 bg-transparent border border-zinc-800 font-semibold text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Custom Puzzle
        </button>

        <!-- Academy -->
        <button
          @click="currentScreen = 'academy'"
          class="w-full py-3 px-6 bg-transparent border border-zinc-800 font-semibold text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Sudoku Academy
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

    <!-- CUSTOM IMPORT -->
    <CustomImport
      v-else-if="currentScreen === 'custom-import'"
      @load-puzzle="handleLoadCustomPuzzle"
      @back-to-menu="currentScreen = 'menu'"
    />

    <!-- GAME -->
    <div
      v-else-if="currentScreen === 'game'"
      class="flex flex-col lg:grid lg:grid-cols-12 3xl:grid-cols-[240px_minmax(0,1fr)_420px] gap-4 lg:gap-6 3xl:gap-6 w-full max-w-7xl 3xl:max-w-[1900px] mx-auto px-3 sm:px-5 3xl:px-8 py-3 flex-1 items-start"
    >

      <!-- 3xl left sidebar: shortcuts & branding -->
      <div class="hidden 3xl:flex flex-col gap-6 sticky top-3 3xl:col-span-1">
        <div>
          <p class="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Keyboard</p>
          <ul class="space-y-3">
            <li v-for="(s, i) in [
              { key: '1–9', desc: 'Input number' },
              { key: 'Backspace', desc: 'Erase cell' },
              { key: 'N', desc: 'Toggle notes' },
              { key: 'H', desc: 'Get hint' },
              { key: 'A', desc: 'Auto-fill notes' },
            ]" :key="i" class="flex items-center gap-3">
              <kbd class="font-game text-xs font-bold px-2 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 shrink-0 min-w-[60px] text-center">{{ s.key }}</kbd>
              <span class="text-sm text-zinc-400">{{ s.desc }}</span>
            </li>
          </ul>
        </div>

        <div class="border-t border-zinc-800 pt-4">
          <p class="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Legend</p>
          <ul class="space-y-3 text-sm text-zinc-400">
            <li class="flex items-center gap-3"><span class="w-4 h-4 shrink-0 bg-zinc-100 border border-zinc-600" /> Given digit</li>
            <li class="flex items-center gap-3"><span class="w-4 h-4 shrink-0 bg-violet-300/30 border border-violet-400" /> Your entry</li>
            <li class="flex items-center gap-3"><span class="w-4 h-4 shrink-0 bg-rose-500/20 border border-rose-400" /> Conflict</li>
            <li class="flex items-center gap-3"><span class="w-4 h-4 shrink-0 bg-violet-950/60 border border-violet-400" /> Selected</li>
          </ul>
        </div>
      </div>

      <!-- Center / main game column -->
      <div class="lg:col-span-7 3xl:col-span-1 flex flex-col gap-3">
        <div class="flex flex-col gap-3 w-full mx-auto">
          <GameDashboard
            :formatted-time="timer.formatTime(timer.timerSeconds.value)"
            :is-paused="timer.isPaused.value"
            :mistakes="mistakes"
            :max-mistakes="3"
            :hint-status="hintStatus"
            :difficulty="activeDifficulty"
            @toggle-pause="timer.togglePause()"
            @exit-game="exitToMenu"
          />

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

          <div class="flex gap-2 w-full">
            <ControlPanel
              :notes-mode="notesMode"
              @undo="undoMove"
              @erase="eraseCell(selectedCell)"
              @toggle-notes="notesMode = !notesMode"
              @trigger-hint="handleTriggerHint"
              class="flex-grow"
            />
            <button
              @click="handleAutoFillNotes"
              :title="$t('game.autoNotes')"
              class="px-3 sm:px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 text-violet-400 flex items-center gap-1.5"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span class="hidden sm:inline">{{ $t('game.autoNotes') }}</span>
            </button>
          </div>

          <Numpad :counts="numberCounts" @input-number="handleInputNumber" />
        </div>
      </div>

      <!-- Right / hint panel -->
      <div class="lg:col-span-5 3xl:col-span-1 lg:sticky lg:top-3 text-sm font-medium 3xl:min-w-0">
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
    <div v-if="showModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div
        class="bg-zinc-900 border w-full max-w-sm p-6 shadow-2xl text-center"
        :class="isWinState ? 'border-emerald-500/60 border-t-4 border-t-emerald-500' : 'border-rose-500/40 border-t-4 border-t-rose-500'"
      >
        <h3 class="text-xl font-black mb-2 text-zinc-100 uppercase tracking-tight">{{ modalTitle }}</h3>
        <p class="text-sm text-zinc-400 mb-4 leading-relaxed">{{ modalMessage }}</p>

        <!-- Win summary -->
        <div v-if="isWinState" class="mb-5 text-left border border-zinc-800 divide-y divide-zinc-800">
          <div class="flex justify-between px-3 py-2">
            <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Difficulty</span>
            <span class="text-xs font-bold text-zinc-200 capitalize">{{ activeDifficulty }}</span>
          </div>
          <div class="flex justify-between px-3 py-2">
            <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Mistakes</span>
            <span class="text-xs font-bold" :class="mistakes === 0 ? 'text-emerald-400' : 'text-rose-400'">{{ mistakes }} / 3</span>
          </div>
          <div class="flex justify-between px-3 py-2">
            <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Hints used</span>
            <span class="text-xs font-bold" :class="hintsUsed === 0 ? 'text-emerald-400' : 'text-amber-400'">{{ hintsUsed }}</span>
          </div>
          <div v-if="techniqueLog.length" class="px-3 py-2">
            <p class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Techniques used</p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="name in techniqueLog"
                :key="name"
                class="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold"
              >{{ name }}</span>
            </div>
          </div>
        </div>

        <button
          @click="handleModalClose"
          class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-bold uppercase transition-all border border-zinc-700"
        >
          {{ $t('modal.close') }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
@keyframes trigger-glow {
  0%, 100% { background-color: rgba(99,102,241,0.25); box-shadow: inset 0 0 10px rgba(99,102,241,0.4); }
  50%       { background-color: rgba(99,102,241,0.5);  box-shadow: inset 0 0 18px rgba(99,102,241,0.8); }
}
@keyframes elimination-blink {
  0%, 100% { background-color: rgba(244,63,94,0.2);  box-shadow: inset 0 0 8px rgba(244,63,94,0.3); }
  50%       { background-color: rgba(244,63,94,0.55); box-shadow: inset 0 0 16px rgba(244,63,94,0.7); }
}
:deep(.bg-indigo-500\/30) { animation: trigger-glow    1.2s infinite ease-in-out !important; }
:deep(.bg-rose-500\/30)   { animation: elimination-blink 1.2s infinite ease-in-out !important; }
</style>
