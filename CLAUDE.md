# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager

This repo uses **pnpm** (`pnpm-lock.yaml`), not npm or yarn. Running `npm install` against it will produce peer-dependency resolution errors — always use `pnpm`. A hook in `.claude/settings.json` blocks `npm` and `npx` commands.

## Commands

```bash
pnpm dev              # dev server at http://localhost:3000
pnpm build            # production build
pnpm generate         # static generate (used for the GitHub Pages deploy)
pnpm preview          # preview a static build locally

pnpm test             # vitest, all unit tests (app/tests/*.test.ts)
pnpm test app/tests/sudokuGrader.test.ts   # single unit test file
pnpm test:e2e         # Playwright e2e suite (e2e/*.spec.ts)
pnpm test:e2e e2e/pause.spec.ts             # single e2e file

pnpm fmt              # oxfmt (also runs automatically on commit, see below)
pnpm lint             # oxlint (also runs automatically on commit, see below)
```

Don't run `fmt`/`lint` proactively during normal development — `forge.toml` wires `oxfmt` and `oxlint` into a pre-commit hook (auto-fixing and restaging), and `commit-msg` enforces Conventional Commits. They run automatically at commit time.

The e2e suite spins up its own dev server on port 3110 (`E2E_PORT` overrides it, so separate checkouts can run at once) with `NUXT_IGNORE_LOCK=1` (see `playwright.config.ts`), so it can run even while a normal `pnpm dev` is active on another port — Nuxt's dev-server lock is keyed by project directory, not port, so this would otherwise fail with "Another Nuxt dev server is already running." Playwright tests run with `workers: 1`: a single dev-mode Nuxt server backing all tests causes contention/flakiness under parallel workers.

`vitest.config.ts` excludes `e2e/**` — without it, vitest's default glob also picks up the Playwright `.spec.ts` files and fails trying to run them.

## Architecture

This is a client-only SPA (`ssr: false` in `nuxt.config.ts`), statically generated and deployed to GitHub Pages. There is no `pages/` directory — `app/app.vue` is the entire app. It's a single root component that owns all game state (board, timer, modals, preferences) and switches between screens itself via a `currentScreen` ref (`"menu" | "difficulty" | "game" | "academy" | "custom-import" | "stats"`), not Nuxt routing.

### Two separate Sudoku solvers, for different jobs

- **`app/utils/sudokuCore.ts`** — array-based backtracking solver (`solveBoard`, `isValidPlacement`, `countSolutions`/`hasUniqueSolution`) used for puzzle generation and uniqueness checks. This is the "can this board be solved at all / does it have exactly one solution" layer.
- **`app/utils/sudokuGrader.ts`** — a separate bitmask-based solver that mimics _human_ solving techniques (naked/hidden singles through XYZ-wing, see `TechniqueId`). It never peeks at the answer key: every move it returns (`SolveMove`) is justified by the technique itself, either a forced `placement` or a list of candidate `eliminations`. This same engine powers three things at once:
  1. **Hints** — `nextHint()` returns the next logically-justified move, replayed by `useSudokuEngine`'s `triggerComplexHint`/`applyComplexHint`.
  2. **Difficulty grading** — `solveLogically`/`gradePuzzle` grade a puzzle 1–5 (or `STUCK` if no technique applies and brute force would be required).
  3. **Puzzle generation** — `generateGradedPuzzle` digs cells out of a solved grid (via `sudokuCore`) and keeps retrying until the result grades within the target's `[min, max]` tier (`DIFFICULTY_TARGETS`), falling back to the closest-to-ideal _solved_ (never `STUCK`) board it saw. Generation never ships a guess-only puzzle.

### State composables

