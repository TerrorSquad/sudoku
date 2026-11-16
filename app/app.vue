<script setup lang="ts">
// Nuxt UI has no Serbian: its own strings stay English. Importing every locale cost 228 KB.
import { en as uiLocale } from "@nuxt/ui/locale";
import confetti from "canvas-confetti";

import type { PadKeys } from "./composables/useGamepad";
import type { GameSave, SaveSlot } from "./composables/useGameSave";
import type { WinResult } from "./composables/useWinResult";
import type { CellCoord, Difficulty, FlashCell, Grid } from "./types/sudoku";
import type { BasicsId } from "./utils/basics";
import type { Lesson } from "./utils/lesson";
import type { BoardTheme } from "./utils/preferenceValues";
import type { Tier, Week } from "./utils/progression";
import type { Placement } from "./utils/stuckMoments";
import type { DigitAt, SolveMove, TechniqueId } from "./utils/sudokuGrader";

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
  controlsTour,
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
// The Spot it tier being played (the spot screen).
const spotTier = ref<Tier>("Basic");
// Set when the spot screen plays the Daily review (these techniques) instead of a tier.
const spotReview = ref<TechniqueId[] | undefined>();
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
// What the dashboard chip and the win modal call this game, in the player's language.
const difficultyLabel = computed(() =>
  practiceTechnique.value
    ? `${practiceWeek.value ? t("weekly.title") : t("practice.label")} · ${t(`hint.move.${practiceTechnique.value}.name`)}`
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
function openGameSettings() {
  if (timer.isPaused.value) timer.togglePause();
  settingsOverGame.value = true;
}
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
const mistakeExplainer = ref<string>("");
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
  if (isDailyMode.value) return dailyPuzzle.getBestTime();
  return score.getStats().perDifficulty[activeDifficulty.value]?.bestTime ?? 0;
});
// Lessons finished, read when the screen changes (a lesson ends on another screen), not per move.
const lessonsDone = computed(() => {
  void currentScreen.value;
  return techniquePath.getDone();
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
  winResult.value = null;
  showModal.value = true;
  activeDigit.value = null;
  timer.stopTimer();
  const practised = practiceTechnique.value;
  // Read before this game's save is cleared: a level open only through it isn't news.
  const lockedBefore =
    win && !practised ? lockedLevels(score.unlockWins(), (d) => !!gameSave.loadDifficulty(d)) : [];
  if (!practised) gameSave.clearDifficulty(isDailyMode.value ? "daily" : activeDifficulty.value);
  if (!win) return;
  cue("win");
  flashWin();
  const { result, toasts, opened, unlock } = recordWin({
    difficulty: activeDifficulty.value,
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
  confetti({
    disableForReducedMotion: true,
    particleCount: 160,
    spread: 80,
    origin: { y: 0.55 },
    colors: ["#17294a", "#2a52a8", "#8aabe2", "#ffe680", "#c2352b"],
  });
}

// The modal's Next puzzle: a level the win just opened, else the same level again (a Medium after
// the Daily, which has one puzzle a day). None for practice and custom boards.
const justUnlocked = ref<Difficulty | null>(null);
const nextLevel = computed<Difficulty | null>(() => {
  if (practiceTechnique.value || activeDifficulty.value === "custom") return null;
  if (justUnlocked.value) return justUnlocked.value;
  return isDailyMode.value ? "medium" : activeDifficulty.value;
});
// Starting: the modal stays up (its button busy) until the board is ready, so the won board is
// never live again in between. A saved game at that level goes through the usual resume prompt.
const nextLoading = ref(false);
async function handleNextPuzzle() {
  const level = nextLevel.value;
  if (!level || nextLoading.value) return;
  if (gameSave.loadDifficulty(level)) {
    handleModalClose();
    currentScreen.value = "difficulty";
    handleChooseDifficulty(level);
    return;
  }
  nextLoading.value = true;
  // Straight to the next board (the menu would cancel its start), Zen if this game was.
  await handleStartGame(level, { zen: gameZen.value, ready: closeModal });
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
  timer.resetTimer();
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
  handleLesson(id);
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
  }: { daily?: string; zen?: boolean; practice?: TechniqueId | null; save?: GameSave } = {},
) {
  practiceTechnique.value = practice;
  isDailyMode.value = !!daily;
  dailyDate = daily;
  gameZen.value = zenGame;
  load();
  activeDifficulty.value = difficulty;
  mistakes.value = save?.mistakes ?? 0;
  say(t(save ? "game.ready" : "game.newBoard"));
  mistakeExplainer.value = "";
  flashCells.value = [];
  notesMode.value = false;
  hintsUsed.value = save?.hintsUsed ?? 0;
  techniqueLog.value = [];
  placements.value = save ? restorePlacements(save) : [];
  timer.resetTimer();
  if (save) timer.timerSeconds.value = save.timerSeconds;
  timer.startTimer();
  currentScreen.value = "game";
}

function resumeSavedGame(s: GameSave) {
  beginGame(s.difficulty, () => restoreGame(s), { daily: s.daily, zen: s.zen, save: s });
}

// A board still generating when the player picks again, or leaves the screen, is dropped.
let startToken = 0;
watch(currentScreen, () => startToken++);
async function handleStartGame(
  level: Difficulty,
  { zen: zenGame = zen.value, ready = () => {} } = {},
) {
  const token = ++startToken;
  const generated = await takePuzzle(level);
  if (token !== startToken) return;
  ready();
  gameSave.clearDifficulty(level);
  beginGame(level, () => startNewGame(level, generated), { zen: zenGame });
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
// cell of each newly-completed unit (engine.completedAt decides what is complete).
function flashCompletedUnits(r: number, c: number) {
  // Cells ripple outward from the digit just placed: 45 ms per step of distance.
  const RIPPLE_MS = 45;
  const { units, digitDone, cells } = engine.completedAt(r, c);
  if (!cells.length) return;
  const num = currentBoard.value[r]![c]!;
  if (units) cue("complete", units, num);
  if (digitDone) cue("digit", num);
  runFlash(
    cells.map((p) => ({
      ...p,
      delay: Math.max(Math.abs(p.r - r), Math.abs(p.c - c)) * RIPPLE_MS,
    })),
  );
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
            say(t("game.conflictWith", { where }));
            const first = conflicts[0]!;
            mistakeExplainer.value = t("game.whyConflict", {
              num: digitLabel(num, colorMode.value, t),
              r: first.r + 1,
              c: first.c + 1,
            });
          } else {
            say(t("game.wrongDigit"));
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
  if (!timer.isPaused.value) timer.togglePause();
  academyFromGame.value = true;
  academyFocus.value = id;
  handleLesson(id);
}
const openNudgeLesson = () => openGameLesson(nudge.value?.technique);

function handleTriggerHint() {
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
  return singlesPath(currentBoard.value);
});

const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
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
    timer.startTimer();
  }
}

