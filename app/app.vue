<script setup lang="ts">
// Nuxt UI has no Serbian: its own strings stay English. Importing every locale cost 228 KB.
import { en as uiLocale } from "@nuxt/ui/locale";
import confetti from "canvas-confetti";

import type { PadKeys } from "./composables/useGamepad";
import type { GameSave, SaveSlot } from "./composables/useGameSave";
import type { WinResult } from "./composables/useWinResult";
import type { CellCoord, Difficulty, FlashCell, Grid, Variant } from "./types/sudoku";
import type { BasicsId } from "./utils/basics";
import type { Lesson } from "./utils/lesson";
import type { Mark } from "./utils/patternMarks";
import type { BoardTheme } from "./utils/preferenceValues";
import type { Level, Tier, Week } from "./utils/progression";
import type { Placement } from "./utils/stuckMoments";
import type { BoardUnit, DigitAt, SolveMove, TechniqueId } from "./utils/sudokuGrader";

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
  noteHighlight,
  noteTap,
  zen,
  diagonal,
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
  blueprint: ["#122646", "#0c3260"],
  chalkboard: ["#182017", "#1f2b25"],
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
// `arg` tunes the sound: the digit for a placement, units completed at once and the digit for a
// completion, the digit and those units for a finished digit (it waits for their chord), the
// star's number for a tick.
function cue(kind: keyof typeof CUES, ...arg: number[]) {
  const [sound, vibration] = CUES[kind];
  if (soundEnabled.value) (sound as (...a: number[]) => void)(...arg);
  if (vibration && hapticsEnabled.value) haptic(vibration);
}
// The game's rules: X-Sudoku ("Diagonal") is picked on the difficulty screen; Dailies, custom and
// practice boards are classic.
const gameVariant = ref<Variant>("classic");
const engine = useSudokuEngine(
  colorMode,
  computed(() => !highlightErrors.value),
  gameVariant,
);

const {
  currentBoard,
  initialBoard,
  solvedBoard,
  notesBoard,
  selectedCell,
  turn,
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
  hintMarks,
} = engine;

const gameSave = useGameSave();
const techStats = useTechniqueStats();
const achievements = useAchievements();
// Academy achievements: checked after each lesson, drill or course move (cheap: a few small
// storage reads), so the toast lands on the screen where it was earned.
function checkAcademyAchievements() {
  const done = techniquePath.getDone();
  const stars = techniquePath.getStars();
  const fresh = achievements.evaluateAcademy({
    lessons: ACADEMY_TECHNIQUES.filter((tech) => done.includes(tech.id)).length,
    pathTotal: ACADEMY_TECHNIQUES.length,
    threeStars: Object.values(stars).filter((s) => s === 3).length,
    basics: techniquePath.getBasics().length,
    basicsTotal: BASICS_IDS.length,
    spotBest: readSpotBest(readJSON<unknown>(SPOT_BEST_KEY, {})),
  });
  if (!fresh.length) return;
  toastIds.value.push(...fresh);
  saveToCloud();
}
function academyCue(kind: Parameters<typeof cue>[0]) {
  cue(kind);
  if (kind !== "mistake" && kind !== "hint") checkAcademyAchievements();
}
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
// The ISO week when the practice game is the technique of the week, whose win it marks.
const practiceWeek = ref<string | null>(null);
const techniquePath = useTechniquePath();
// The guided lesson on the lesson screen (TechniqueLesson keeps its own board).
const activeLesson = ref<Lesson | null>(null);
const lessonLevel = ref<Level>(1);
// The "How to play" lesson on the basics screen.
const activeBasics = ref<BasicsId>("rule");
function openBasics(id: BasicsId) {
  academyFromGame.value = false; // the course never returns to a game
  activeBasics.value = id;
  currentScreen.value = "basics";
}
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
const currentScreen = ref<
  | "menu"
  | "difficulty"
  | "daily"
  | "game"
  | "academy"
  | "custom-import"
  | "stats"
  | "achievements"
  | "settings"
  | "lesson"
  | "basics"
  | "spot"
>("menu");
// The clock, its holds, the pause and what goes over the paused game (useGameSession).
const {
  timer,
  clockHolds,
  isPaused,
  togglePause,
  settingsOverGame,
  SettingsSheet,
  openGameSettings,
  shortcutsOpen,
  touring,
  startTour,
  onScreenEntered,
  ControlsTour,
} = useGameSession({
  live: () => currentScreen.value === "game",
  finishing: () => finishing.value,
  onAway: () => (historyOpen.value = false),
});
// The Spot it tier being played (the spot screen).
const spotTier = ref<Tier>("Basic");
// Set when the spot screen plays the Daily review (these techniques) instead of a tier.
const spotReview = ref<TechniqueId[] | undefined>();
const spotRush = ref(false); // Puzzle rush rather than a timed round
// The screens with a board, which keep the normal size (see applyUiScale).
const BOARD_SCREENS = new Set(["game", "lesson", "spot", "basics"]);
// Display size (main.css multiplies the root font-size by --ui-scale) enlarges every screen but
// the game, whose board already fills the height: there a bigger rem would only shrink it. Set
// during setup, so the first paint is right, then as each screen enters (the screen Transition is
// out-in), so the screen leaving never jumps.
function applyUiScale() {
  const scale = BOARD_SCREENS.has(currentScreen.value) ? 1 : uiScale.value;
  document.documentElement.style.setProperty("--ui-scale", String(scale));
}
applyUiScale();
watch(uiScale, applyUiScale);
const activeDifficulty = ref<Difficulty>("medium");
// This game's stats row, also its name: the level's, or its X-Sudoku one (x_<level>).
const gameRow = computed(() => statsKey(activeDifficulty.value, false, gameVariant.value));
// What the dashboard chip and the win modal call this game, in the player's language.
const difficultyLabel = computed(() =>
  practiceTechnique.value
    ? `${practiceWeek.value ? t("weekly.title") : t("practice.label")} · ${t(`hint.move.${practiceTechnique.value}.name`)}`
    : isDailyMode.value
      ? t(`difficulty.${statsKey(activeDifficulty.value, true)}`)
      : gameZen.value
        ? `${t(`difficulty.${gameRow.value}`)} · ${t("difficulty.zen")}`
        : t(`difficulty.${gameRow.value}`),
);

const showModal = ref<boolean>(false);
const modalTitle = ref<string>("");
const modalMessage = ref<string>("");
const isWinState = ref<boolean>(false);
// "Watch your solve" plays on the game's own board: the step the win modal's replay is showing.
const replayFrame = ref<{ board: Grid; placed: Placement | null } | null>(null);
const noNotes = emptyNotes();