- **`useSudokuEngine.ts`** — the board/notes/history/hint state machine. Takes `colorMode` (a `Ref<boolean>`) so hint text can route digits through `digitLabel()` and say "red" instead of "5" when color mode is on.
- **`useGameSave.ts`** — one save slot per difficulty (`sudoku_v1_save_<difficulty>`), via `safeJson.ts`. There's no global "continue" — picking a difficulty that already has a save triggers a resume-or-restart prompt (`pendingResume` in `app.vue`) instead.
- **`useDailyPuzzle.ts`** — date-seeded (`seedFromString` + `makeRng`) puzzle, same for everyone on a given local calendar day; tracks completion/streak.
- **`useScore.ts`**, **`useTechniqueStats.ts`** — lifetime score and per-technique usage stats, also via `safeJson.ts`.
- **`app/utils/safeJson.ts`** — the shared `readJSON`/`writeJSON` pair every persistence composable uses (SSR-safe, try/catch'd). Reach for this instead of hand-rolling another `localStorage` guard.

### Gamification

Progress features are all derived from a win, with the rules in **pure, unit-tested utils** and persistence in thin composables (via `safeJson.ts`):

- **`utils/achievements.ts`** — the 19 achievement rules, each a `check(WinSummary)`. `triggerLocalModal` in `app.vue` builds the summary after `score.record`, calls `useAchievements().evaluate`, and queues the new ids as toasts. Unlock timestamps live in `sudoku_v1_achievements`. Adding an achievement = a rule here + `achievements.<id>.name/desc` in both locales (a test enforces both).
- **`utils/level.ts`** — lifetime score → level (reaching level n costs 250·n·(n−1) points) and a title band. **`utils/stars.ts`** — 1–3 stars for the win modal. **`utils/mastery.ts`** — Familiar/Practised/Fluent tiers for the Academy badges. **`utils/calendar.ts`** — the 12-week Monday-first grid behind the stats `DailyCalendar`.
- **How to play** (`utils/basics.ts`, `components/BasicsLesson.vue`, the `basics` screen) — four hand-built beginner lessons (the rule, pencil marks, one mark left, scanning) before the technique path, shown as its step 0. Every board is cut from one solved grid (`SOLUTION`) and a test proves each asked answer is forced. Its own small engine (place a digit / pencil in the maybes), so wrong input gets the beginner's reason ("This row already has 4", "Row 2 already has 5, so this cell is ruled out"; never a sentence starting with the digit, which colour mode turns into a word). Done lessons in `sudoku_v1_basics_done`, union-merged by cloud sync (`mergedBests`); the menu offers the course to a player with no wins and no lessons until dismissed (`pref_basics_prompt`).
- **Guided lessons** (`utils/lesson.ts`, `components/TechniqueLesson.vue`, the `lesson` screen) — the solver replayed over a practice puzzle to where the technique is next (else the Academy example): find the pattern cells, then make exactly its placement or removals. Its own board state, no clock/score/save. Finishing the next one is the only thing that completes a technique-path challenge (`completesChallenge`); a full practice win is extra practice, and only marks the technique of the week. A wrong tap gets the first true reason `missReason` finds; a fish accepts any same-size twin on its digit (`instancesOf`); the Academy-example fallback is shuffled by a sudoku symmetry (`shuffleLesson`) so "Another example" never repeats. Show me and rejected moves cost stars (`starsFor`), best per technique in `sudoku_v1_lesson_stars`, max-merged by cloud sync (`mergedBests`); a finished lesson also lifts the Academy mastery badge (`masteryFor`).
- **Spot it** (`utils/spotIt.ts`, `components/SpotIt.vue`, the `spot` screen) — a timed round of ten lesson step-1s from one tier (`buildRound`, seeded per position), sharing the lesson's `tapPattern`/`missText`/`findPrompt`. Positions come from `quickLesson` in the puzzle worker (`makeLesson` in `puzzlePool.ts`), one ahead; rare techniques skip the search and use the shuffled example. Best time per tier in `sudoku_v1_spot_best`, min-merged by cloud sync. e2e pins a round with `window.spotSeed`.
- **`utils/records.ts`** — personal records (`sudoku_v1_records`, via `useRecords`): most wins in a day, longest clean run, hardest level won without hints, counted from scored and Zen wins (never practice or custom boards, which could be farmed; the first mistake in a game ends the clean run). Fastest times stay in `useScore` and the longest Daily streak is derived from the Daily history, not stored. `triggerLocalModal` snapshots before/after a win and `brokenRecords` gives the win-modal lines; a cloud sync max-merges the bests both ways (`mergedRecords`).
- The win modal plays in steps (`winStep`: stars, score lines, the "Perfect!" stamp); unrevealed parts are only `opacity-0`, so the DOM always holds the real numbers. A tap or key skips; reduced motion starts at the end.
- Hidden achievements are masked as `???` in the trophy case until unlocked.
- **Wavedash** (`utils/wavedash.ts`, the only code touching the injected SDK; a no-op elsewhere) mirrors unlocks to Wavedash achievements. `wavedash-achievements.json` is the portal import file, generated from the rules: after changing an achievement run `UPDATE_WAVEDASH=1 pnpm test wavedash` and re-import it. Wins also post to leaderboards (`scoresFor`/`submitWin`; never custom puzzles), shown by `LeaderboardPanel` in Stats only on Wavedash; Progress syncs to one cloud file (`progress.json`, a Settings export): the async plugin restores or uploads before the app mounts (`decide` in `utils/cloudSync.ts`), and wins and hiding the tab upload. e2e fakes the SDK with `e2e/fakeWavedash.ts`. Design: `docs/specs/2026-10-27-wavedash-platform-design.md`.

### Preferences, feedback and backup

- **`composables/usePreferences.ts`** is the single owner of every player setting (`sudoku_v1_pref_*`; module-level singleton refs shared by the game and Settings). Add a setting there, then read it where needed.
- **`cue(kind)` in `app.vue`** is how game events produce feedback: it plays the sound (`utils/sound.ts`, synthesized) and the vibration (`utils/haptics.ts`), each behind its own preference. Use it rather than calling `playX` directly.
- **Digit-first input** (`activeDigit` in `app.vue`) arms a digit from the numpad; `handleSelectCell` places it, but arrow keys set `selectedCell` directly so they never place.
- **Completion flashes** carry a per-cell `delay` (`FlashCell`): a ripple from the placed digit, and a diagonal wave on a win (the win modal fades in after it via `.modal-delay`).
- **`utils/progressBackup.ts`** exports/imports every `sudoku_v1_*` key as a JSON file (Settings → Your data). It validates strictly (right app/version, our prefix only, JSON values, size cap) and import _replaces_ then reloads. New storage keys must keep the `sudoku_v1_` prefix to be backed up.
- Component styles that need a dark variant must use Tailwind `dark:` classes or a **non-scoped** `.dark .x` rule: scoped `:global(.dark) .x` silently failed (axe caught it).

### Color mode

`app/utils/sudokuColors.ts` defines `SUDOKU_COLORS` (digit 1–9 → Tailwind color class), `dotClass(n)` (colour + a circle/square/diamond shape cue for colour-blind players) and `digitLabel(n, colorMode, t)`, which both the UI (`SudokuCell`, `Numpad`, `DifficultySelector`) and the hint engine use so a digit is rendered/described consistently as a color when the mode is on. The underlying board state is always numeric — color mode is a rendering/copy concern only, toggled before a game starts and locked for its duration.

### Academy examples are generated data

`app/utils/academyExamples.ts` is auto-generated (per its own header comment) from real harvested solver states — one genuine example board per technique, not hand-written. Don't hand-edit it.

Patterns are drawn in pen over the board, the way puzzle books print them: `utils/patternMarks.ts` turns a `SolveMove` into lines (strong links solid, weak links and cover lines dashed) joining the actual pencil-mark slots, rings, unit frames, red-pen crosses and placement circles; `PatternOverlay.vue` is one SVG over the board (`SudokuGrid`'s `marks` prop, or `ExampleGrid`). Lessons, in-game hints and the Academy examples all use it. A new technique needs a case in `patternMarks` (its test draws every Academy example). The Academy cards' **Watch it** (`WatchExample.vue`) plays that drawing in steps (`beats`: frames, rings, links, result). The Academy's **map** view lays the techniques out by tier (`MAP_COLUMN`) with a line for each `BUILDS_ON` link in `utils/progression.ts`; a new technique needs both.

### i18n

Two locales: `en` and `rs` (`code: "rs"`, not `"sr"` — renamed from `sr` because i18n-ally was resolving the bare language code to the Suriname flag instead of Serbia's; `language: "sr-Latn-RS"`, the actual BCP-47 tag, is unaffected). Locale files use **flat dot-keys** (e.g. `"menu.title"`, not nested `{ "menu": { "title" } }`) per `.vscode/settings.json`'s `i18n-ally.keystyle: "flat"`. This works because vue-i18n checks for an exact literal-string key match before falling back to nested path resolution — it is not a bug. Keep `en.json` and `rs.json` in exact key parity; nothing currently enforces this automatically.

### Visual regression

`e2e/visual.spec.ts` captures every screen in light + dark against pixel baselines in `e2e/visual-regression-snapshots/<project>/`, at 1920×1080 (`visual`) and Pixel 7 (`visual-mobile`). It is opt-in (`VISUAL_REGRESSION=1`, so plain `pnpm test:e2e` skips it) and seeds a fixed saved game so nothing is random.

```bash
pnpm visual          # compare against baselines
pnpm visual:update   # accept intentional UI changes, then commit the PNGs
pnpm visual:report   # open the expected/actual/diff report
```

Any PR that changes how the UI looks must run `pnpm visual:update` and commit the changed baselines. Never reuse a running dev server for these runs (the config forbids it): Nuxt DevTools is disabled only for fresh servers. Baselines are rendered on macOS and are not run in CI (font rasterization differs on Linux), so regenerate them locally.

### Performance

Laptops with integrated graphics (an i7 + Iris Xe) are the low end. Measure before changing anything, against a production build (`WAVEDASH=1 NUXT_APP_BASE_URL=./ pnpm generate`, served statically), never the dev server, with Playwright's Chromium at 1536×864 @1.25 and CDP `Emulation.setCPUThrottlingRate` 4 (a slow laptop). Play a real game: select cells, place digits, notes, undo, a hint, a win. CDP `Performance.getMetrics` splits main-thread time into script, style and layout.

- Moves cost style and paint, not script (3% of a move's CPU). A transition on the 81 cells restyled and repainted the board for every frame of a highlight change (45% of a move); `e2e/perf.spec.ts` checks that a move starts none. Animate one element, not every cell.
- New-game generation runs in a Web Worker (`utils/puzzlePool.ts` + `puzzleWorker.ts`), and the difficulty screen prefetches one board per level, so starting a game doesn't wait on it; without workers it generates in place. The Daily and practice puzzles still generate on the main thread. `countFlat` in `sudokuCore.ts` is the hot loop (typed arrays, most-constrained cell first); digging a cell asks for a second solution with that cell's digit banned instead of counting to two. A generator change must keep every seeded board: the daily pin in `dailyPuzzle.test.ts` fails otherwise.
- `pnpm wavedash` runs `scripts/budget.mjs`, which prints the shipped JS and CSS sizes and warns past a watch level. It never fails the build: Wavedash's only limit is 1 GB per upload (docs.wavedash.com/publishing/upload). Nuxt UI is the usual culprit: `import * as` from `@nuxt/ui/locale` bundled 67 locales (228 KB), and without `ui.experimental.componentDetection` it themes every component (120 KB of CSS). Find what grew with source maps (`sourcemap: { client: true }`) and `pnpm dlx source-map-explorer`.

### Testing split

- `app/tests/*.test.ts` (vitest) — pure logic: solver, grader, scoring, daily-puzzle seeding. No DOM.
- `e2e/*.spec.ts` (Playwright Test) — full browser flows: new game/win, the resume-prompt's three branches, preference persistence, the pause overlay. Costs nothing to re-run once written, unlike manual browser-driven verification.
