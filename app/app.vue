<script setup lang="ts">
// Nuxt UI has no Serbian: its own strings stay English. Importing every locale cost 228 KB.
import { en as uiLocale } from "@nuxt/ui/locale";
import confetti from "canvas-confetti";
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";

import type { CellCoord, Difficulty, FlashCell } from "./types/sudoku";
import type { BoardTheme } from "./utils/preferenceValues";
import type { BoardUnit, DigitAt, TechniqueId } from "./utils/sudokuGrader";

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
import { localDateKey, useDailyPuzzle } from "./composables/useDailyPuzzle";
import { useGameSave, type GameSave, type SaveSlot } from "./composables/useGameSave";
import { usePreferences } from "./composables/usePreferences";
import { useRecords } from "./composables/useRecords";
import { statsKey, useScore, winsAt } from "./composables/useScore";
import { useSudokuEngine } from "./composables/useSudokuEngine";
import { useTechniquePath } from "./composables/useTechniquePath";
import { useTechniqueStats } from "./composables/useTechniqueStats";
import { useTimer } from "./composables/useTimer";
import { haptic } from "./utils/haptics";
import { levelBand, levelFor } from "./utils/level";
import { generatePracticePuzzle } from "./utils/practice";
import {
  ACADEMY_TECHNIQUES,
  lockOf,
  lockedLevels,
  nextChallenge,
  type Week,
} from "./utils/progression";
import { takePuzzle } from "./utils/puzzlePool";
import { brokenRecords, type NewRecord, type Snapshot } from "./utils/records";
import { computeScore, type ScoreBreakdown } from "./utils/score";
import {
  playComplete,
  playDigitDone,
  playHint,
  playMistake,
  playPlace,
  playStamp,
  playTick,
  playUnlock,
  playWin,
} from "./utils/sound";
import { starsFor } from "./utils/stars";
import {
  onBoard,
  restorePlacements,
  stuckMoments,
  type Placement,
  type StuckMoment,
} from "./utils/stuckMoments";
import { digitLabel } from "./utils/sudokuColors";
import { makeRng, seedFromString } from "./utils/sudokuCore";
import { neededTechniques, patternUnit, singlesPath } from "./utils/sudokuGrader";
import { saveToCloud, submitWin } from "./utils/wavedash";

const { t, locale, locales } = useI18n();

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
  hintStyle,
  showCandidates,
  zen,
  boardTheme,
  uiScale,
} = usePreferences();

// The theme-color metas (nuxt.config.ts) follow the system scheme; a theme forced in Settings must
// win, so both get the resolved colour (whichever media query matches, it is the right one).
// data-theme on <html> lets main.css recolour the whole app for the chosen theme.
const uiColorMode = useColorMode();
const THEME_COLORS: Record<BoardTheme, [light: string, dark: string]> = {
  tiles: ["#17294a", "#1c252f"],
  newsprint: ["#1e1d1a", "#1d1c19"],
  contrast: ["#000000", "#000000"],
};
useHead(() => {
  const colors = THEME_COLORS[boardTheme.value] ?? THEME_COLORS.tiles; // a hand-edited value
  const content = colors[uiColorMode.value === "dark" ? 1 : 0];
  return {
    htmlAttrs: { "data-theme": boardTheme.value },
    meta: ["light", "dark"].map((s) => ({
      name: "theme-color",
      media: `(prefers-color-scheme: ${s})`,
      content,
    })),
  };
});

// One call per game event: the sound and the vibration, each respecting its own setting.
const CUES = {
  place: [playPlace, "place"],
  mistake: [playMistake, "mistake"],
  complete: [playComplete, "complete"],
  win: [playWin, "win"],
  hint: [playHint, null],
  unlock: [playUnlock, null],
  digit: [playDigitDone, "digit"],
  tick: [playTick, null],
  stamp: [playStamp, "stamp"],
} as const;
// `arg` tunes the sound: the digit for a placement or a finished digit, units completed at once
// for a completion, the star's number for a tick.
function cue(kind: keyof typeof CUES, ...arg: number[]) {
  const [sound, vibration] = CUES[kind];
  if (soundEnabled.value) (sound as (...a: number[]) => void)(...arg);
  if (vibration && hapticsEnabled.value) haptic(vibration);
}
const engine = useSudokuEngine(
  colorMode,
  computed(() => !highlightErrors.value),
);
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
let dailyDate = ""; // the date of the Daily being played, stamped on its save
// A Zen game hides the timer and mistake count, has no mistake limit and records no score.
const gameZen = ref(false);
// Set while playing a technique-practice puzzle: no score, achievements or autosave slot.
const practiceTechnique = ref<TechniqueId | null>(null);
const practiceLoading = ref(false);
// Whether the practice game is a real puzzle or the Academy drill, and its ISO week when it is
// the technique of the week: both decide what a win counts for on the technique path.
const practiceRun = ref<{ kind: "puzzle" | "drill"; week: string | null }>({
  kind: "puzzle",
  week: null,
});
const techniquePath = useTechniquePath();
// Win-modal lines: progress the win made (ok), or why it made none (a drill that doesn't count).
const progressNotes = ref<{ text: string; ok: boolean }[]>([]);

const notesMode = ref<boolean>(false);
const mistakes = ref<number>(0);
// The game's status line ("Wrong digit here!", "Notes auto-filled!"), read out by the sr-only
// aria-live region on the game screen. aria-live only speaks a change, so say() clears it first:
// the same message twice in a row is read twice.
const announcement = ref("");
function say(message: string) {
  announcement.value = "";
  nextTick(() => (announcement.value = message));
}
const hintStatus = {
  get value() {
    return announcement.value;
  },
  set value(message: string) {
    say(message);
  },
};
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
// Display size (main.css multiplies the root font-size by --ui-scale) enlarges every screen but
// the game, whose board already fills the height: there a bigger rem would only shrink it. Set
// during setup, so the first paint is right, then as each screen enters (the screen Transition is
// out-in), so the screen leaving never jumps.
function applyUiScale() {
  const scale = currentScreen.value === "game" ? 1 : uiScale.value;
  document.documentElement.style.setProperty("--ui-scale", String(scale));
}
applyUiScale();
watch(uiScale, applyUiScale);
const activeDifficulty = ref<Difficulty>("medium");
// What the dashboard chip and the win modal call this game, in the player's language.
const difficultyLabel = computed(() =>
  practiceTechnique.value
    ? `${practiceRun.value.week ? t("weekly.title") : t("practice.label")} · ${t(`hint.move.${practiceTechnique.value}.name`)}`
    : isDailyMode.value
      ? t("difficulty.daily")
      : gameZen.value
        ? `${t(`difficulty.${activeDifficulty.value}`)} · ${t("difficulty.zen")}`
        : t(`difficulty.${activeDifficulty.value}`),
);

const showModal = ref<boolean>(false);
const modalTitle = ref<string>("");
const modalMessage = ref<string>("");
const isWinState = ref<boolean>(false);

const pendingResume = ref<{ save: GameSave; level: SaveSlot } | null>(null);

