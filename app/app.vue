<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSudokuEngine } from './composables/useSudokuEngine';
import { useTimer } from './composables/useTimer';
import { useVisionOCR } from './composables/useVisionOCR';

// Eksplicitni importi komponenti za maksimalnu tipsku bezbjednost i autocomplete
import GameDashboard from './components/GameDashboard.vue';
import DifficultySelector from './components/DifficultySelector.vue';
import SudokuGrid from './components/SudokuGrid.vue';
import ControlPanel from './components/ControlPanel.vue';
import Numpad from './components/Numpad.vue';
import SideExplanationPanel from './components/SideExplanationPanel.vue';

import type { CellCoord, Difficulty } from './types/sudoku';

const engine = useSudokuEngine();
const timer = useTimer();
const ocr = useVisionOCR();

// Destrukturisanje kompletnog reaktivnog stanja i metoda iz useSudokuEngine-a
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
  loadCustomBoard,
  eraseCell,
  clearRelationalNotes,
  saveHistory,
  undoMove,
  triggerComplexHint,
  nextHintStep,
  prevHintStep,
  cancelComplexHint,
  checkWinCondition,
  getGridCandidates
} = engine;

const notesMode = ref<boolean>(false);
const showAllCandidates = ref<boolean>(false);
const mistakes = ref<number>(0);
const hintStatus = ref<string>('Spreman za igru');
const hintBody = ref<string>('');
const currentScreen = ref<'menu' | 'difficulty' | 'game'>('menu');
const activeDifficulty = ref<Difficulty>('srednje');

// Lokalni reaktivni modal (Zamenjuje nedozvoljene browser alert-e unutar iframe-a)
const showModal = ref<boolean>(false);
const modalTitle = ref<string>('');
const modalMessage = ref<string>('');
const isWinState = ref<boolean>(false);

function triggerLocalModal(title: string, message: string, win: boolean = false) {
  modalTitle.value = title;
  modalMessage.value = message;
  isWinState.value = win;
  showModal.value = true;
  timer.stopTimer();
}

function handleModalClose() {
  showModal.value = false;
  currentScreen.value = 'menu';
  timer.resetTimer();
}

// Pokretanje igre iz selektora težine
function handleStartGame(level: Difficulty) {
  activeDifficulty.value = level;
  mistakes.value = 0;
  hintStatus.value = 'Nova tabla učitana!';
  hintBody.value = '';

  startNewGame(level);

  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = 'game';
}

// Bezbjedan handler selekcije ćelije (Izbjegava TypeError dodjele konstanti)
function handleSelectCell(coord: CellCoord) {
  selectedCell.value = coord;
}

// Unos brojeva preko tastature ili numpada
function handleInputNumber(num: number) {
  if (timer.isPaused.value || !selectedCell.value) return;
  const { r, c } = selectedCell.value;

  if (initialBoard.value[r][c] !== 0) return;

  saveHistory();

  if (notesMode.value) {
    if (currentBoard.value[r][c] !== 0) return;
    notesBoard.value[r][c][num] = !notesBoard.value[r][c][num];
  } else {
    if (currentBoard.value[r][c] === num) {
      currentBoard.value[r][c] = 0;
    } else {
      currentBoard.value[r][c] = num;

      // Provera konflikata
      const conflicts = engine.getConflictCells(r, c, num);
      if (num !== solvedBoard.value[r][c] || conflicts.length > 0) {
        mistakes.value++;
        if (mistakes.value >= 3) {
          triggerLocalModal(
            'Kraj Igre 💀',
            'Napravili ste 3 greške. Sistem je blokirao dalji unos. Pokušajte ponovo!'
          );
        }
      } else {
        clearRelationalNotes(r, c, num);
        if (checkWinCondition()) {
          triggerLocalModal(
            'Nevjerovatan Uspjeh! 🏆',
            `Riješili ste Sudoku težine ${activeDifficulty.value.toUpperCase()} u vremenu ${timer.formatTime(timer.timerSeconds.value)}.`,
            true
          );
        }
      }
    }
  }
}