const pendingResume = ref<{ save: GameSave; level: SaveSlot } | null>(null);

const hintsUsed = ref<number>(0);
const techniqueLog = ref<TechniqueId[]>([]);
// Set when a nudge's technique opened the Academy: Back returns to the paused game.
const academyFromGame = ref(false);
// Still in the game, for state that should survive those detours (armed digit, nudge).
const inGame = computed(
  () =>
    currentScreen.value === "game" ||
    (["academy", "lesson", "spot"].includes(currentScreen.value) && academyFromGame.value),
);
// The Academy lesson to open on, when a win-modal chip led there.
const academyFocus = ref<TechniqueId | null>(null);
// Built when shown, so its row and column follow a turn of the board.
const mistakeExplainer = ref<(() => string) | null>(null);
// Every correct digit that went in, on the clock, for "Where you got stuck" on the win modal.
const placements = ref<Placement[]>([]);
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
const records = useRecords();
// The win modal's result (score, notes, records, what it took): null for a game over.
const winResult = ref<WinResult | null>(null);
const { recordWin } = useWinResult(t);

// Practice and custom boards don't count: a one-blank custom board could be won over and over.
const countsForRecords = () => !practiceTechnique.value && activeDifficulty.value !== "custom";

// The time to beat, read when a game opens (0 hides it): the fastest Daily in the Daily, else
// this difficulty's best. Custom and practice boards vary too much for a best to mean anything.
const bestTime = computed(() => {
  void currentScreen.value;
  if (practiceTechnique.value) return 0;
  if (activeDifficulty.value === "custom") return challengeTarget.value; // a friend's time, or none
  if (isDailyMode.value) return dailyPuzzle.getBestTime(activeDifficulty.value);
  return score.getStats().perDifficulty[gameRow.value]?.bestTime ?? 0;
});
// Lessons finished, read when the screen changes (a lesson ends on another screen), not per move.
const lessonsDone = computed(() => {
  void currentScreen.value;
  return techniquePath.getDone();
});
// The hint panel's "on this board" list: technique names. Only while no hint is open (below lg the
// idle panel is just this list, a strip under the numpad); a wrong entry is left out, as the solver
// takes every digit as true. It reads the player's notes, so a single their marks leave shows up.
const panelIdle = () => !activeComplexHint.value && currentScreen.value === "game";
const boardTechniques = computed<TechniqueId[]>(() => {
  if (!panelIdle()) return [];
  const board = rightDigits();
  return availableTechniques(board, notesEliminations(board, notesBoard.value), gameVariant.value);
});
// The names that are buttons: a pick opens that move as a hint starting at where to look
// (`handlePeek`). By the solver's own candidates, as hints are: a name only the player's notes
// put on the list stays text, since their marks may be a guess (and checking them against the
// answer would tell which guesses are right).
// ponytail: runs the finders a second time per move; share one pass while the notes rule out
// nothing the solver hasn't, if it ever shows in a profile.
const peekMoves = computed<SolveMove[]>(() => (panelIdle() ? engine.peekMoves() : []));
const peekable = computed(() => peekMoves.value.map((m) => m.technique));
function rightDigits(): Grid {
  return currentBoard.value.map((row, r) =>
    row.map((v, c) => (v && solvedBoard.value[r]![c] && v !== solvedBoard.value[r]![c] ? 0 : v)),
  );
}

// "You spotted it": a technique the player finished by hand (its last pencil mark taken out), drawn
// in pen over the board for a moment and named. Once per technique per game, so a common one
// doesn't keep interrupting.
const spotted = ref<{ technique: TechniqueId; marks: Mark[] } | null>(null);
const spottedSeen = new Set<TechniqueId>();
let spottedTimeout: ReturnType<typeof setTimeout> | undefined;
// Before the mark goes: the move is read off the notes that still hold it.
function spottedBy(r: number, c: number, num: number): SolveMove | null {
  const move = spottedMove(rightDigits(), notesBoard.value, { r, c, num }, gameVariant.value);
  return move && !spottedSeen.has(move.technique) ? move : null;
}
function showSpotted(move: SolveMove) {
  spottedSeen.add(move.technique);
  const notes = notesBoard.value;
  const cands = getGridCandidates(currentBoard.value, gameVariant.value);
  const noted = (r: number, c: number) => notes[r]![c]!.some(Boolean);
  const has = (r: number, c: number, n: number) =>
    noted(r, c) ? !!notes[r]![c]![n] : cands[r]![c]!.includes(n);
  spotted.value = {
    technique: move.technique,
    marks: withGhosts(patternMarks(move, has, true), noted),
  };
  say(t("game.spotted", { name: t(`hint.move.${move.technique}.name`) }));
  cue("unlock");
  clearTimeout(spottedTimeout);
  spottedTimeout = setTimeout(() => (spotted.value = null), 2800);
}

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
      variant: gameVariant.value === "x" ? "x" : undefined, // classic saves stay as they were
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
  winResult.value = null;
  showModal.value = true;
  activeDigit.value = pickedDigit.value = null;
  clockHolds.add("finished");
  const practised = practiceTechnique.value;
  // Read before this game's save is cleared: a level open only through it isn't news.
  const lockedBefore =
    win && !practised ? lockedLevels(score.unlockWins(), (d) => !!gameSave.loadDifficulty(d)) : [];
  if (!practised)
    gameSave.clearDifficulty(
      isDailyMode.value
        ? dailySlot(activeDifficulty.value)
        : gameSlot(activeDifficulty.value, gameVariant.value),
    );
  if (!win) return;
  cue("win");
  flashWin();
  const { result, toasts, opened, unlock } = recordWin({
    difficulty: activeDifficulty.value,
    variant: gameVariant.value,
    daily: isDailyMode.value,
    dailyDate,
    zen: gameZen.value,
    practice: practised,
    week: practiceWeek.value,
    seconds: timer.timerSeconds.value,
    mistakes: mistakes.value,
    hints: hintsUsed.value,
    colorMode: colorMode.value,
    challengeTarget: challengeTarget.value,
    initialBoard: initialBoard.value,
    placements: placements.value,
    lockedBefore,
  });
  winResult.value = result;
  toastIds.value.push(...toasts);
  justUnlocked.value ??= opened;
  if (unlock) cue("unlock");
  // Drops of the board's inks rather than paper confetti.
  confetti({
    disableForReducedMotion: true,
    shapes: ["circle"],
    particleCount: 160,
    spread: 80,
    origin: { y: 0.55 },
    colors: ["#17294a", "#2a52a8", "#8aabe2", "#ffe680", "#c2352b"],
  });
}