const hintsUsed = ref<number>(0);
const techniqueLog = ref<TechniqueId[]>([]);
// Settings opened from the game slide over it, so a new theme shows on the real board. The board is
// in view, so the clock runs while it's open (a paused clock would be a free look at the board).
const settingsOverGame = ref(false);
const settingsSheet = ref<HTMLDialogElement | null>(null);
function openGameSettings() {
  if (timer.isPaused.value) timer.togglePause();
  settingsOverGame.value = true;
}
// Post-flush, so the sheet's content exists and showModal() focuses its Back button.
watch(
  settingsOverGame,
  (open) => {
    if (open) settingsSheet.value?.showModal();
    else settingsSheet.value?.close();
  },
  { flush: "post" },
);
// A click outside the sheet closes it, but not a drag that started inside (selecting text).
let pressedOutside = false;
function onSheetClick(e: MouseEvent) {
  if (pressedOutside && e.target === settingsSheet.value) settingsOverGame.value = false;
  pressedOutside = false;
}
// Set when a nudge's technique opened the Academy: Back returns to the paused game.
const academyFromGame = ref(false);
// Still in the game, for state that should survive those detours (armed digit, nudge).
const inGame = computed(
  () =>
    currentScreen.value === "game" || (currentScreen.value === "academy" && academyFromGame.value),
);
// What the won puzzle's givens required (not what the player used), for the win modal.
const neededTechs = ref<TechniqueId[]>([]);
// The Academy lesson to open on, when a win-modal chip led there.
const academyFocus = ref<TechniqueId | null>(null);
const mistakeExplainer = ref<string>("");
// Every correct digit that went in, on the clock, for "Where you got stuck" on the win modal.
const placements = ref<Placement[]>([]);
const stuck = ref<StuckMoment[]>([]);
function logPlacement({ r, c, num }: DigitAt) {
  placements.value.push({ r, c, num, t: timer.timerSeconds.value });
}
// Undo, erase or an overwrite takes a digit back out: it leaves the log too.
watch(
  currentBoard,
  (board) => {
    if (placements.value.some((p) => board[p.r]![p.c] !== p.num))
      placements.value = onBoard(placements.value, board);
  },
  { deep: true },
);

const flashCells = ref<FlashCell[]>([]);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

const score = useScore();
const lastScore = ref<ScoreBreakdown | null>(null);
const isNewBest = ref<boolean>(false);
const lifetimeTotal = ref<number>(0);
// Set when the just-won game crossed a level threshold, for the win modal banner.
const reachedLevel = ref<number | null>(null);
const records = useRecords();
// Personal records this win broke, for the win modal: at most two lines.
const newRecords = ref<NewRecord[]>([]);

// Practice and custom boards don't count: a one-blank custom board could be won over and over.
const countsForRecords = () => !practiceTechnique.value && activeDifficulty.value !== "custom";

// What a win can break, read before and after recording it. A Daily's time is compared with
// earlier Dailies (its own score row), like its "New best" chip.
function recordSnapshot(): Snapshot {
  const key = statsKey(activeDifficulty.value, isDailyMode.value);
  return {
    ...records.get(),
    fastest: score.getStats().perDifficulty[key]?.bestTime ?? 0,
    streak: dailyPuzzle.getLongestStreak(),
  };
}

function recordLine(r: NewRecord): string {
  const show = (v: number | string) =>
    r.kind === "fastest"
      ? timer.formatTime(v as number)
      : r.kind === "noHint"
        ? t(`difficulty.${v}`)
        : v;
  return t(`records.new.${r.kind}`, {
    difficulty: t(`difficulty.${statsKey(activeDifficulty.value, isDailyMode.value)}`),
    value: show(r.value),
    was: show(r.was),
  });
}

// A clean win: no mistakes and no hints (a nudge counts as one). Zen too: it's how you played.
const perfect = computed(() => isWinState.value && mistakes.value === 0 && hintsUsed.value === 0);
const winStars = computed(() => starsFor(mistakes.value, hintsUsed.value));
const scoreRows = computed(() => {
  const s = lastScore.value;
  if (!s) return [];
  const good = "text-emerald-700 dark:text-emerald-400";
  return [
    { key: "scoreBase", value: s.base, cls: "text-zinc-800 dark:text-zinc-200" },
    { key: "scoreSpeed", value: s.speedBonus, cls: good },
    { key: "scoreFlawless", value: s.flawlessBonus, cls: good },
    {
      key: "scoreMistakePenalty",
      value: -s.mistakePenalty,
      cls: "text-rose-600 dark:text-rose-400",
    },
    { key: "scoreHintPenalty", value: -s.hintPenalty, cls: "text-amber-700 dark:text-amber-400" },
  ].filter((row, i) => !i || row.value);
});

// The win modal plays in steps once it has faded in: each earned star with a tick, then each
// score line as the total counts up through it, then the stamp. The DOM holds the real numbers
// throughout (unrevealed parts are only transparent). A tap or key skips to the end, and reduced
// motion starts there.
const WIN_STEPS_AT_MS = 1100; // as .modal-delay finishes fading the result in
const WIN_STEP_MS = 160;
const winStepCount = computed(
  () => winStars.value + scoreRows.value.length + (perfect.value ? 1 : 0),
);
const winStep = ref(0);
// The total has landed: what hangs off it (a new best, records, the lifetime line) shows now.
const scoreLanded = computed(() => winStep.value >= winStars.value + scoreRows.value.length);
const winSkipped = ref(false);
const displayedScore = ref<number>(0); // the visual total; the real one sits beside it, sr-only
let winTimers: ReturnType<typeof setTimeout>[] = [];
let countFrame = 0;

function stopWinSteps() {
  winTimers.forEach(clearTimeout);
  winTimers = [];
  cancelAnimationFrame(countFrame);
}

function startWinSteps() {
  stopWinSteps();
  winStep.value = 0;
  winSkipped.value = false;
  displayedScore.value = 0;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    skipWinSteps();
    if (perfect.value) cue("stamp");
    return;
  }
  for (let k = 1; k <= winStepCount.value; k++)
    winTimers.push(setTimeout(() => winStepTo(k), WIN_STEPS_AT_MS + (k - 1) * WIN_STEP_MS));
}

function winStepTo(k: number) {
  winStep.value = k;
  const rows = scoreRows.value;
  const row = k - winStars.value - 1;
  if (k <= winStars.value) cue("tick", k);
  else if (row < rows.length) {
    const sum = rows.slice(0, row + 1).reduce((a, r) => a + r.value, 0);
    // Penalties can take the running sum below zero; the real total is floored, so it lands there.
    countScoreTo(row === rows.length - 1 ? lastScore.value!.total : Math.max(0, sum));
  } else cue("stamp");
}

function skipWinSteps() {
  if (winStep.value >= winStepCount.value) return;
  stopWinSteps();
  winSkipped.value = true;
  winStep.value = winStepCount.value;
  displayedScore.value = lastScore.value?.total ?? 0;
}