// Sinhronizacija koraka sa desnog panela u App.vue stanju
function handleNextStep() {
  nextHintStep(() => {
    // Callback se okida isključivo na poslednjem koraku ("Upiši Broj")
    if (checkWinCondition()) {
      triggerLocalModal(
        'Nevjerovatan Uspjeh! 🏆',
        `Riješili ste Sudoku uz pomoć CSP analizatora u vremenu ${timer.formatTime(timer.timerSeconds.value)}.`,
        true
      );
    } else {
      hintStatus.value = 'Polje uspješno popunjeno!';
      hintBody.value = '';
    }
  });
}

function handleTriggerHint() {
  // Ako je kompleksni hint već aktivan, dvoklik/ponovni klik vrši instant upis broja
  if (activeComplexHint.value) {
    handleInstantApplyHint();
  } else {
    triggerComplexHint(hintStatus, hintBody);
  }
}

// Instant upis rješenja (Dvoklikom ili ponovnim pritiskom na hint)
function handleInstantApplyHint() {
  if (!activeComplexHint.value) return;

  engine.applyComplexHint();
  if (checkWinCondition()) {
    triggerLocalModal(
      'Nevjerovatan Uspjeh! 🏆',
      `Riješili ste Sudoku uz pomoć CSP analizatora!`,
      true
    );
  } else {
    hintStatus.value = 'Rješenje instant upisano!';
    hintBody.value = '';
  }
}

// Automatski proračun i upis svih kandidata (Auto-Notes Generator)
function handleAutoFillNotes() {
  saveHistory();

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard.value[r][c] === 0) {
        // Resetuj stare ručne bilješke
        notesBoard.value[r][c] = Array(10).fill(false);

        // Pronađi i popuni samo validne kandidate
        for (let val = 1; val <= 9; val++) {
          if (engine.isValid(currentBoard.value, r, c, val)) {
            notesBoard.value[r][c][val] = true;
          }
        }
      }
    }
  }
  hintStatus.value = 'Bilješke automatski popunjene!';
}

// Učitavanje screenshota preko Gemini Vision OCR-a
async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64 = (reader.result as string).split(',')[1];
    const board = await ocr.parseScreenshot(base64);
    if (board) {
      loadCustomBoard(board);
      activeDifficulty.value = 'custom';
      mistakes.value = 0;
      hintStatus.value = 'Screenshot Učitan!';
      hintBody.value = '';
      currentScreen.value = 'game';
      timer.resetTimer();
      timer.startTimer();
    }
  };
  reader.readAsDataURL(file);
}

function exitToMenu() {
  timer.stopTimer();
  cancelComplexHint();
  currentScreen.value = 'menu';
}

