# Sudoku Pro — Backlog

Living list of deferred work and ideas. Newest priorities at top of each section.
See [IDEAS.md](IDEAS.md) for the original feature roadmap (mostly shipped).

## Next up (known gaps)

- **Academy is English-only.** Technique names/text are hardcoded. The in-game
  hint titles are localized, so in Serbian the per-technique ×N usage badge in
  the Academy won't match. Move Academy strings to i18n if multi-language polish
  is wanted.
- **Exotic techniques are not learnable in-game.** Skyscraper, two-string-kite,
  empty rectangle, w-wing, unique rectangle, xy-chain, sue de coq, BUG were
  removed (unreachable on generated boards). If you ever want them taught/used,
  they'd need porting into the structured `nextHint` layer + generation tuning.

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
- Sound hint engine: elimination techniques remove candidates (never place the
  answer); grader-driven `nextHint` with persistent elimination chain.
- Deleted ~1700 lines of unreachable exotic hint detectors.
- Rebuilt Academy: 15 used techniques, every example a real harvested solver
  state with valid candidates.
- Mobile responsive fixes (control bar, hint panel) + ambient brand backdrop.