function countScoreTo(to: number) {
  cancelAnimationFrame(countFrame);
  const from = displayedScore.value;
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / WIN_STEP_MS);
    displayedScore.value = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) countFrame = requestAnimationFrame(tick);
  };
  countFrame = requestAnimationFrame(tick);
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
// The time to beat, read when a game opens (0 hides it): the fastest Daily in the Daily, else
// this difficulty's best. Custom and practice boards vary too much for a best to mean anything.
const bestTime = computed(() => {
  void currentScreen.value;
  if (practiceTechnique.value || activeDifficulty.value === "custom") return 0;
  if (isDailyMode.value) return dailyPuzzle.getBestTime();
  return score.getStats().perDifficulty[activeDifficulty.value]?.bestTime ?? 0;
});
const dailyStreak = computed(() => {
  void currentScreen.value;
  return dailyPuzzle.getStreak();
});
const pathDone = computed(() => {
  void currentScreen.value;
  const done = techniquePath.getDone();
  return ACADEMY_TECHNIQUES.filter((tech) => done.includes(tech.id)).length;
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
      zen: gameZen.value,
      daily: isDailyMode.value ? dailyDate : undefined,
      placements: placements.value,
    });
  },
  { deep: true },
);

function triggerLocalModal(title: string, message: string, win: boolean = false) {
  if (showModal.value) return; // a game ends once: never record a win twice
  modalTitle.value = title;
  modalMessage.value = message;
  isWinState.value = win;
  // A few ms even for Master (measured), so no worker: the modal fades in after the win wave.
  const needed = win ? neededTechniques(initialBoard.value) : [];
  // A drill's pre-filled notes are invisible to the grader, so lead with what was practised.
  const practised = practiceTechnique.value;
  neededTechs.value =
    win && practised ? [practised, ...needed.filter((id) => id !== practised)] : needed;
  stuck.value = [];
  newRecords.value = [];
  showModal.value = true;
  activeDigit.value = null;
  reachedLevel.value = null;
  progressNotes.value = [];
  timer.stopTimer();
  // Read before this game's save is cleared: a level open only through it isn't news.
  const lockedBefore =
    win && !practised ? lockedLevels(score.unlockWins(), (d) => !!gameSave.loadDifficulty(d)) : [];
  if (!practiceTechnique.value)
    gameSave.clearDifficulty(isDailyMode.value ? "daily" : activeDifficulty.value);
  if (win) {
    cue("win");
    flashWin();
    const recordsBefore = countsForRecords() ? recordSnapshot() : null;
    if (practiceTechnique.value || gameZen.value) {
      lastScore.value = null;
      if (practised) {
        recordPracticeWin(practised);
      } else {
        score.recordZenWin(activeDifficulty.value);
        announceUnlocks(lockedBefore);
        if (progressNotes.value.length) cue("unlock");
      }
    } else {
      if (isDailyMode.value)
        dailyPuzzle.markComplete(timer.timerSeconds.value, mistakes.value, dailyDate);
      const breakdown = computeScore({
        difficulty: activeDifficulty.value,
        timeSeconds: timer.timerSeconds.value,
        mistakes: mistakes.value,
        hintsUsed: hintsUsed.value,
      });
      const key = statsKey(activeDifficulty.value, isDailyMode.value);
      const result = score.record(key, breakdown.total, timer.timerSeconds.value);
      submitWin({
        difficulty: activeDifficulty.value,
        seconds: timer.timerSeconds.value,
        mistakes: mistakes.value,
        hints: hintsUsed.value,
        daily: isDailyMode.value ? dailyDate : null,
      });
      lastScore.value = breakdown;
      isNewBest.value = result.isNewBest;
      lifetimeTotal.value = result.stats.total;
      const before = levelFor(result.previousTotal).level;
      const after = levelFor(result.stats.total).level;
      reachedLevel.value = after > before ? after : null;
      announceUnlocks(lockedBefore);
      const unlocked = achievements.evaluate({
        difficulty: activeDifficulty.value,
        timeSeconds: timer.timerSeconds.value,
        mistakes: mistakes.value,
        hintsUsed: hintsUsed.value,
        isDaily: isDailyMode.value,
        colorMode: colorMode.value,
        hour: new Date().getHours(),
        gamesWon: result.stats.gamesWon,
        winsAtDifficulty: winsAt(result.stats.perDifficulty, key),
        dailyStreak: isDailyMode.value ? dailyPuzzle.getStreak() : 0,
        distinctTechniques: Object.keys(techStats.getAll()).length,
      });
      toastIds.value.push(...unlocked);
      if (unlocked.length || progressNotes.value.length) cue("unlock");
    }
    if (recordsBefore) {
      records.recordWin({
        day: localDateKey(),
        difficulty: activeDifficulty.value,
        mistakes: mistakes.value,
        hints: hintsUsed.value,
      });
      newRecords.value = brokenRecords(recordsBefore, recordSnapshot()).slice(0, 2);
    }
    if (!practised) saveToCloud();
    startWinSteps();
    // After the score is safe: a damaged log must cost the stuck moments, not the win.
    try {
      if (!gameZen.value) stuck.value = stuckMoments(initialBoard.value, placements.value);
    } catch {
      stuck.value = [];
    }
    confetti({
      disableForReducedMotion: true,
      particleCount: 160,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#17294a", "#2a52a8", "#8aabe2", "#ffe680", "#c2352b"],
    });
  } else {
    lastScore.value = null;
  }
}

// Levels that were locked before this win (counting saves) and are open now.
function announceUnlocks(lockedBefore: Difficulty[]) {
  const wins = score.unlockWins();
  for (const level of lockedBefore.filter((d) => !lockOf(d, wins)))
    progressNotes.value.push({
      text: t("difficulty.unlocked", { level: t(`difficulty.${level}`) }),
      ok: true,
    });
}

// A practice win can complete the technique path's current challenge and the week's puzzle.
function recordPracticeWin(id: TechniqueId) {
  const name = t(`hint.move.${id}.name`);
  const { kind, week } = practiceRun.value;
  const wasNext = nextChallenge(techniquePath.getDone()) === id;
  if (techniquePath.recordWin(id, kind))
    progressNotes.value.push({ text: t("path.completed", { name }), ok: true });
  // The current challenge, not completed: a drill where only a real puzzle counts.
  else if (wasNext) progressNotes.value.push({ text: t("path.drillNoCount"), ok: false });
  if (week && techniquePath.markWeekDone(week))
    progressNotes.value.push({ text: t("weekly.won", { name }), ok: true });
  if (progressNotes.value.some((n) => n.ok)) {
    cue("unlock");
    saveToCloud();
  }
}

// Zen games never mention the clock.
function winMessage() {
  return gameZen.value
    ? t("modal.winZenMsg", { difficulty: difficultyLabel.value })
    : t("modal.winMsg", {
        difficulty: difficultyLabel.value,
        time: timer.formatTime(timer.timerSeconds.value),
      });
}

function handleModalClose() {
  stopWinSteps();
  showModal.value = false;
  practiceTechnique.value = null;
  isDailyMode.value = false;
  currentScreen.value = "menu";
  timer.resetTimer();
}