// Fizičke tastaturne prečice (WSL/Mint desktop podrška)
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
  <div class="text-zinc-100 h-screen w-screen overflow-hidden flex flex-col justify-between antialiased p-3.5 no-select bg-[#0c0a09]">

    <!-- 1. GLAVNI MENI -->
    <div v-if="currentScreen === 'menu'" class="flex flex-col justify-center items-center h-full w-full max-w-md mx-auto gap-8">
      <div class="text-center">
        <h1 class="text-5xl font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">SUDOKU PRO</h1>
        <p class="text-[10px] text-zinc-400 mt-2 uppercase tracking-widest font-black">Vue 3 / Nuxt Component Architecture</p>
      </div>

      <div class="flex flex-col gap-3.5 w-full">
        <button @click="currentScreen = 'difficulty'" class="p-4 bg-zinc-900 border border-zinc-800 text-left font-bold hover:bg-zinc-800 transition-all rounded-none">
          Pokreni Novu Igru
        </button>

        <label class="p-4 bg-zinc-900 border border-zinc-800 text-left font-bold hover:bg-zinc-800 transition-all cursor-pointer flex justify-between items-center rounded-none">
          <span>Učitaj iz slike (Screenshot)</span>
          <input type="file" accept="image/*" class="hidden" @change="onFileSelected" />
        </label>
      </div>
    </div>

    <!-- 2. SCREEN ZA SELEKCIJU TEŽINE -->
    <DifficultySelector
      v-else-if="currentScreen === 'difficulty'"
      :active-difficulty="activeDifficulty"
      @select-difficulty="handleStartGame"
      @back-to-menu="currentScreen = 'menu'"
    />

    <!-- 3. AKTIVNI PANEL ZA IGRU (DESKTOP REDESIGN - 12 KOLONA) -->
    <div v-else-if="currentScreen === 'game'" class="w-full max-w-6xl mx-auto grid grid-cols-12 gap-6 items-start py-2">

      <!-- LEVA STRANA: SUDOKU KONZOLA (7 kolona) -->
      <div class="col-span-7 flex flex-col gap-y-3">
        <GameDashboard
          :formatted-time="timer.formatTime(timer.timerSeconds.value)"
          :is-paused="timer.isPaused.value"
          :mistakes="mistakes"
          :max-mistakes="3"
          :hint-status="hintStatus"
          :hint-body="activeComplexHint ? 'Analiza u toku...' : 'Spreman za igru'"
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
          class="sudoku-grid-animated"
        />

        <!-- Dodatne kontrole koje uključuju i Auto-Notes i Double-click hint -->
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
            title="Automatski popuni sve preostale kandidate"
            class="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-black uppercase tracking-wider transition-all active:scale-95 text-violet-400 flex items-center gap-1.5 rounded-none"
          >
            <svg class="w-4 h-4 text-violet-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
            <span>Auto Bilješke</span>
          </button>
        </div>

        <Numpad
          :counts="numberCounts"
          @input-number="handleInputNumber"
        />
      </div>

      <!-- DESNA STRANA: STEP-BY-STEP ANALITIČKI PANEL (5 kolona) -->
      <div class="col-span-5 h-[580px]">
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

    <!-- COGNITIVE LOADING OVERLAY -->
    <div v-if="ocr.isLoading.value" class="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4">
      <div class="w-12 h-12 border-4 border-violet-500 border-t-transparent animate-spin"></div>
      <p class="text-sm text-zinc-350 font-bold">Gemini AI prepoznaje tabelu...</p>
    </div>

    <!-- REAKTIVNI UKLAPAJUĆI MODAL (Nula rounded uglova) -->
    <div v-if="showModal" class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div class="bg-zinc-900 border border-zinc-800 w-full max-w-sm p-6 shadow-2xl text-center rounded-none border-t-4 animate-fade-in" :class="isWinState ? 'border-t-emerald-500' : 'border-t-rose-500'">
        <h3 class="text-xl font-black mb-2 text-zinc-100 uppercase tracking-tight">{{ modalTitle }}</h3>
        <p class="text-xs text-zinc-450 mb-6 leading-relaxed">{{ modalMessage }}</p>
        <button @click="handleModalClose" class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold uppercase transition-all rounded-none border border-zinc-700">
          U redu, zatvori
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ================= PREMIUM KOHEZIVNE ANIMACIJE ================= */

/* Ključni frejmovi za pulsiranje i skejling ciljnih brojeva/ćelija */
@keyframes pulse-scale {
  0%, 100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.08);
    filter: brightness(1.25);
  }
}

/* Ključni frejmovi za treperenje i bljesak aktivnih trigera (svedoka) */
@keyframes trigger-glow {
  0%, 100% {
    background-color: rgba(99, 102, 241, 0.2); /* Indigo */
    box-shadow: inset 0 0 12px rgba(99, 102, 241, 0.4);
  }
  50% {
    background-color: rgba(99, 102, 241, 0.45);
    box-shadow: inset 0 0 20px rgba(99, 102, 241, 0.7);
  }
}

/* Ključni frejmovi za eliminacije i "gašenje" lažnih kandidata */
@keyframes elimination-blink {
  0%, 100% {
    background-color: rgba(244, 63, 94, 0.15); /* Rose */
    opacity: 0.85;
  }
  50% {
    background-color: rgba(244, 63, 94, 0.4);
    opacity: 0.35;
  }
}

/* Integracija animacionih klasa koje se automatski mapiraju na komponente */
:deep(.bg-indigo-500\/30) {
  animation: trigger-glow 1.5s infinite ease-in-out !important;
}

:deep(.bg-rose-500\/30) {
  animation: elimination-blink 1.5s infinite ease-in-out !important;
}

:deep(.ring-violet-500) {
  animation: pulse-scale 2s infinite ease-in-out !important;
}
</style>