// The modal's Next puzzle: a level the win just opened, else the same level again (after a Daily,
// which has one puzzle a day, a regular game of its level). None for practice and custom boards.
const justUnlocked = ref<Difficulty | null>(null);
const nextLevel = computed<Difficulty | null>(() => {
  if (practiceTechnique.value || activeDifficulty.value === "custom") return null;
  if (justUnlocked.value) return justUnlocked.value;
  return activeDifficulty.value;
});
// Starting: the modal stays up (its button busy) until the board is ready, so the won board is
// never live again in between. A saved game at that level goes through the usual resume prompt.
const nextLoading = ref(false);
async function handleNextPuzzle() {
  const level = nextLevel.value;
  if (!level || nextLoading.value) return;
  const variant = gameVariant.value;
  if (gameSave.loadDifficulty(gameSlot(level, variant))) {
    handleModalClose();
    currentScreen.value = "difficulty";
    handleChooseDifficulty(level, variant);
    return;
  }
  nextLoading.value = true;
  // Straight to the next board (the menu would cancel its start), Zen (or X) if this game was.
  await handleStartGame(level, { zen: gameZen.value, variant, ready: closeModal });
  nextLoading.value = false;
}

// Ends the game if the board is solved (a placement, a hint, Finish or redo); `message` replaces
// the usual one.
function checkWin(message?: string) {
  if (!checkWinCondition()) return false;
  triggerLocalModal(t("modal.win"), message ?? winMessage(), true);
  return true;
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

function closeModal() {
  showModal.value = false;
  finishing.value = false; // a Finish-button win ends with it set
  justUnlocked.value = null;
  practiceTechnique.value = null;
  isDailyMode.value = false;
  clockHolds.clear();
  timer.timerSeconds.value = 0;
}
function handleModalClose() {
  closeModal();
  academyFromGame.value = false;
  currentScreen.value = "menu";
}

// A win-modal chip: straight into the technique's lesson (its Back lands on the Academy card).
function openLesson(id: TechniqueId) {
  handleModalClose();
  academyFromGame.value = false;
  academyFocus.value = id;
  currentScreen.value = "academy";
  handleLesson(id, 1); // a technique the game just needed: learned from the start, guided
}

// Every way into a game: `load` puts the board in; a resumed save brings its counts and clock.
function beginGame(
  difficulty: Difficulty,
  load: () => void,
  {
    daily = "",
    zen: zenGame = false,
    practice = null,
    save,
    variant = "classic",
  }: {
    daily?: string;
    zen?: boolean;
    practice?: TechniqueId | null;
    save?: GameSave;
    variant?: Variant;
  } = {},
) {
  practiceTechnique.value = practice;
  gameVariant.value = variant;
  isDailyMode.value = !!daily;
  dailyDate = daily;
  gameZen.value = zenGame;
  load();
  activeDifficulty.value = difficulty;
  mistakes.value = save?.mistakes ?? 0;
  say(t(save ? "game.ready" : "game.newBoard"));
  mistakeExplainer.value = null;
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = save?.hintsUsed ?? 0;
  techniqueLog.value = [];
  spottedSeen.clear();
  spotted.value = null;
  placements.value = save ? restorePlacements(save) : [];
  // On the game screen with nothing holding it, the clock runs.
  clockHolds.clear();
  timer.timerSeconds.value = save?.timerSeconds ?? 0;
  currentScreen.value = "game";
}

function resumeSavedGame(s: GameSave) {
  beginGame(s.difficulty, () => restoreGame(s), {
    daily: s.daily,
    zen: s.zen,
    save: s,
    variant: s.variant ?? "classic",
  });
}

// A board still generating when the player picks again, or leaves the screen, is dropped.
let startToken = 0;
watch(currentScreen, () => startToken++);
async function handleStartGame(
  level: Difficulty,
  {
    zen: zenGame = zen.value,
    variant = (diagonal.value ? "x" : "classic") as Variant,
    ready = () => {},
  } = {},
) {
  const token = ++startToken;
  const generated = await takePuzzle(level, variant);
  if (token !== startToken) return;
  ready();
  gameSave.clearDifficulty(gameSlot(level, variant));
  beginGame(level, () => startNewGame(level, generated), { zen: zenGame, variant });
}

// A difficulty already has a saved game — ask before silently overwriting it. X-Sudoku games
// have their own slot per level.
function handleChooseDifficulty(
  level: Difficulty,
  variant: Variant = diagonal.value ? "x" : "classic",
) {
  const slot = gameSlot(level, variant);
  const existing = gameSave.loadDifficulty(slot);
  if (existing) {
    pendingResume.value = { save: existing, level: slot };
  } else if (lockOf(level, score.unlockWins())) {
    return; // the selector shows it locked; never start one past it
  } else {
    handleStartGame(level, { variant });
  }
}

function handleResumeConfirm() {
  if (!pendingResume.value) return;
  resumeSavedGame(pendingResume.value.save);
  pendingResume.value = null;
}

function handleResumeDecline() {
  if (!pendingResume.value) return;
  const { save } = pendingResume.value;
  if (save.daily) startDaily(save.difficulty);
  else handleStartGame(save.difficulty, { variant: save.variant ?? "classic" });
  pendingResume.value = null;
}

const { activeDigit, pickedDigit, handleNumpad, handleSelectCell, handleKeyDown } = useGameInput({
  digitFirst,
  noteTap,
  selectedCell,
  initialBoard,
  currentBoard,
  numberCounts,
  notesMode,
  inGame,
  // A sheet over the game takes the keys. Read the real dialog state, not the v-models: Esc
  // closes a dialog at once but its close event (which clears the model) comes a task later, so a
  // key pressed right after Esc would be dropped.
  // practiceLoading: a lesson opening over the paused game must keep it paused.
  hasKeys: () =>
    !showModal.value && // EndModal's own keys
    currentScreen.value === "game" &&
    !document.body.classList.contains("driver-active") && // the tour has the keys
    !document.querySelector("dialog[open]") &&
    !practiceLoading.value,
  paused: () => isPaused.value,
  finishing: () => finishing.value,
  turn,
  act: {
    input: handleInputNumber,
    erase: () => eraseCell(selectedCell.value),
    undo,
    redo,
    hint: handleTriggerHint,
    turn: () => turn.value++,
    autoNotes: handleAutoFillNotes,
    history: openHistory,
    pause: togglePause,
    shortcuts: () => (shortcutsOpen.value = true),
  },
});

// A correct placement may finish a row, column, and/or box, or the last of a digit — flash every
// cell of each newly-completed unit (engine.completedAt decides what is complete).
function flashCompletedUnits(r: number, c: number) {
  // Cells ripple outward from the digit just placed: 45 ms per step of distance.
  const RIPPLE_MS = 45;
  const { units, done, digitDone, cells } = engine.completedAt(r, c);
  if (!cells.length) return;
  if (done.length) {
    clearTimeout(doneTimeout);
    doneUnits.value = done;
    doneTimeout = setTimeout(() => (doneUnits.value = []), 2000);
  }
  const num = currentBoard.value[r]![c]!;
  if (units) cue("complete", units, num);
  if (digitDone) cue("digit", num, units);
  runFlash(
    cells.map((p) => ({
      ...p,
      delay: Math.max(Math.abs(p.r - r), Math.abs(p.c - c)) * RIPPLE_MS,
    })),
  );
}

// The pen strokes for the units a digit just finished, cleared once they've faded.
const doneUnits = ref<BoardUnit[]>([]);
let doneTimeout: ReturnType<typeof setTimeout> | undefined;

// Longest delay + the 0.7 s animation, with headroom, then clear so the next flash can replay.
function runFlash(cells: FlashCell[]) {
  if (flashTimeout) clearTimeout(flashTimeout);
  flashCells.value = cells;
  const longest = Math.max(...cells.map((c) => c.delay));
  flashTimeout = setTimeout(() => {
    flashCells.value = [];
  }, longest + 900);
}

// Winning sweeps a diagonal wave across the whole board, from its top-left corner as shown,
// before the result appears.
function flashWin() {
  const cells: FlashCell[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = turnCell({ r, c }, turn.value);
      cells.push({ r, c, delay: (p.r + p.c) * 45 });
    }
  }
  runFlash(cells);
}