function openLesson(id: TechniqueId) {
  handleModalClose();
  academyFromGame.value = false;
  academyFocus.value = id;
  currentScreen.value = "academy";
}

function resumeSavedGame(s: GameSave) {
  practiceTechnique.value = null;
  isDailyMode.value = !!s.daily;
  dailyDate = s.daily ?? "";
  restoreGame(s);
  activeDifficulty.value = s.difficulty;
  mistakes.value = s.mistakes;
  hintStatus.value = t("game.ready");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = s.hintsUsed ?? 0;
  gameZen.value = s.zen ?? false;
  techniqueLog.value = [];
  placements.value = restorePlacements(s);
  timer.resetTimer();
  timer.timerSeconds.value = s.timerSeconds;
  timer.startTimer();
  currentScreen.value = "game";
}

// A board still generating when the player picks again, or leaves the screen, is dropped.
let startToken = 0;
watch(currentScreen, () => startToken++);
async function handleStartGame(level: Difficulty) {
  const token = ++startToken;
  const generated = await takePuzzle(level);
  if (token !== startToken) return;
  practiceTechnique.value = null;
  isDailyMode.value = false;
  gameZen.value = zen.value;
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
  placements.value = [];
  startNewGame(level, generated);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = "game";
}

// A difficulty already has a saved game — ask before silently overwriting it.
function handleChooseDifficulty(level: Difficulty) {
  const existing = gameSave.loadDifficulty(level);
  if (existing) {
    pendingResume.value = { save: existing, level };
  } else if (lockOf(level, score.unlockWins())) {
    return; // the selector shows it locked; never start one past it
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
  const { level } = pendingResume.value;
  if (level === "daily") startDaily();
  else handleStartGame(level);
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
  if (!digitFirst.value || !activeDigit.value || initialBoard.value[coord.r]![coord.c] !== 0)
    return;
  // Only into an empty cell, or onto the armed digit to take it back out: a stray tap on a
  // different entry must not silently replace it (and cost a mistake).
  const held = currentBoard.value[coord.r]![coord.c];
  if (held === 0 || held === activeDigit.value) handleInputNumber(activeDigit.value);
}

// An armed digit is meaningless once the player leaves the game, turns the mode off, or has
// placed all nine of it.
watch([inGame, digitFirst], () => {
  if (!inGame.value || !digitFirst.value) activeDigit.value = null;
});
watch(numberCounts, (counts) => {
  if (activeDigit.value && counts[activeDigit.value]! >= 9) activeDigit.value = null;
});

// A correct placement may finish a row, column, and/or box, or the last of a digit — flash every
// cell of each newly-completed unit. "Complete" means every cell already
// matches the solution, not just non-empty (a wrong-but-unconflicting digit
// can sit in a cell without being flagged, so equality is the real check).
function flashCompletedUnits(r: number, c: number) {
  // Cells ripple outward from the digit just placed: 45 ms per step of distance.
  const RIPPLE_MS = 45;
  const cells: FlashCell[] = [];
  let units = 0;
  const add = (cr: number, cc: number) =>
    cells.push({ r: cr, c: cc, delay: Math.max(Math.abs(cr - r), Math.abs(cc - c)) * RIPPLE_MS });

  if ([...Array(9).keys()].every((i) => currentBoard.value[r]![i] === solvedBoard.value[r]![i])) {
    units++;
    for (let i = 0; i < 9; i++) add(r, i);
  }
  if ([...Array(9).keys()].every((i) => currentBoard.value[i]![c] === solvedBoard.value[i]![c])) {
    units++;
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
    units++;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) add(boxR + i, boxC + j);
    }
  }

  // All nine of the placed digit are in, and right: its cells light up with the units (a cell in
  // both is listed twice, at the same delay, which the grid shows once).
  const num = currentBoard.value[r]![c]!;
  const solvedCells = solvedBoard.value.flatMap((row, sr) =>
    row.flatMap((v, sc) => (v === num ? [[sr, sc] as const] : [])),
  );
  const digitDone = solvedCells.every(([sr, sc]) => currentBoard.value[sr]![sc] === num);
  if (digitDone) for (const [sr, sc] of solvedCells) add(sr, sc);

  if (!cells.length) return;
  if (units) cue("complete", units, num);
  if (digitDone) cue("digit", num);
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
  if (timer.isPaused.value || showModal.value || finishing.value || !selectedCell.value) return;
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
        // The first mistake ends the clean run now: abandoning the game mustn't save it.
        if (mistakes.value === 1 && countsForRecords()) records.recordMistake();
        // With "Highlight mistakes" off the entry stays unmarked and can't end the game;
        // it still counts toward the score.
        if (!highlightErrors.value) {
          cue("place", num); // sounds identical to a correct entry
        } else {
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
          if (!gameZen.value && mistakeLimit.value > 0 && mistakes.value >= mistakeLimit.value) {
            triggerLocalModal(
              t("modal.gameOver"),
              t("modal.gameOverMsg", { n: mistakeLimit.value }),
            );
          }
        }
      } else {
        cue("place", num);
        mistakeExplainer.value = "";
        clearRelationalNotes(r, c, num);
        logPlacement({ r, c, num });
        // The ripple and its chime confirm correctness, so they're off with mistake highlighting.
        // A winning move gets the win's wave and cue alone, not three stacked on each other.
        if (checkWinCondition()) triggerLocalModal(t("modal.win"), winMessage(), true);
        else if (highlightErrors.value) flashCompletedUnits(r, c);
      }
    }
  }
}

function handleNextStep() {
  const tech = engine.activeMove.value?.technique; // none for a wrong-entry hint
  const placement = engine.activeMove.value?.placement;
  const placed = placement?.num;
  nextHintStep(() => {
    if (placement) logPlacement(placement);
    if (tech) {
      if (!techniqueLog.value.includes(tech)) techniqueLog.value.push(tech);
      techStats.record(tech);
    }
    chargeHint();
    if (placed) cue("place", placed);
    if (checkWinCondition()) {
      triggerLocalModal(
        t("modal.win"),
        gameZen.value
          ? winMessage()
          : t("modal.winHintMsg", { time: timer.formatTime(timer.timerSeconds.value) }),
        true,
      );
    } else {
      hintStatus.value = t(
        !tech ? "game.wrongCleared" : placed ? "game.cellFilled" : "game.candidatesCleared",
      );
      hintBody.value = "";
    }
  });
}

