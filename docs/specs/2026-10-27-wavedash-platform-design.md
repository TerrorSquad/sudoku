# Wavedash platform features: achievements, leaderboards, cloud saves

Status: all three phases implemented: achievements, leaderboards and cloud saves.

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

## Phase 3: cloud saves (implemented)

- **Payload.** One file, `progress.json`: `createBackup(localStorage)` from `utils/progressBackup.ts`
  (every `sudoku_v1_*` key) plus `updatedAt` (ms at upload). Read back through `parseBackup`, so
  the Settings import's validation guards it too.
- **Local bookkeeping**, outside the `sudoku_v1_` prefix so it is never exported or synced:
  `sudoku_cloud_meta` = `{ syncedAt, syncedHash }`, the `updatedAt` and data hash of the cloud copy
  this device last uploaded or restored; `sudoku_sync_backup` = `{ reason, savedAt, backup }`,
  whatever the last sync replaced (local data before a restore, or the cloud copy a conflict
  upload overwrote), so a bad sync can be undone by hand.
- **Boot.** The Wavedash plugin is async and awaits `syncFromCloud()`; Nuxt mounts the app only
  after plugins resolve, so a restore lands before any composable reads `localStorage` and no
  reload is needed. The platform loader covers the wait, capped at 5 s.
  `remoteFileExists` → `downloadRemoteFile` → `readLocalFile` (also tried with a leading `/`,
  the docs' absolute-key gotcha). If the cloud state can't be determined (error, timeout),
  nothing is restored and **no upload happens that session**, so a device can't overwrite a
  cloud copy it never saw.
- **Decision** (`decide` in `utils/cloudSync.ts`, pure and unit-tested). "Changed" is judged
  against the last sync: local changed = its hash differs from `syncedHash`; cloud changed = its
  `updatedAt` differs from `syncedAt`. Comparing to the cloud's own timestamp, never this
  device's clock, means skewed clocks can't make one device overwrite another.
  - Same data both sides: record the sync.
  - Only local changed: upload. Only cloud changed (incl. a fresh device): restore.
  - Both changed (or a device with its own progress that never synced): keep the side with the
    higher lifetime score, which only grows; a tie goes to the cloud.
  - Cloud missing or corrupt: upload local (replacing the corrupt file), unless local is empty.
  - A file from a later version (`version > 1`): left alone, no uploads this session.
  - Empty local data never uploads, and empty or invalid cloud data is never applied.
  - Local data cleared after the last sync (Settings → reset) stays cleared until the next
    upload replaces the cloud copy.
- **Upload.** `saveToCloud()` after a win (Daily or not; the Daily's completion is written in the
  same block) and on `visibilitychange` to hidden. It skips when the data hash matches the last
  sync, uploads at most once per 30 s with a trailing upload for changes inside the gap (5 s when
  the tab hides, since a hidden tab may never run the timer), and after a failure waits 60 s
  without retrying: the SDK fails over-limit uploads locally until its wait passes. That keeps
  well under 30 uploads/min.
- **Tests.** `app/tests/cloudSync.test.ts` covers `readCloud`, `hashData` and every `decide` branch;
  `e2e/wavedash.spec.ts` (the fake SDK has an in-memory file store) covers a fresh device
  restoring, local-newer uploading, a corrupt cloud file leaving local intact, and a win uploading.
- **Open questions.** The docs give no file size limit or conflict model; our payload stays far
  under the existing 5 MB `MAX_BACKUP_BYTES` cap. There is no UI: syncing is silent.