function handleInputNumber(num: number) {
  if (isPaused.value || showModal.value || finishing.value || !selectedCell.value) return;
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
    const spot = notesBoard.value[r]![c]![num] ? spottedBy(r, c, num) : null;
    notesBoard.value[r]![c]![num] = !notesBoard.value[r]![c]![num];
    if (spot) showSpotted(spot);
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
            // Named as the board shows: a turned board's data row is a column on screen.
            const at = turnCell({ r, c }, turn.value);
            const inRow = conflicts.some((cc) => turnCell(cc, turn.value).r === at.r);
            const inCol = conflicts.some((cc) => turnCell(cc, turn.value).c === at.c);
            const sameBox = (cc: CellCoord) =>
              Math.floor(cc.r / 3) === Math.floor(r / 3) &&
              Math.floor(cc.c / 3) === Math.floor(c / 3);
            const inBox = conflicts.some(sameBox);
            // X-Sudoku: what's left clashes only along a diagonal.
            const inDiag = conflicts.some((cc) => cc.r !== r && cc.c !== c && !sameBox(cc));
            const where = inRow
              ? t("game.whereRow", { n: at.r + 1 })
              : inCol
                ? t("game.whereCol", { n: at.c + 1 })
                : inBox
                  ? t("game.whereBox")
                  : inDiag
                    ? t("game.whereDiag")
                    : t("game.whereCell");
            say(t("game.conflictWith", { where }));
            const first = conflicts[0]!;
            const key = gameVariant.value === "x" ? "game.whyConflictX" : "game.whyConflict";
            const label = digitLabel(num, colorMode.value, t);
            mistakeExplainer.value = () => {
              const p = turnCell(first, turn.value);
              return t(key, { num: label, r: p.r + 1, c: p.c + 1 });
            };
          } else {
            say(t("game.wrongDigit"));
            const text = t("game.whyWrong", { num: digitLabel(num, colorMode.value, t) });
            mistakeExplainer.value = () => text;
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
        mistakeExplainer.value = null;
        clearRelationalNotes(r, c, num);
        logPlacement({ r, c, num });
        // The ripple and its chime confirm correctness, so they're off with mistake highlighting.
        // A winning move gets the win's wave and cue alone, not three stacked on each other.
        if (!checkWin() && highlightErrors.value) flashCompletedUnits(r, c);
      }
    }
  }
}

// Stepped through, or applied at once: the hint's move goes in the log and costs a hint, then the
// game is won or the status line says what changed.
function afterHint(move: SolveMove | null, applied: string, winMsg?: string) {
  const tech = move?.technique; // none for a wrong-entry hint
  const placed = move?.placement;
  engine.showApplied(move);
  if (placed) logPlacement(placed);
  if (tech) {
    if (!techniqueLog.value.includes(tech)) techniqueLog.value.push(tech);
    techStats.record(tech);
  }
  chargeHint();
  if (placed) cue("place", placed.num);
  if (!checkWin(winMsg))
    say(t(!tech ? "game.wrongCleared" : placed ? applied : "game.candidatesCleared"));
}

function handleNextStep() {
  const move = engine.activeMove.value; // gone once the hint is applied
  nextHintStep(() =>
    afterHint(
      move,
      "game.cellFilled",
      gameZen.value
        ? undefined
        : t("modal.winHintMsg", { time: timer.formatTime(timer.timerSeconds.value) }),
    ),
  );
}

const { nudge, nudgeUnit, showNudge, chargeHint } = useNudge(engine, hintsUsed, inGame);
watch(currentScreen, () => (finishing.value = false));

// A technique named in a hint or nudge opens its step-by-step lesson; the game waits, paused,
// and the lesson's Back returns to it.
function openGameLesson(id: TechniqueId | null | undefined) {
  if (!id || practiceLoading.value) return;
  clockHolds.add("paused");
  academyFromGame.value = true;
  academyFocus.value = id;
  handleLesson(id, 1); // stuck on it in a game: learned from the start, guided
}
const openNudgeLesson = () => openGameLesson(nudge.value?.technique);

function handleTriggerHint() {
  // On a peek's "where to look", Hint shows the pattern: applying there would skip the lesson.
  if (engine.lookUnit.value) return handleNextStep();
  if (activeComplexHint.value) {
    handleInstantApplyHint();
    return;
  }
  if (hintStyle.value === "nudge" && showNudge()) {
    cue("hint");
    return;
  }
  nudge.value = null;
  cue("hint");
  say(triggerComplexHint());
}