// "Nudge first" hint style: the first press names the technique and the row, column or box its
// pattern sits in (or the box holding a wrong entry); pressing again (or the banner's Explain
// button) gives the full step-by-step explanation.
const nudge = ref<{ unit: BoardUnit; technique: TechniqueId | null } | null>(null);
const nudgeUnit = computed(() => {
  const u = nudge.value?.unit;
  if (!u) return "";
  const n = u.kind === "row" ? u.r + 1 : u.kind === "col" ? u.c + 1 : boxNumber(u);
  return t(`hint.nudge.unit.${u.kind}`, { n });
});
const boxNumber = (c: CellCoord) => Math.floor(c.r / 3) * 3 + Math.floor(c.c / 3) + 1;
// Set once a nudge has counted as a hint: explaining and applying that same step is free.
let nudgePaid = false;
watch(
  currentBoard,
  () => {
    nudge.value = null;
    nudgePaid = false;
  },
  { deep: true },
);
watch(currentScreen, () => (finishing.value = false));
// The nudge survives the pause screen's Settings detour, not leaving the game.
watch(inGame, (playing) => {
  if (playing) return;
  nudge.value = null;
  nudgePaid = false;
});
// Counts one hint per step, whether it ended at the nudge or went on to the explanation.
function chargeHint() {
  if (nudgePaid) nudgePaid = false;
  else hintsUsed.value++;
}

// The nudge's technique opens its lesson; the game waits, paused, until the Academy's Back.
function openNudgeLesson() {
  const id = nudge.value?.technique;
  if (!id) return;
  if (!timer.isPaused.value) timer.togglePause();
  academyFromGame.value = true;
  academyFocus.value = id;
  currentScreen.value = "academy";
}

function handleTriggerHint() {
  if (activeComplexHint.value) {
    handleInstantApplyHint();
    return;
  }
  if (hintStyle.value === "nudge" && !nudge.value) {
    const peek = engine.peekHint();
    if (peek) {
      nudge.value = peek.move
        ? { unit: patternUnit(peek.move), technique: peek.move.technique }
        : { unit: { kind: "box", ...peek.at }, technique: null };
      hintsUsed.value++;
      nudgePaid = true;
      cue("hint");
      return;
    }
  }
  nudge.value = null;
  cue("hint");
  triggerComplexHint(hintStatus, hintBody);
}

function handleInstantApplyHint() {
  if (!activeComplexHint.value) return;
  const tech = engine.activeMove.value?.technique; // none for a wrong-entry hint
  const placement = engine.activeMove.value?.placement;
  const placed = placement?.num;
  chargeHint();
  if (placement) logPlacement(placement);
  if (tech) {
    if (!techniqueLog.value.includes(tech)) techniqueLog.value.push(tech);
    techStats.record(tech);
  }
  engine.applyComplexHint();
  if (placed) cue("place", placed);
  if (checkWinCondition()) {
    triggerLocalModal(t("modal.win"), t("modal.winInstantMsg"), true);
  } else {
    hintStatus.value = t(
      !tech ? "game.wrongCleared" : placed ? "game.instantApplied" : "game.candidatesCleared",
    );
    hintBody.value = "";
  }
}

// Finish: with only a few cells left, all of them plain singles from here (by the solver, not the
// answer key) and no wrong digit on the board, offer to fill them in. A normal win, not a hint.
// Not with "Highlight mistakes" off: whether it shows would tell which entries are right.
const FINISH_MAX_EMPTY = 9;
const FINISH_STEP_MS = 80;
// True from the press until the player leaves the game screen: input is blocked meanwhile.
const finishing = ref(false);
const finishPath = computed(() => {
  if (currentScreen.value !== "game" || showModal.value || !highlightErrors.value) return null;
  const empty = currentBoard.value.flat().filter((v) => v === 0).length;
  if (!empty || empty > FINISH_MAX_EMPTY || engine.findWrongEntry()) return null;
  return singlesPath(currentBoard.value);
});

