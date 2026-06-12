# Sudoku Pro — Backlog

Living list of deferred work and ideas. Newest priorities at top of each section.
See [IDEAS.md](IDEAS.md) for the original feature roadmap (mostly shipped).

## In progress

- **Hint engine rework** — make hints logically sound: elimination techniques
  apply candidate eliminations instead of placing answer-key digits. (Being
  done now via a grader-driven, persistent-candidate hint engine.)

## Next up (known bugs / gaps)

- **Sudoku Academy examples are wrong.** `app/components/SudokuAcademy.vue`
  uses one near-solved `BASE_BOARD`, blanks a few cells, and hand-types `notes`
  that are never validated against the board — so an example can show a pencil
  mark for a digit that already appears in that row/box. Rebuild each technique's
  example with a real board + board-derived candidates (reuse
  `utils/sudokuCore` + `sudokuGrader`), and ideally generate the example by
  finding a real instance of the technique.
- **Remove dead hint detectors.** Once the grader-driven hint engine lands, the
  ~23 in-engine `findX` detectors in `useSudokuEngine.ts` (and their
  `hint.tech.*` i18n keys, e.g. `candidateReduction`) become dead code. Delete
  in a follow-up to keep the diff reviewable.

## Features (decided / parked)

- **PWA / installable** — manifest + service worker + offline cache so the app
  is installable and store-ready. (User chose this as the store path.)
- **Stats screen** — win rate, average time, games played, best score per
  difficulty. Data already exists in `useScore` (lifetime total, per-difficulty
  bests) and the daily/technique stores; just needs a screen.
- **Leaderboard** — skipped for now (local-only). `useScore` is structured so a
  cloud backend can be added later without changing the scoring math.

## Polish / smaller ideas

- Row/column/box **completion flash** when a unit is finished.
- **"Check for mistakes"** toggle (some players want it off for a purer game).
- Auto-clean pencil marks more aggressively on placement (partly done).
- Score nuance: discourage hint-spam (e.g. diminishing returns), reward streaks.
- Sound effects (placement, win, mistake) with a mute toggle.
- Settings screen: toggle animations, mistake-checking, auto-notes default.

## Done this cycle (for context)

- True unique-solution generator; difficulty graded by required techniques;
  generation never ships guess-only ("STUCK") boards.
- Daily puzzle: real generator, local-date rollover, streak counter.
- Why-wrong mistake explainer; lifetime per-technique stats on win modal.
- Removed answer-revealing hint fallback; hint panel closes on manual entry.
- Scoring system + animated win modal + game-feel animations.