// A technique picked from the panel's list: its hint, from "where to look" on. Free to look at,
// a hint once applied, like any other.
function handlePeek(id: TechniqueId) {
  openPeek(peekMoves.value.find((m) => m.technique === id));
}
function openPeek(move: SolveMove | null | undefined) {
  if (!move || finishing.value || isPaused.value) return;
  nudge.value = null;
  cue("hint");
  say(engine.peekMove(move));
}

// "Can this go?": the selected cell's pencil marks, each a question whether anything on the board
// rules it out: a digit its units already hold, or a move a peek would open (by the solver's
// candidates, never the answer key, so it can't tell a right guess from a wrong one). Free to ask;
// opening the move is a peek, a hint once applied.
// Below lg the idle panel is only the list of what's on the board: up while there is one to show.
const techniqueStrip = computed(
  () => boardTechniques.value.length > 0 && !nudge.value && !isPaused.value,
);
const canGoDigits = computed(() => {
  const at = selectedCell.value;
  if (!at || activeComplexHint.value || isPaused.value || finishing.value) return [];
  if (currentBoard.value[at.r]![at.c]) return [];
  return notesBoard.value[at.r]![at.c]!.flatMap((on, n) => (on ? [n] : []));
});
const canGo = ref<{ num: number; clash: CellCoord | null; move: SolveMove | null } | null>(null);
// Any other cell or any change to the board makes the answer stale.
watch(selectedCell, () => (canGo.value = null));
watch(boardHistory, () => (canGo.value = null), { deep: 1 });
const canGoAnswer = computed(() => {
  if (!canGo.value) return "";
  const { num, clash, move } = canGo.value;
  const label = digitLabel(num, colorMode.value, t);
  if (clash) {
    const p = turnCell(clash, turn.value);
    return t("hint.canGo.clash", { num: label, r: p.r + 1, c: p.c + 1 });
  }
  return move
    ? t("hint.canGo.yes", { num: label, name: t(`hint.move.${move.technique}.name`) })
    : t("hint.canGo.no", { num: label });
});
function askCanGo(num: number) {
  const at = selectedCell.value;
  if (!at) return;
  const clash = engine.getConflictCells(at.r, at.c, num)[0] ?? null;
  canGo.value = {
    num,
    clash,
    move: clash ? null : removerOf(engine.peekMoves(), { ...at, num }),
  };
  say(canGoAnswer.value);
}
// The strip goes with the selection: hand focus to the opened hint's Next.
const hintPanel = ref<{ focusNext: () => void } | null>(null);
async function showCanGo() {
  openPeek(canGo.value?.move);
  await nextTick();
  hintPanel.value?.focusNext();
}

function handleInstantApplyHint() {
  if (!activeComplexHint.value) return;
  const move = engine.activeMove.value;
  engine.applyComplexHint();
  afterHint(move, "game.instantApplied", t("modal.winInstantMsg"));
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
  return singlesPath(currentBoard.value, gameVariant.value);
});

const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
// The clock stops at the press; the cells fill one by one in solve order, each with its own
// flash and placement cue (all at once under reduced motion), then the usual win flow runs.
async function handleFinish() {
  const path = finishPath.value;
  if (!path || finishing.value || isPaused.value) return;
  finishing.value = true;
  clockHolds.add("finished");
  cancelComplexHint();
  engine.resetHintChain();
  nudge.value = null;
  activeDigit.value = pickedDigit.value = null;
  selectedCell.value = null;
  const token = startToken; // bumped if the player exits mid-cascade
  const instant = reducedMotion.value;
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
  if (!checkWin()) {
    // Shouldn't happen (the board is inert meanwhile), but never leave the game locked.
    finishing.value = false;
    clockHolds.delete("finished");
  }
}

function handleAutoFillNotes() {
  engine.autoFillNotes();
  say(t("game.notesFilled"));
}

// Only today's Daily can be resumed; one saved on an earlier day is dropped.
function handleStartDaily(level: Difficulty) {
  const saved = gameSave.loadDifficulty(dailySlot(level));
  if (saved?.daily === dailyPuzzle.todayKey())
    pendingResume.value = { save: saved, level: dailySlot(level) };
  else startDaily(level);
}

// Generated (in the worker) only when that level's Daily starts, so the menu never builds six
// boards; its tile shows busy meanwhile. Dropped, like a new game, if the player leaves first.
const dailyLoading = ref<Difficulty | null>(null);
watch(currentScreen, () => (dailyLoading.value = null));
async function startDaily(level: Difficulty) {
  const date = dailyPuzzle.todayKey();
  const token = ++startToken;
  dailyLoading.value = level;
  try {
    const board = await makeDailyBoard(date, level);
    if (token !== startToken) return;
    gameSave.clearDifficulty(dailySlot(level));
    beginGame(level, () => loadCustomBoard(board), { daily: date });
  } finally {
    // Not a newer start's: that one is still generating.
    if (token === startToken) dailyLoading.value = null;
  }
}

// A friend's time from a challenge code (Your puzzle), shown as the time to beat; 0 = none.
const challengeTarget = ref(0);
function handleLoadCustomPuzzle(
  board: Grid,
  practice: TechniqueId | null = null,
  challengeSeconds = 0,
) {
  challengeTarget.value = practice ? 0 : challengeSeconds;
  practiceWeek.value = null;
  beginGame("custom", () => loadCustomBoard(board), { practice });
}

let practiceToken = 0;
// The worker takes a seed, not an rng: a random one is as random as Math.random was.
const randomSeed = () => Math.floor(Math.random() * 2 ** 32);
// `week` set: the technique of the week, seeded so everyone gets the same board that week.
async function handlePractice(technique: TechniqueId, week: Week | null = null) {
  if (practiceLoading.value) return; // a double-click must not start two searches
  practiceLoading.value = true;
  const token = ++practiceToken;
  try {
    const from = currentScreen.value; // the Academy, or a finished lesson's "Try a full puzzle"
    const p = await practicePuzzle(technique, week ? seedFromString(week.seed) : randomSeed());
    // The player may have left while the search ran; don't yank them into a game.
    if (token !== practiceToken || currentScreen.value !== from) return;
    handleLoadCustomPuzzle(p.board, technique);
    practiceWeek.value = week?.key ?? null;
    if (p.notes) {
      for (const [key, digits] of Object.entries(p.notes)) {
        const [r, c] = key.split("-").map(Number) as [number, number];
        for (const d of digits) notesBoard.value[r]![c]![d] = true;
      }
      say(t("practice.drill"));
    } else {
      say(t("practice.puzzle"));
    }
  } finally {
    practiceLoading.value = false;
  }
}

