# Wavedash platform features: achievements, leaderboards, cloud saves

Status: phases 1 (achievements) and 2 (leaderboards) implemented. Phase 3 is **not yet implemented**.

Sudoku Pro ships on Wavedash (https://wavedash.com/games/sudoku-pro, `pnpm wavedash`) as well as the
static web build and PWA. Everything here was local-only because there was no backend; the
Wavedash SDK now provides one for players on Wavedash. SDK reference: https://docs.wavedash.com/sdk.

## Principles

- **One wrapper.** `app/utils/wavedash.ts` is the only code that touches `globalThis.Wavedash`.
  Wavedash injects the SDK before the app starts; everywhere else it is absent and every export is a
  no-op, so the web build, the PWA and dev behave exactly as before.
- **Local stays the source of truth.** Every feature keeps working from `localStorage`; Wavedash
  mirrors it. Players on Wavedash are always signed in, so there is no login UI.
- **Pure parts are unit-tested**; e2e fakes `window.Wavedash` with `page.addInitScript`
  (`e2e/wavedash.spec.ts`). For a real check use the playtest link or `wavedash dev` (signed-in
  browser required).

## Phase 1: achievements (implemented)

- **Definitions.** The 19 rules in `utils/achievements.ts` stay the source of truth. Ids map
  kebab → UPPER_SNAKE (`first-win` → `FIRST_WIN`), the style of Wavedash's examples. Hidden rules
  become `secret`. Unlocks are manual (no stats, no `stat_requirement`): the rules already live in code.
- **Import file.** `wavedash-achievements.json` (repo root) is the portal's Import JSON shape
  (`identifier`, `display_name`, `description`, `secret`, `stat_requirement`), built from the rules
  and the English locale. `app/tests/wavedash.test.ts` fails when it is stale; regenerate with
  `UPDATE_WAVEDASH=1 pnpm test wavedash`.
- **Importing into the portal.** Developer portal → Sudoku Pro → Achievements → Add achievement →
  Import JSON → `wavedash-achievements.json`. Import matches by identifier and updates in place,
  keeps icons, and leaves items not in the file alone, so re-importing after a change is safe.
  Icons are set per achievement in the portal (or `wavedash achievement update --image`).
- **Reporting.** `useAchievements().evaluate` calls `reportAchievements(fresh)` whenever it
  persists new unlocks. On boot, the plugin calls `initWavedash(<locally unlocked ids>)`: `init()`
  (hides the platform loader), `requestStats()`, then a back-fill of everything unlocked before,
  including progress made off Wavedash.
- **Not-ready writes.** The docs say stats and achievements load in two parts, `requestStats()` can
  resolve before both arrive, and until then `setAchievement` returns false and drops the write.
  No event signals "both loaded", so pending ids are retried every second (up to 60 tries) until
  `setAchievement` accepts them; ids `getAchievement` already reports are skipped. Unknown ids also
  return false, so an id missing from the portal just retries out and is back-filled next boot.
- **Saving.** Stats auto-save about once a second and nothing flushes on exit, so each flush that
  wrote something calls `storeStats()` immediately.

## Phase 2: leaderboards (implemented)

- **Boards** are created on first use with `getOrCreateLeaderboard(name, sortOrder, displayType)`;
  the id promise is cached per name, and a failed lookup is dropped from the cache so the next call
  retries. No portal setup is needed.
  - `best-time-<difficulty>` for beginner … master: ascending (0), time in seconds (1).
  - `daily-<YYYY-MM-DD>` (`useDailyPuzzle().todayKey()`, the key `markComplete` uses): ascending,
    time in seconds. A Daily posts here instead of its difficulty's board.
  - No lifetime-score board: custom puzzles count towards that total, so an imported near-solved
    grid would farm it.
  - Custom puzzles (and anything outside the six difficulties) post nothing; Academy practice never
    reaches the scoring branch. A zero time posts nothing.
- **Submitting.** `triggerLocalModal` calls `submitWin` right after `score.record`. The pure
  `scoresFor(win)` picks the boards (unit-tested); each upload is
  `uploadLeaderboardScore(id, score, keepBest = true, undefined, { mistakes, hints })`.
  Fire-and-forget: failures only `console.warn`, the local stats are already saved.
- **Showing.** `LeaderboardPanel.vue` at the top of Stats, only when `hasWavedash()`: a board
  picker (today's Daily, the default, then best time per difficulty), Global / Friends toggle
  (`listLeaderboardEntries(id, 0, 10, friendsOnly)`), the player's row highlighted, and "Your
  rank" from `getMyLeaderboardEntries`. Loading, error and empty states; strings in `en` and `rs`.
  Stale responses from a previous selection are ignored.
- **Tests.** `scoresFor` in `app/tests/wavedash.test.ts`; `e2e/wavedash.spec.ts` covers a medium
  win posting its time, a custom win posting none, the panel's tabs and board switch, and no
  panel off Wavedash; `e2e/a11y.spec.ts` scans Stats with the panel in both schemes. The fake SDK
  lives in `e2e/fakeWavedash.ts`.
- **Known gaps.** Boards created from game code may count as player-created and start hidden on
  the game page: check the portal's Leaderboards tab after the first scores and make them visible.
  There is no documented anti-cheat: scores are as honest as the client.

## Phase 3: cloud saves (not yet implemented)

- **Payload.** One file, `progress.json`: `createBackup(localStorage)` from `utils/progressBackup.ts`,
  which already serialises every `sudoku_v1_*` key with strict validation on the way back in.
- **Upload.** `writeLocalFile` then `uploadRemoteFile` at checkpoints only: a win, quitting a game,
  `visibilitychange` to hidden. The limit is 30 uploads/min and 300/hour per player, and an
  over-limit upload is rejected locally until the wait passes, so debounce to at most one per
  ~10 s and never retry in a loop.
- **Restore on boot.** `downloadRemoteFile` → `readLocalFile` → `parseBackup`. Keep whichever of
  cloud and local has the newer `exportedAt` (newest wins); before applying a cloud copy, save the
  current local backup under `sudoku_pre_cloud_restore` (outside the `sudoku_v1_` prefix, so it is
  never itself synced or exported) so a bad restore can be undone. Apply with `applyBackup` and reload, the
  same path as Settings → Your data → Import.
- **Open questions.** The docs give no file size limit or conflict model; our payload is well
  under the existing 5 MB `MAX_BACKUP_BYTES` cap. `listRemoteDirectory` returns absolute keys
  (`/progress.json`); read files back with exactly that key.
