# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager

This repo uses **pnpm** (`pnpm-lock.yaml`), not npm or yarn. Running `npm install` against it will produce peer-dependency resolution errors — always use `pnpm`.

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

The e2e suite spins up its own dev server on port 3010 with `NUXT_IGNORE_LOCK=1` (see `playwright.config.ts`), so it can run even while a normal `pnpm dev` is active on another port — Nuxt's dev-server lock is keyed by project directory, not port, so this would otherwise fail with "Another Nuxt dev server is already running." Playwright tests run with `workers: 1`: a single dev-mode Nuxt server backing all tests causes contention/flakiness under parallel workers.

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

### Color mode

`app/utils/sudokuColors.ts` defines `SUDOKU_COLORS` (digit 1–9 → Tailwind color class) and `digitLabel(n, colorMode, t)`, which both the UI (`SudokuCell`, `Numpad`, `DifficultySelector`) and the hint engine use so a digit is rendered/described consistently as a color when the mode is on. The underlying board state is always numeric — color mode is a rendering/copy concern only, toggled before a game starts and locked for its duration.

### Academy examples are generated data

`app/utils/academyExamples.ts` is auto-generated (per its own header comment) from real harvested solver states — one genuine example board per technique, not hand-written. Don't hand-edit it.

### i18n

Two locales: `en` and `rs` (`code: "rs"`, not `"sr"` — renamed from `sr` because i18n-ally was resolving the bare language code to the Suriname flag instead of Serbia's; `language: "sr-Latn-RS"`, the actual BCP-47 tag, is unaffected). Locale files use **flat dot-keys** (e.g. `"menu.title"`, not nested `{ "menu": { "title" } }`) per `.vscode/settings.json`'s `i18n-ally.keystyle: "flat"`. This works because vue-i18n checks for an exact literal-string key match before falling back to nested path resolution — it is not a bug. Keep `en.json` and `rs.json` in exact key parity; nothing currently enforces this automatically.

### Testing split

- `app/tests/*.test.ts` (vitest) — pure logic: solver, grader, scoring, daily-puzzle seeding. No DOM.
- `e2e/*.spec.ts` (Playwright Test) — full browser flows: new game/win, the resume-prompt's three branches, preference persistence, the pause overlay. Costs nothing to re-run once written, unlike manual browser-driven verification.