// A guided lesson: the same search as practice, then the solver's replay to where it applies.
// With no level (the Academy, the path), at the first level not finished yet; a technique a game or
// a drill showed was missed opens at level 1.
async function handleLesson(technique: TechniqueId, level?: Level) {
  if (practiceLoading.value) return;
  practiceLoading.value = true;
  const token = ++practiceToken;
  try {
    const from = currentScreen.value; // the Academy, or a finished lesson's next one
    const at = level ?? techniquePath.lessonLevel(technique);
    // A test pins the position with window.lessonSeed; players get a fresh one.
    const seed = (window as { lessonSeed?: number }).lessonSeed ?? randomSeed();
    const lesson = await guidedLesson(technique, seed, at);
    if (token !== practiceToken || currentScreen.value !== from) return;
    activeLesson.value = lesson;
    lessonLevel.value = at;
    currentScreen.value = "lesson";
  } finally {
    practiceLoading.value = false;
  }
}

function exitToMenu() {
  academyFromGame.value = false; // the game is over: no lesson or Academy returns to it
  practiceTechnique.value = null;
  isDailyMode.value = false;
  cancelComplexHint(); // off the game screen, the clock stops
  currentScreen.value = "menu";
}

// Undo/redo can both change whether the board is solved, so route them through the same win
// check as a placement; and never act behind a modal (a second win would double-record).
function undo() {
  if (showModal.value || practiceLoading.value) return;
  const before = currentBoard.value.map((row) => [...row]);
  undoMove();
  logRestored(before);
}
function redo() {
  if (showModal.value || practiceLoading.value) return;
  const before = currentBoard.value.map((row) => [...row]);
  redoMove();
  logRestored(before);
  checkWin();
}
// Undo and redo swap in a whole board: a correct digit they bring back goes in the log too, or the
// replay would end on an empty cell.
function logRestored(before: Grid) {
  currentBoard.value.forEach((row, r) =>
    row.forEach((num, c) => {
      if (
        num &&
        num !== before[r]![c] &&
        !initialBoard.value[r]![c] &&
        num === solvedBoard.value[r]![c]
      )
        logPlacement({ r, c, num });
    }),
  );
}

// The move history (hold Undo/Redo, Shift+Z, LT): a slider over every kept state.
const historyOpen = ref(false);
const historyLength = computed(() => boardHistory.value.length + redoHistory.value.length);
function openHistory() {
  if (historyLength.value && !showModal.value && !practiceLoading.value) historyOpen.value = true;
}
function jumpHistory(step: number) {
  if (showModal.value || practiceLoading.value || isPaused.value) return;
  const before = currentBoard.value.map((row) => [...row]);
  engine.jumpTo(step);
  logRestored(before);
  checkWin();
}

// Controllers (usePad): B off the board needs to know the screens, and each board's keys.
// B off the board: closes what's on top, else goes where the screen's own Back goes.
function padBack() {
  if (touring.value) return (touring.value = false);
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (dialog) return dialog.close();
  if (showModal.value) return handleModalClose();
  if (pendingResume.value) return (pendingResume.value = null);
  if (currentScreen.value === "game") return sendKey("p"); // paused: resume
  if (currentScreen.value === "academy")
    return (currentScreen.value = academyFromGame.value ? "game" : "menu");
  if (
    ["difficulty", "daily", "stats", "achievements", "settings", "custom-import"].includes(
      currentScreen.value,
    )
  )
    return (currentScreen.value = "menu");
  sendKey("Escape"); // the Academy's boards handle their own Back
}
// LB/RB pick the digit that A (game) or X (Academy boards) enters.
function padKeys(digit: number): PadKeys {
  if (currentScreen.value === "game")
    return {
      press: String(digit),
      alt: "n",
      back: "Backspace",
      hint: "h",
      pause: "p",
      help: "?",
      history: "Z",
      turn: "r",
    };
  // A presses a focused button; How to play has no cells to tap, so there A enters the digit too.
  return {
    press: currentScreen.value === "basics" ? String(digit) : "Enter",
    alt: String(digit),
    back: "Escape",
    hint: "h",
    history: "l", // a lesson's other level
    clicks: true,
  };
}
const { connected: padConnected, digit: padDigit } = usePad({
  onBoard: () =>
    BOARD_SCREENS.has(currentScreen.value) &&
    padScope() === document &&
    !(currentScreen.value === "game" && isPaused.value),
  boardKeys: padKeys,
  onBack: padBack,
  onPause: () => {
    if (currentScreen.value === "game") sendKey("p");
  },
});