// The clock stops at the press; the cells fill one by one in solve order, each with its own
// flash and placement cue (all at once under reduced motion), then the usual win flow runs.
async function handleFinish() {
  const path = finishPath.value;
  if (!path || finishing.value || timer.isPaused.value) return;
  finishing.value = true;
  timer.stopTimer();
  cancelComplexHint();
  engine.resetHintChain();
  nudge.value = null;
  activeDigit.value = null;
  selectedCell.value = null;
  const token = startToken; // bumped if the player exits mid-cascade
  const instant = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const [i, p] of path.entries()) {
    // A cascade: each cell waits for the one before it.
    // oxlint-disable-next-line eslint/no-await-in-loop
    if (i && !instant) await new Promise((done) => setTimeout(done, FINISH_STEP_MS));
    if (token !== startToken) return;
    currentBoard.value[p.r]![p.c] = p.num;
    clearRelationalNotes(p.r, p.c, p.num);
    logPlacement(p);
    if (!instant || !i) cue("place", p.num);
    runFlash([...flashCells.value, { r: p.r, c: p.c, delay: 0 }]);
  }
  if (checkWinCondition()) {
    triggerLocalModal(t("modal.win"), winMessage(), true);
  } else {
    // Shouldn't happen (the board is inert meanwhile), but never leave the game locked.
    finishing.value = false;
    timer.startTimer();
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

// Only today's Daily can be resumed; one saved on an earlier day is dropped.
function handleStartDaily() {
  const saved = gameSave.loadDifficulty("daily");
  if (saved?.daily === dailyPuzzle.todayKey())
    pendingResume.value = { save: saved, level: "daily" };
  else startDaily();
}

function startDaily() {
  gameSave.clearDifficulty("daily");
  dailyDate = dailyPuzzle.todayKey();
  practiceTechnique.value = null;
  gameZen.value = false;
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
  placements.value = [];
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
  practiceRun.value = { kind: "puzzle", week: null };
  isDailyMode.value = false;
  gameZen.value = false;
  activeDifficulty.value = "custom";
  mistakes.value = 0;
  hintStatus.value = t("game.newBoard");
  hintBody.value = "";
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = 0;
  techniqueLog.value = [];
  placements.value = [];
  loadCustomBoard(board);
  timer.resetTimer();
  timer.startTimer();
  currentScreen.value = "game";
}

let practiceToken = 0;
// `week` set: the technique of the week, seeded so everyone gets the same board that week.
async function handlePractice(technique: TechniqueId, week: Week | null = null) {
  if (practiceLoading.value) return; // a double-click must not start two searches
  practiceLoading.value = true;
  const token = ++practiceToken;
  try {
    const rng = week ? makeRng(seedFromString(week.seed)) : Math.random;
    const p = await generatePracticePuzzle(technique, rng);
    // The player may have left the Academy while the search ran; don't yank them into a game.
    if (token !== practiceToken || currentScreen.value !== "academy") return;
    handleLoadCustomPuzzle(p.board, technique);
    practiceRun.value = { kind: p.kind, week: week?.key ?? null };
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
  isDailyMode.value = false;
  timer.stopTimer();
  cancelComplexHint();
  currentScreen.value = "menu";
}

// Arrows and WASD both walk the grid (so auto-fill notes lives on F, not A).
const MOVE_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  w: [-1, 0],
  s: [1, 0],
  a: [0, -1],
  d: [0, 1],
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
    triggerLocalModal(t("modal.win"), winMessage(), true);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  // A key still held from the winning move, or pressed before the steps start, skips nothing.
  if (showModal.value && !e.repeat && winStep.value) skipWinSteps();
  if (currentScreen.value !== "game" || timer.isPaused.value || settingsOverGame.value) return;
  if (showModal.value || practiceLoading.value || finishing.value) return;
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
  const step = MOVE_STEPS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (step) {
    e.preventDefault();
    moveSelection(step[0], step[1]);
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
  } else if (e.key.toLowerCase() === "f") {
    handleAutoFillNotes();
  }
}

// Switching tabs/apps shouldn't quietly burn time against the player's score.
function handlePageHidden() {
  if (
    document.hidden &&
    currentScreen.value === "game" &&
    !timer.isPaused.value &&
    !finishing.value
  ) {
    timer.togglePause();
    settingsOverGame.value = false; // back on the pause screen, which a paused clock needs
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
  stopWinSteps();
});
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="app-shell flex min-h-screen w-full flex-col bg-[var(--ground)] text-zinc-900 antialiased dark:text-zinc-100"
    >
      <Transition name="screen" mode="out-in" @before-enter="applyUiScale">
        <!-- MENU: the menu is itself a 3×3 box, New game filling four of its cells. -->
        <div
          v-if="currentScreen === 'menu'"
          class="relative flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12"
        >
          <button
            @click="currentScreen = 'settings'"
            :aria-label="$t('menu.settings')"
            :title="$t('menu.settings')"
            class="tile absolute top-4 right-4 grid h-11 w-11 place-items-center text-zinc-600 dark:text-zinc-300"
          >
            <AppIcon
              class="h-5 w-5"
              path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.65 7.65 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </button>

          <div class="text-center">
            <h1
              class="wordmark relative isolate inline-block text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50"
            >
              {{ $t("menu.title") }}
            </h1>
            <p class="mt-3 text-sm text-zinc-500">
              {{ $t("menu.subtitle") }}
            </p>
            <!-- Level / progress -->
            <div class="mx-auto mt-5 w-full max-w-[15rem]" data-testid="level-badge">
              <p class="text-xs font-bold text-violet-700 dark:text-violet-300">
                {{ $t("level.label", { n: playerLevel.level }) }}
                <span class="font-semibold text-zinc-500"
                  >· {{ $t(`level.title.${levelBand(playerLevel.level)}`) }}</span
                >
              </p>
              <div
                class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              >
                <div
                  class="h-full rounded-full bg-violet-600"
                  :style="{ width: `${Math.round(playerLevel.progress * 100)}%` }"
                />
              </div>
            </div>
          </div>

          <nav
            :aria-label="$t('menu.title')"
            class="tray grid aspect-square w-full max-w-[26rem] grid-cols-3 grid-rows-3 gap-2 p-2 sm:gap-2.5 sm:p-2.5"
          >
            <button
              @click="currentScreen = 'difficulty'"
              class="tile tile-primary relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden p-4 text-left sm:p-5"
            >
              <!-- A faint corner of a puzzle, so the tile says what it starts. -->
              <svg
                aria-hidden="true"
                viewBox="0 0 90 90"
                class="pointer-events-none absolute -top-3 -right-3 h-32 w-32 opacity-20 sm:h-40 sm:w-40"
                fill="none"
                stroke="currentColor"
              >
                <rect x="1" y="1" width="88" height="88" rx="6" stroke-width="2.5" />
                <path d="M31 1v88M59 1v88M1 31h88M1 59h88" stroke-width="1.2" />
                <g
                  fill="currentColor"
                  stroke="none"
                  font-family="var(--font-game)"
                  font-weight="800"
                  font-size="19"
                  text-anchor="middle"
                >
                  <text x="16" y="23">5</text>
                  <text x="44" y="23">3</text>
                  <text x="16" y="51">6</text>
                  <text x="74" y="51">9</text>
                  <text x="44" y="79">8</text>
                  <text x="74" y="79">1</text>
                </g>
              </svg>
              <AppIcon
                class="h-9 w-9 opacity-90"
                path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <span>
                <span
                  class="block font-display text-2xl leading-tight font-extrabold sm:text-3xl"
                  >{{ $t("menu.start") }}</span
                >
                <span class="mt-1 block text-xs font-medium opacity-80">{{
                  $t("menu.startHint")
                }}</span>
              </span>
            </button>

            <button
              @click="handleStartDaily"
              :disabled="!!dailyRecord"
              :class="dailyRecord ? '' : 'tile-amber'"
              class="tile menu-cell"
            >
              <AppIcon
                class="h-5 w-5"
                path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
              <span>
                <span class="block">{{
                  dailyRecord ? $t("menu.dailyCompleted") : $t("menu.dailyChallenge")
                }}</span>
                <span v-if="dailyStreak > 0" class="block text-[0.6875rem] font-semibold opacity-80"
                  >🔥 {{ $t("menu.dailyStreak", { n: dailyStreak }) }}</span
                >
              </span>
            </button>

            <button
              @click="
                academyFocus = null;
                academyFromGame = false;
                currentScreen = 'academy';
              "
              class="tile menu-cell"
            >
              <AppIcon
                class="h-5 w-5 text-violet-600 dark:text-violet-300"
                path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
              <span>
                <span class="block">{{ $t("menu.academy") }}</span>
                <span class="block text-[0.6875rem] font-semibold opacity-80">{{
                  $t("path.menu", { done: pathDone, total: ACADEMY_TECHNIQUES.length })
                }}</span>
              </span>
            </button>

            <button @click="currentScreen = 'stats'" class="tile menu-cell">
              <AppIcon
                class="h-5 w-5 text-violet-600 dark:text-violet-300"
                path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
              <span>{{ $t("menu.stats") }}</span>
            </button>

            <button @click="currentScreen = 'achievements'" class="tile menu-cell">
              <AppIcon
                class="h-5 w-5 text-violet-600 dark:text-violet-300"
                path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
              />
              <span>{{ $t("menu.achievements") }}</span>
            </button>

            <button @click="currentScreen = 'custom-import'" class="tile menu-cell">
              <AppIcon
                class="h-5 w-5 text-violet-600 dark:text-violet-300"
                path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
              <span>{{ $t("menu.customPuzzle") }}</span>
            </button>
          </nav>
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
          :focus="academyFocus"
          :in-game="academyFromGame"
          @back-to-menu="currentScreen = academyFromGame ? 'game' : 'menu'"
          @practice="handlePractice"
          @weekly="(week) => handlePractice(week.technique, week)"
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
          class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-2 py-2 3xl:max-w-[118.75rem] 3xl:grid-cols-[15rem_minmax(0,1fr)_26.25rem] 3xl:gap-6 3xl:px-8 sm:px-5 sm:py-3 lg:grid lg:gap-6 lg:max-3xl:grid-cols-12"
        >
          <!-- Screen readers hear what sighted players see on the board: "Wrong digit here!" etc. -->
          <p class="sr-only" aria-live="polite">{{ announcement }}</p>
          <!-- 3xl left sidebar: shortcuts & branding -->
          <div class="sticky top-3 hidden flex-col gap-6 3xl:col-span-1 3xl:flex">
            <div>
              <p class="mb-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                {{ $t("sidebar.keyboard") }}
              </p>
              <ul class="space-y-3">
                <li
                  v-for="(s, i) in [
                    { key: '↑←↓→', desc: $t('sidebar.shortcutMove') },
                    { key: 'WASD', desc: $t('sidebar.shortcutMove') },
                    { key: '1–9', desc: $t('sidebar.shortcutInputNumber') },
                    { key: 'Backspace', desc: $t('sidebar.shortcutEraseCell') },
                    { key: 'N', desc: $t('sidebar.shortcutToggleNotes') },
                    { key: 'H', desc: $t('sidebar.shortcutGetHint') },
                    { key: 'F', desc: $t('sidebar.shortcutAutoFillNotes') },
                    { key: 'Ctrl+Z', desc: $t('sidebar.shortcutUndo') },
                    { key: 'Ctrl+Y', desc: $t('sidebar.shortcutRedo') },
                  ]"
                  :key="i"
                  class="flex items-center gap-3"
                >
                  <kbd
                    class="min-w-[3.75rem] shrink-0 border border-zinc-300 bg-zinc-100 px-2 py-1 text-center font-game text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
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
              :show-timer="showTimer && !gameZen"
              :best-time="bestTime ? timer.formatTime(bestTime) : ''"
              :past-best="bestTime > 0 && timer.timerSeconds.value > bestTime"
              :show-mistakes="highlightErrors && !gameZen"
              :difficulty="difficultyLabel"
              @toggle-pause="!finishing && timer.togglePause()"
              @exit-game="exitToMenu"
            />

            <!-- Nudge: names the technique and where to look before the full explanation -->
            <div
              v-if="nudge"
              role="status"
              class="flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-300/25 px-3 py-2 text-xs text-amber-950 dark:bg-amber-400/10 dark:text-amber-200"
            >
              <i18n-t v-if="nudge.technique" keypath="hint.nudge.body" tag="p" scope="global">
                <template #unit>{{ nudgeUnit }}</template>
                <template #technique>
                  <button
                    @click="openNudgeLesson"
                    :title="$t('modal.openLesson')"
                    class="font-bold underline decoration-amber-600/60 underline-offset-2 hover:decoration-2"
                  >
                    {{ $t(`hint.move.${nudge.technique}.name`) }}
                  </button>
                </template>
              </i18n-t>
              <p v-else>{{ $t("hint.nudge.wrong", { unit: nudgeUnit }) }}</p>
              <button
                @click="handleTriggerHint"
                class="shrink-0 border border-amber-600/50 px-2 py-1 font-bold transition-colors hover:bg-amber-400/30"
              >
                {{ $t("hint.nudge.explain") }}
              </button>
            </div>

            <!-- Announces the Finish tile (in the controls) when it appears -->
            <p role="status" class="sr-only">{{ finishPath ? $t("game.finishBody") : "" }}</p>

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

            <!-- Finish fills the board by itself: inert holds every tap and key until the win. -->
            <div class="relative flex flex-col gap-3" :inert="finishing">
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
                :show-candidates="showCandidates && !activeComplexHint && !nudge"
                :theme="boardTheme"
                :nudge="nudge?.unit"
                @select-cell="handleSelectCell"
              />
              <div class="flex flex-col gap-2.5">
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
                  :can-finish="(!!finishPath || finishing) && !timer.isPaused.value"
                  @finish="handleFinish"
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
                class="pause-overlay absolute top-0 -right-1 -bottom-1 left-0 z-30 flex flex-col items-center justify-center gap-5 rounded-xl bg-zinc-50/90 backdrop-blur-md dark:bg-zinc-950/90"
              >
                <AppIcon
                  class="h-12 w-12 text-zinc-500"
                  path="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <p class="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {{ $t("game.pausedTitle") }}
                </p>
                <button
                  @click="timer.togglePause()"
                  class="tile tile-apply px-10 py-4 text-base font-black"
                >
                  {{ $t("game.resume") }}
                </button>
                <button
                  @click="openGameSettings"
                  class="flex items-center gap-2 text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                >
                  <AppIcon
                    class="h-4 w-4"
                    path="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  {{ $t("menu.settings") }}
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

      <!-- Settings over the game: a sheet at the side (the bottom on phones), the board in view. -->
      <dialog
        ref="settingsSheet"
        class="settings-sheet"
        :aria-label="$t('settings.title')"
        @close="settingsOverGame = false"
        @pointerdown="pressedOutside = $event.target === settingsSheet"
        @click="onSheetClick"
      >
        <SettingsScreen
          v-if="settingsOverGame"
          in-game
          :timed="!gameZen"
          @back-to-menu="settingsOverGame = false"
        />
      </dialog>

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
        :class="[isWinState ? 'modal-delay' : '', { 'win-done': winSkipped }]"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
        @pointerdown="winStep && skipWinSteps()"
      >
        <div
          class="modal-pop panel max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto !rounded-2xl border-t-[0.375rem] p-6 text-center shadow-2xl"
          :class="isWinState ? '!border-t-emerald-500' : '!border-t-rose-500'"
        >
          <h3 class="mb-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {{ modalTitle }}
          </h3>
          <p class="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {{ modalMessage }}
          </p>

          <!-- Star rating: each earned star fills in on its own step -->
          <div
            v-if="isWinState"
            class="mb-4 flex justify-center gap-1.5"
            role="img"
            :aria-label="$t('modal.stars', { n: winStars })"
          >
            <span
              v-for="n in 3"
              :key="n"
              :class="
                n <= winStars && winStep >= n
                  ? 'star-pop text-amber-400'
                  : 'text-zinc-300 dark:text-zinc-700'
              "
              class="text-3xl leading-none"
              aria-hidden="true"
              >★</span
            >
          </div>

          <!-- A clean win gets the teacher's red-pen stamp, last -->
          <div v-if="perfect" class="mb-4 flex justify-center">
            <span
              data-testid="perfect-stamp"
              class="perfect-stamp"
              :class="winStep >= winStepCount ? 'stamp-in' : 'opacity-0'"
              >{{ $t("modal.perfect") }}</span
            >
          </div>

          <p
            v-if="isWinState && reachedLevel"
            class="score-badge mb-4 border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-700 dark:text-violet-300"
          >
            ▲ {{ $t("level.up", { n: reachedLevel }) }}
          </p>
          <p
            v-for="note in isWinState ? progressNotes : []"
            :key="note.text"
            :class="
              note.ok
                ? 'score-badge border-emerald-500/40 bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-300 font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
            "
            class="mb-4 border px-3 py-2 text-xs"
          >
            {{ note.text }}
          </p>
          <p
            v-for="r in isWinState ? newRecords : []"
            :key="r.kind"
            data-testid="new-record"
            :class="scoreLanded ? 'win-in' : 'opacity-0'"
            class="mb-4 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-800 dark:text-amber-300"
          >
            {{ recordLine(r) }}
          </p>

          <!-- Score headline: the total counts up through the lines as they appear -->
          <div v-if="isWinState && lastScore" class="mb-5">
            <p class="text-[0.6875rem] font-semibold text-zinc-500">
              {{ $t("modal.scoreTotal") }}
            </p>
            <p
              class="text-5xl leading-tight font-black text-zinc-900 tabular-nums dark:text-zinc-50"
            >
              <span aria-hidden="true">{{ displayedScore }}</span>
              <span class="sr-only">{{ lastScore.total }}</span>
            </p>
            <p
              v-if="isNewBest"
              :class="scoreLanded ? 'win-in' : 'opacity-0'"
              class="mt-1 inline-block border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.625rem] font-black text-amber-800 dark:text-amber-300"
            >
              ★ {{ $t("modal.scoreNewBest") }}
            </p>

            <!-- breakdown -->
            <div
              class="mt-3 divide-y divide-zinc-200 border border-zinc-200 text-left text-xs dark:divide-zinc-800 dark:border-zinc-800"
            >
              <div
                v-for="(row, i) in scoreRows"
                :key="row.key"
                :class="winStep > winStars + i ? 'win-in' : 'opacity-0'"
                class="flex justify-between px-3 py-1.5"
              >
                <span class="text-zinc-500">{{ $t(`modal.${row.key}`) }}</span>
                <span :class="row.cls" class="font-bold tabular-nums"
                  >{{ i ? (row.value > 0 ? "+" : "−") : "" }}{{ Math.abs(row.value) }}</span
                >
              </div>
              <div
                :class="scoreLanded ? 'win-in' : 'opacity-0'"
                class="flex justify-between bg-zinc-500/5 px-3 py-1.5"
              >
                <span class="font-semibold text-zinc-500 dark:text-zinc-400">{{
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
              <span class="text-xs font-semibold text-zinc-500">{{ $t("modal.difficulty") }}</span>
              <span class="text-xs font-bold text-zinc-800 dark:text-zinc-200">{{
                difficultyLabel
              }}</span>
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold text-zinc-500">{{ $t("game.mistakes") }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  mistakes === 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
                >{{ mistakes }}{{ mistakeLimit && !gameZen ? ` / ${mistakeLimit}` : "" }}</span
              >
            </div>
            <div class="flex justify-between px-3 py-2">
              <span class="text-xs font-semibold text-zinc-500">{{ $t("modal.hintsUsed") }}</span>
              <span
                class="text-xs font-bold"
                :class="
                  hintsUsed === 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                "
                >{{ hintsUsed }}</span
              >
            </div>
            <div v-if="neededTechs.length" class="px-3 py-2" data-testid="needed-techniques">
              <p class="mb-2 text-xs font-semibold text-zinc-500">
                {{ $t("modal.needed") }}
              </p>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="id in neededTechs"
                  :key="id"
                  @click="openLesson(id)"
                  :title="$t('modal.openLesson')"
                  class="min-h-6 border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[0.6875rem] font-semibold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
                >
                  {{ $t(`hint.move.${id}.name`) }}
                </button>
              </div>
            </div>
            <div v-if="stuck.length" class="px-3 py-2" data-testid="stuck-moments">
              <p class="mb-2 text-xs font-semibold text-zinc-500">
                {{ $t("modal.stuck") }}
              </p>
              <ul class="space-y-1.5">
                <li
                  v-for="m in stuck"
                  :key="m.at"
                  class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"
                >
                  <span class="text-xs text-zinc-700 tabular-nums dark:text-zinc-300">{{
                    $t("modal.stuckAt", {
                      at: timer.formatTime(m.at),
                      gap: timer.formatTime(m.gap),
                    })
                  }}</span>
                  <button
                    v-if="m.technique"
                    @click="openLesson(m.technique!)"
                    :title="$t('modal.openLesson')"
                    class="min-h-6 border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[0.6875rem] font-semibold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
                  >
                    {{ $t(`hint.move.${m.technique}.name`) }}
                  </button>
                </li>
              </ul>
            </div>
            <div v-if="techniqueLog.length" class="px-3 py-2">
              <p class="mb-2 text-xs font-semibold text-zinc-500">
                {{ $t("modal.techniquesUsed") }}
              </p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="id in techniqueLog"
                  :key="id"
                  :title="$t('modal.usedTotal', { n: techStatsTotals[id] ?? 1 })"
                  class="border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-amber-700 dark:text-amber-400"
                  >{{ $t(`hint.move.${id}.name`) }}
                  <span class="opacity-70">×{{ techStatsTotals[id] ?? 1 }}</span></span
                >
              </div>
            </div>
          </div>

          <button @click="handleModalClose" class="tile tile-primary w-full py-3 text-sm font-bold">
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
          class="modal-pop panel w-full max-w-sm !rounded-2xl border-t-[0.375rem] !border-t-violet-500 p-6 text-center shadow-2xl"
        >
          <h3 class="mb-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {{ $t("resume.title") }}
          </h3>
          <p class="mb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {{
              $t(pendingResume.save.zen ? "resume.messageZen" : "resume.message", {
                difficulty: $t(`difficulty.${pendingResume.level}`),
                time: timer.formatTime(pendingResume.save.timerSeconds),
              })
            }}
          </p>
          <div class="flex flex-col gap-2">
            <button
              @click="handleResumeConfirm"
              class="tile tile-apply w-full py-3 text-sm font-bold"
            >
              {{ $t("resume.continue") }}
            </button>
            <button @click="handleResumeDecline" class="tile w-full py-3 text-sm font-bold">
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
/* A small menu tile: icon at the top, label at the bottom, like a cell's corner marks. */
.menu-cell {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem;
  text-align: left;
  font-family: var(--font-display);
  font-size: 0.8125rem;
  line-height: 1.15;
  font-weight: 700;
  color: var(--color-zinc-800);
}
.dark .menu-cell {
  color: var(--color-zinc-100);
}
.menu-cell.tile-amber {
  color: #422006;
}
.dark .menu-cell.tile-amber {
  color: #fde68a;
}

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
.modal-delay {
  animation: modal-delay 0.3s 0.9s ease-out both;
}
@keyframes modal-delay {
  from {
    opacity: 0;
    pointer-events: none;
  }
  to {
    opacity: 1;
    pointer-events: auto;
  }
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

/* A win-modal line appearing on its step. */
.win-in {
  animation: win-in 0.22s ease-out both;
}
@keyframes win-in {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }
}

/* "Perfect!" in the teacher's red pen, stamped on at a slant. */
.perfect-stamp {
  display: inline-block;
  padding: 0.2rem 0.8rem;
  border: 0.25rem double currentColor;
  border-radius: 0.375rem;
  color: var(--color-rose-700);
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-8deg);
}
.dark .perfect-stamp {
  color: var(--color-rose-300);
}
.stamp-in {
  animation: stamp-in 0.3s cubic-bezier(0.3, 1.3, 0.5, 1) both;
}
@keyframes stamp-in {
  0% {
    opacity: 0;
    transform: rotate(-8deg) scale(2.2);
  }
  65% {
    opacity: 1;
    transform: rotate(-8deg) scale(0.94);
  }
  100% {
    transform: rotate(-8deg) scale(1);
  }
}

/* Skipped (a tap or a key): everything is already in place. */
.win-done .win-in,
.win-done .star-pop,
.win-done .stamp-in {
  animation: none;
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
