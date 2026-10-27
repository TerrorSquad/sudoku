# Wavedash platform features: achievements, leaderboards, cloud saves

Status: phase 1 (achievements) implemented. Phases 2 and 3 are **not yet implemented**.

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

## Phase 2: leaderboards (not yet implemented)

- **Boards**, created with `getOrCreateLeaderboard(name, sortOrder, displayType)` once on boot and
  cached by id:
  - `best-time-<difficulty>` for beginner … master: `ASC`, `TIME_SECONDS`.
  - `daily-<YYYY-MM-DD>` (`localDateKey`): `ASC`, `TIME_SECONDS`, one board per day.
  - `lifetime-score`: `DESC`, `NUMERIC`, the `useScore` total.
  - Custom puzzles and Academy practice never submit.
- **Submitting.** After `score.record` in `triggerLocalModal`:
  `uploadLeaderboardScore(id, seconds, keepBest = true, undefined, { mistakes, hints, colorMode })`.
  Metadata limits: 16 keys, 2 KB, no nesting; a violation drops the score, so keep it to scalars.
- **Showing.** The Stats screen gains Global / Friends tabs per board (`listLeaderboardEntries`,
  `friendsOnly`) plus "my rank" (`getMyLeaderboardEntries`, `listLeaderboardEntriesAroundUser`).
  Off Wavedash the tabs are hidden. New strings go into `en` and `rs`.
- **Open questions.** Boards created from game code may count as "player-created" and default to
  hidden on the game page; check in the portal after the first run. There is no documented
  anti-cheat: scores are as trustworthy as the client.

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