function handleAutoFillNotes() {
  engine.autoFillNotes();
  say(t("game.notesFilled"));
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
  beginGame("medium", () => loadCustomBoard(dailyPuzzle.getBoard()), {
    daily: dailyPuzzle.todayKey(),
  });
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
// `week` set: the technique of the week, seeded so everyone gets the same board that week.
async function handlePractice(technique: TechniqueId, week: Week | null = null) {
  if (practiceLoading.value) return; // a double-click must not start two searches
  practiceLoading.value = true;
  const token = ++practiceToken;
  try {
    const rng = week ? makeRng(seedFromString(week.seed)) : Math.random;
    const from = currentScreen.value; // the Academy, or a finished lesson's "Try a full puzzle"
    const p = await generatePracticePuzzle(technique, rng);
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
async function handleLesson(technique: TechniqueId) {
  if (practiceLoading.value) return;
  practiceLoading.value = true;
  const token = ++practiceToken;
  try {
    const from = currentScreen.value; // the Academy, or a finished lesson's next one
    const lesson = await generateLesson(technique);
    if (token !== practiceToken || currentScreen.value !== from) return;
    activeLesson.value = lesson;
    currentScreen.value = "lesson";
  } finally {
    practiceLoading.value = false;
  }
}

function exitToMenu() {
  academyFromGame.value = false; // the game is over: no lesson or Academy returns to it
  practiceTechnique.value = null;
  isDailyMode.value = false;
  timer.stopTimer();
  cancelComplexHint();
  currentScreen.value = "menu";
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
  checkWin();
}

const shortcutsOpen = ref(false);
// The controls tour (ControlsTour): once on a first game, again from Settings or the ? sheet. The
// clock runs, as with Settings over the game; a paused game resumes so the controls show.
const touring = ref(false);
async function startTour() {
  controlsTour.value = false;
  shortcutsOpen.value = false;
  settingsOverGame.value = false;
  if (timer.isPaused.value) timer.togglePause();
  await nextTick(); // a closing sheet hands focus back first, then the tour takes it
  touring.value = true;
}
function onScreenEntered() {
  if (currentScreen.value === "game" && controlsTour.value) startTour();
}

function handleKeyDown(e: KeyboardEvent) {
  if (showModal.value) return; // EndModal's own keys
  // A sheet over the game takes the keys. Read the real dialog state, not the v-models: Esc
  // closes a dialog at once but its close event (which clears the model) comes a task later, so a
  // key pressed right after Esc would be dropped.
  // practiceLoading: a lesson opening over the paused game must keep it paused.
  if (
    currentScreen.value !== "game" ||
    touring.value || // driver.js has the keys
    document.querySelector("dialog[open]") ||
    practiceLoading.value
  )
    return;
  if (e.key === "?") {
    shortcutsOpen.value = true;
    return;
  }
  if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey && !finishing.value) {
    timer.togglePause();
    return;
  }
  if (timer.isPaused.value) return;
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
  // Arrows and WASD walk the grid (so auto-fill notes lives on F, not A).
  const to = stepCell(selectedCell.value, e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (to) {
    e.preventDefault();
    focusCell((selectedCell.value = to)); // not handleSelectCell: arrows must never place an armed digit
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
    ["difficulty", "stats", "achievements", "settings", "custom-import"].includes(
      currentScreen.value,
    )
  )
    return (currentScreen.value = "menu");
  sendKey("Escape"); // the Academy's boards handle their own Back
}
// LB/RB pick the digit that A (game) or X (Academy boards) enters.
function padKeys(digit: number): PadKeys {
  if (currentScreen.value === "game")
    return { press: String(digit), alt: "n", back: "Backspace", hint: "h", pause: "p", help: "?" };
  // A presses a focused button; How to play has no cells to tap, so there A enters the digit too.
  return {
    press: currentScreen.value === "basics" ? String(digit) : "Enter",
    alt: String(digit),
    back: "Escape",
    hint: "h",
    clicks: true,
  };
}
const { connected: padConnected, digit: padDigit } = usePad({
  onBoard: () =>
    BOARD_SCREENS.has(currentScreen.value) &&
    padScope() === document &&
    !(currentScreen.value === "game" && timer.isPaused.value),
  boardKeys: padKeys,
  onBack: padBack,
  onPause: () => {
    if (currentScreen.value === "game") sendKey("p");
  },
});

useEventListener(window, "keydown", handleKeyDown);
useEventListener(document, "visibilitychange", handlePageHidden);
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
          @daily="handleStartDaily"
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

        <!-- ACADEMY -->
        <SudokuAcademy
          v-else-if="currentScreen === 'academy'"
          :focus="academyFocus"
          :in-game="academyFromGame"
          @back-to-menu="currentScreen = academyFromGame ? 'game' : 'menu'"
          @practice="handlePractice"
          @lesson="handleLesson"
          @basics="openBasics"
          @weekly="(week) => handlePractice(week.technique, week)"
          @spot="
            (tier) => {
              spotTier = tier;
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
        <SpotIt
          v-else-if="currentScreen === 'spot'"
          :tier="spotTier"
          :review="spotReview"
          @cue="academyCue"
          @back="currentScreen = 'academy'"
          @lesson="handleLesson"
        />

        <!-- HOW TO PLAY -->
        <BasicsLesson
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
        <TechniqueLesson
          v-else-if="currentScreen === 'lesson' && activeLesson"
          :key="activeLesson.technique + activeLesson.board.flat().join('')"
          :lesson="activeLesson"
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
          <GameLegend />

          <!-- Center / main game column -->
          <div class="flex w-full flex-col 3xl:col-span-1 lg:gap-3 lg:max-3xl:col-span-7">
            <GameDashboard
              :formatted-time="timer.formatTime(timer.timerSeconds.value)"
              :is-paused="timer.isPaused.value"
              :mistakes="mistakes"
              :max-mistakes="mistakeLimit"
              :show-timer="showTimer && !gameZen"
              :best-time="bestTime ? timer.formatTime(bestTime) : ''"
              :challenge="challengeTarget > 0 && activeDifficulty === 'custom'"
              :past-best="bestTime > 0 && timer.timerSeconds.value > bestTime"
              :show-mistakes="highlightErrors && !gameZen"
              :difficulty="difficultyLabel"
              @toggle-pause="!finishing && timer.togglePause()"
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
                :marks="hintMarks"
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

              <PauseOverlay
                v-if="timer.isPaused.value"
                @resume="timer.togglePause()"
                @settings="openGameSettings"
                @shortcuts="shortcutsOpen = true"
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
              :technique="engine.activeMove.value?.technique ?? null"
              :learned="lessonsDone"
              @learn="openGameLesson"
            />
          </div>
        </div>
      </Transition>

      <!-- Settings over the game: a sheet at the side (the bottom on phones), the board in view. -->
      <SheetDialog
        v-model:open="settingsOverGame"
        class="settings-sheet"
        :aria-label="$t('settings.title')"
      >
        <SettingsScreen
          v-if="settingsOverGame"
          in-game
          :timed="!gameZen"
          @back-to-menu="settingsOverGame = false"
          @tour="startTour"
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
        <button @click="startTour" class="tile mt-5 w-full py-2 text-sm font-bold">
          {{ $t("sidebar.tour") }}
        </button>
        <button @click="shortcutsOpen = false" class="tile mt-2 w-full py-2 text-sm font-bold">
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

      <LazyControlsTour v-if="touring" @done="touring = false" />

      <AchievementToast
        :ids="toastIds"
        @dismiss="(id) => (toastIds = toastIds.filter((x) => x !== id))"
      />

      <!-- MODAL -->
      <EndModal
        v-if="showModal"
        :title="modalTitle"
        :message="modalMessage"
        :win="isWinState"
        :difficulty-label="difficultyLabel"
        :stats-key="statsKey(activeDifficulty, isDailyMode)"
        :zen="gameZen"
        :practice="!!practiceTechnique"
        :mistakes="mistakes"
        :hints-used="hintsUsed"
        :seconds="timer.timerSeconds.value"
        :board="initialBoard"
        :result="winResult"
        :technique-log="techniqueLog"
        :next-level="nextLevel"
        :next-loading="nextLoading"
        @next="handleNextPuzzle"
        @close="handleModalClose"
        @lesson="openLesson"
        @cue="cue"
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