useEventListener(window, "keydown", handleKeyDown);
onMounted(() => {
  // Progress made before these achievements existed, or just restored from the cloud.
  checkAcademyAchievements();
});
onUnmounted(() => {
  if (flashTimeout) clearTimeout(flashTimeout);
});
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="app-shell flex min-h-screen w-full flex-col bg-[var(--ground)] text-zinc-900 antialiased dark:text-zinc-100"
    >
      <Transition
        name="screen"
        mode="out-in"
        @before-enter="applyUiScale"
        @after-enter="onScreenEntered"
      >
        <!-- MENU -->
        <MainMenu
          v-if="currentScreen === 'menu'"
          @go="(screen) => (currentScreen = screen)"
          @daily="currentScreen = 'daily'"
          @academy="
            academyFocus = null;
            academyFromGame = false;
            currentScreen = 'academy';
          "
          @basics="openBasics('rule')"
        />

        <!-- DIFFICULTY -->
        <DifficultySelector
          v-else-if="currentScreen === 'difficulty'"
          :active-difficulty="activeDifficulty"
          @select-difficulty="handleChooseDifficulty"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- TODAY'S DAILIES: the same tiles, one Daily per level -->
        <DifficultySelector
          v-else-if="currentScreen === 'daily'"
          daily
          :active-difficulty="activeDifficulty"
          :busy="dailyLoading"
          @select-difficulty="handleStartDaily"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- ACADEMY -->
        <LazySudokuAcademy
          v-else-if="currentScreen === 'academy'"
          :focus="academyFocus"
          :in-game="academyFromGame"
          @back-to-menu="currentScreen = academyFromGame ? 'game' : 'menu'"
          @practice="handlePractice"
          @lesson="handleLesson"
          @basics="openBasics"
          @weekly="(week) => handlePractice(week.technique, week)"
          @spot="
            (tier, rush) => {
              spotTier = tier;
              spotRush = rush;
              spotReview = undefined;
              currentScreen = 'spot';
            }
          "
          @review="
            (ids) => {
              spotReview = ids;
              currentScreen = 'spot';
            }
          "
        />

        <!-- SPOT IT (and the Daily review, which plays the same way) -->
        <LazySpotIt
          v-else-if="currentScreen === 'spot'"
          :tier="spotTier"
          :review="spotReview"
          :rush="spotRush"
          @cue="academyCue"
          @back="currentScreen = 'academy'"
          @lesson="(id: TechniqueId) => handleLesson(id, 1)"
        />

        <!-- HOW TO PLAY -->
        <LazyBasicsLesson
          v-else-if="currentScreen === 'basics'"
          :key="activeBasics"
          :id="activeBasics"
          @cue="academyCue"
          @back="
            academyFocus = null;
            currentScreen = 'academy';
          "
          @basics="openBasics"
          @lesson="handleLesson"
        />

        <!-- GUIDED LESSON -->
        <LazyTechniqueLesson
          v-else-if="currentScreen === 'lesson' && activeLesson"
          :key="activeLesson.technique + lessonLevel + activeLesson.board.flat().join('')"
          :lesson="activeLesson"
          :level="lessonLevel"
          @cue="academyCue"
          :in-game="academyFromGame"
          @back="
            academyFocus = activeLesson.technique;
            currentScreen = academyFromGame ? 'game' : 'academy';
          "
          @practice="handlePractice(activeLesson.technique)"
          @lesson="handleLesson"
        />

        <!-- STATISTICS -->
        <LazyStatsScreen
          v-else-if="currentScreen === 'stats'"
          @back-to-menu="currentScreen = 'menu'"
          @start-game="currentScreen = 'difficulty'"
        />

        <!-- ACHIEVEMENTS -->
        <LazyAchievementsScreen
          v-else-if="currentScreen === 'achievements'"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- SETTINGS -->
        <LazySettingsScreen
          v-else-if="currentScreen === 'settings'"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- CUSTOM IMPORT -->
        <LazyCustomImport
          v-else-if="currentScreen === 'custom-import'"
          @load-puzzle="(board, seconds) => handleLoadCustomPuzzle(board, null, seconds)"
          @back-to-menu="currentScreen = 'menu'"
        />

        <!-- GAME -->
        <div
          v-else-if="currentScreen === 'game'"
          class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-2 py-2 3xl:max-w-[118.75rem] 3xl:grid-cols-[15rem_minmax(0,1fr)_26.25rem] 3xl:gap-6 3xl:px-8 sm:px-5 sm:py-3 lg:grid lg:gap-6 lg:max-3xl:grid-cols-12"
        >
          <!-- Screen readers hear what sighted players see on the board: "Wrong digit here!" etc. -->
          <p class="sr-only" aria-live="polite">{{ announcement }}</p>
          <GameLegend :diagonal="gameVariant === 'x'" :theme="boardTheme" />

          <!-- Center / main game column -->
          <div class="flex w-full flex-col 3xl:col-span-1 lg:gap-3 lg:max-3xl:col-span-7">
            <GameDashboard
              :formatted-time="timer.formatTime(timer.timerSeconds.value)"
              :is-paused="isPaused"
              :mistakes="mistakes"
              :max-mistakes="mistakeLimit"
              :show-timer="showTimer && !gameZen"
              :best-time="bestTime ? timer.formatTime(bestTime) : ''"
              :challenge="challengeTarget > 0 && activeDifficulty === 'custom'"
              :past-best="bestTime > 0 && timer.timerSeconds.value > bestTime"
              :show-mistakes="highlightErrors && !gameZen"
              :difficulty="difficultyLabel"
              @toggle-pause="!finishing && togglePause()"
              @turn="turn++"
              @exit-game="exitToMenu"
            />

            <NudgeBanner
              v-if="nudge"
              :technique="nudge.technique"
              :unit="nudgeUnit"
              @lesson="openNudgeLesson"
              @explain="handleTriggerHint"
            />

            <!-- Announces the Finish tile (in the controls) when it appears -->
            <p role="status" class="sr-only">{{ finishPath ? $t("game.finishBody") : "" }}</p>

            <!-- Why-wrong explainer -->
            <div
              v-if="mistakeExplainer"
              class="flex items-start justify-between gap-2 border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300"
            >
              <p>{{ mistakeExplainer() }}</p>
              <button
                @click="mistakeExplainer = null"
                :aria-label="$t('modal.close')"
                class="shrink-0 px-1 font-bold transition-colors hover:text-rose-900 dark:hover:text-rose-100"
              >
                ✕
              </button>
            </div>

            <!-- Finish fills the board by itself: inert holds every tap and key until the win. -->
            <div class="relative flex flex-col gap-3" :inert="finishing">
              <!-- Read out by say(); this is the sighted copy, over the board's top edge. -->
              <Transition name="spot">
                <p
                  v-if="spotted"
                  aria-hidden="true"
                  data-testid="spotted"
                  class="pointer-events-none absolute top-2 left-1/2 z-30 -translate-x-1/2 border border-emerald-600/40 bg-emerald-50 px-3 py-1 text-sm font-bold whitespace-nowrap text-emerald-800 shadow-md dark:border-emerald-400/40 dark:bg-emerald-950 dark:text-emerald-200"
                >
                  {{ $t("game.spotted", { name: $t(`hint.move.${spotted.technique}.name`) }) }}
                </p>
              </Transition>
              <SudokuGrid
                v-if="replayFrame && showModal"
                data-testid="replay-board"
                :current-board="replayFrame.board"
                :initial-board="initialBoard"
                :solved-board="solvedBoard"
                :notes-board="noNotes"
                :selected-cell="null"
                :active-hint-cell="replayFrame.placed"
                :hint-triggers="[]"
                :hint-eliminations="[]"
                :conflict-cells="[]"
                :color-mode="colorMode"
                :flash-cells="[]"
                :show-errors="false"
                :theme="boardTheme"
                :diagonal="gameVariant === 'x'"
                :turn="turn"
              />
              <SudokuGrid
                v-else
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
                :active-digit="activeDigit ?? pickedDigit"
                :show-candidates="showCandidates && !activeComplexHint && !nudge"
                :plain-notes="!noteHighlight"
                :theme="boardTheme"
                :nudge="nudge?.unit ?? engine.lookUnit.value"
                :marks="spotted?.marks ?? hintMarks"
                :diagonal="gameVariant === 'x'"
                :turn="turn"
                :done="doneUnits"
                @select-cell="handleSelectCell"
              />
              <div class="flex flex-col gap-2.5">
                <ControlPanel
                  :notes-mode="notesMode"
                  :can-undo="boardHistory.length > 0"
                  :can-redo="redoHistory.length > 0"
                  @undo="undo"
                  @redo="redo"
                  @history="openHistory"
                  @erase="eraseCell(selectedCell)"
                  @toggle-notes="notesMode = !notesMode"
                  @trigger-hint="handleTriggerHint"
                  @auto-notes="handleAutoFillNotes"
                  :can-finish="(!!finishPath || finishing) && !isPaused"
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

              <PauseOverlay
                v-if="isPaused"
                @resume="togglePause()"
                @settings="openGameSettings"
                @shortcuts="shortcutsOpen = true"
              />
            </div>
          </div>

          <!-- Right / hint panel. Below lg it sits under the numpad: the open hint, or while idle
               just the "on this board" strip (none during a nudge or the pause) and "Can this
               go?". -->
          <div
            :class="
              activeComplexHint || techniqueStrip || canGoDigits.length
                ? 'block'
                : 'hidden lg:block'
            "
            class="text-sm font-medium 3xl:col-span-1 3xl:min-w-0 lg:sticky lg:top-3 lg:max-3xl:col-span-5"
          >
            <SideExplanationPanel
              ref="hintPanel"
              :class="{ 'max-lg:hidden': !activeComplexHint && !techniqueStrip }"
              :active-complex-hint="activeComplexHint"
              :current-step-index="currentStepIndex"
              :current-step="currentStep"
              @next-step="handleNextStep"
              @prev-step="prevHintStep"
              @cancel="cancelComplexHint"
              :technique="engine.activeMove.value?.technique ?? null"
              :learned="lessonsDone"
              :available="boardTechniques"
              @learn="openGameLesson"
              :peekable="peekable"
              @peek="handlePeek"
            />
            <CanThisGo
              v-if="canGoDigits.length"
              :digits="canGoDigits"
              :color-mode="colorMode"
              :asked="canGo?.num ?? null"
              :answer="canGoAnswer"
              :can-show="!!canGo?.move"
              @ask="askCanGo"
              @show="showCanGo"
            />
          </div>
        </div>
      </Transition>

      <!-- Settings over the paused game: centred (the bottom on phones). -->
      <SheetDialog
        v-model:open="settingsOverGame"
        class="settings-sheet"
        :aria-label="$t('settings.title')"
      >
        <component
          :is="SettingsSheet"
          v-if="settingsOverGame"
          in-game
          @back-to-menu="settingsOverGame = false"
          @tour="startTour()"
        />
      </SheetDialog>

      <!-- Every game key, opened with ? (the wide-screen sidebar shows the same list). -->
      <SheetDialog
        v-model:open="shortcutsOpen"
        class="panel m-auto w-[min(22rem,calc(100vw-2rem))] p-5 text-inherit backdrop:bg-black/50"
        :aria-label="$t('sidebar.keyboard')"
      >
        <h2 class="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {{ $t("sidebar.keyboard") }}
        </h2>
        <ShortcutList sheet />
        <button @click="startTour()" class="tile mt-5 w-full py-2 text-sm font-bold">
          {{ $t("sidebar.tour") }}
        </button>
        <button @click="shortcutsOpen = false" class="tile mt-2 w-full py-2 text-sm font-bold">
          {{ $t("modal.close") }}
        </button>
      </SheetDialog>

      <!-- The move history, docked low so the board stays in view while scrubbing. -->
      <SheetDialog
        v-model:open="historyOpen"
        class="panel mx-auto mt-auto mb-4 w-[min(26rem,calc(100vw-2rem))] p-4 text-inherit backdrop:bg-transparent"
        :aria-label="$t('controls.history')"
      >
        <label class="flex flex-col gap-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {{ $t("controls.history") }}
          <input
            type="range"
            min="0"
            :max="historyLength"
            :value="boardHistory.length"
            :aria-valuetext="
              $t('controls.historyStep', { n: boardHistory.length, total: historyLength })
            "
            class="w-full accent-violet-600 dark:accent-violet-400"
            @input="jumpHistory(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <p class="mt-1 text-xs text-zinc-600 tabular-nums dark:text-zinc-400">
          {{ $t("controls.historyStep", { n: boardHistory.length, total: historyLength }) }}
        </p>
        <button @click="historyOpen = false" class="tile mt-3 w-full py-2 text-sm font-bold">
          {{ $t("modal.close") }}
        </button>
      </SheetDialog>

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

      <PadHud
        v-if="padConnected && BOARD_SCREENS.has(currentScreen)"
        :digit="padDigit"
        :color-mode="colorMode"
        :game="currentScreen === 'game'"
      />

      <ControlsTour v-if="touring" @done="touring = false" />

      <AchievementToast
        :ids="toastIds"
        @dismiss="(id) => (toastIds = toastIds.filter((x) => x !== id))"
      />

      <!-- MODAL -->
      <LazyEndModal
        v-if="showModal"
        :title="modalTitle"
        :message="modalMessage"
        :win="isWinState"
        :difficulty-label="difficultyLabel"
        :stats-key="isDailyMode ? statsKey(activeDifficulty, true) : gameRow"
        :zen="gameZen"
        :practice="!!practiceTechnique"
        :mistakes="mistakes"
        :hints-used="hintsUsed"
        :seconds="timer.timerSeconds.value"
        :board="initialBoard"
        :placements="placements"
        :result="winResult"
        :technique-log="techniqueLog"
        :next-level="nextLevel"
        :next-loading="nextLoading"
        :variant="gameVariant"
        @next="handleNextPuzzle"
        @close="handleModalClose"
        @lesson="openLesson"
        @cue="cue"
        @replay="(frame) => (replayFrame = frame)"
      />

      <!-- RESUME PROMPT -->
      <ResumePrompt
        v-if="pendingResume"
        :save="pendingResume.save"
        :level="pendingResume.level"
        @continue="handleResumeConfirm"
        @restart="handleResumeDecline"
        @cancel="pendingResume = null"
      />
    </div>
  </UApp>
</template>

<!-- Non-scoped: the .dark ancestor lives on <html>, outside this component's scope. -->
<style>
/* "You spotted it": drops in over the board, then goes. */
.spot-enter-active,
.spot-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.spot-enter-from,
.spot-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
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
</style>
