# Sudoku Pro — Ideas & Roadmap

## Quick Wins

| # | Feature | Status |
|---|---------|--------|
| 1 | Highlight same digits when a cell is selected | ✅ Done |
| 2 | Remaining digit count on numpad buttons | ✅ Done |
| 3 | Auto-clear notes when a number is placed correctly | ✅ Done |
| 4 | Mistake counter (max 3 ends game) | ✅ Done |
| 5 | Elapsed timer with pause | ✅ Done |

---

## Feel / Polish

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6 | Win animation (confetti or ripple) | ✅ Done | canvas-confetti burst on win |
| 7 | Cell placement animation (pop/scale on number entry) | ✅ Done | Spring-pop via :key remount + CSS keyframe |
| 8 | Dark mode toggle | ✅ Done | Light/dark via UColorModeButton |
| 9 | Completion summary modal | ✅ Done | Shows difficulty, mistakes, hints used, technique list |

---

## Educational

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 10 | Technique log | ✅ Done | Tracked per-game; shown in win summary modal |
| 11 | "Why wrong?" explainer | ✅ Done | Mistake banner: conflicting cell or "no clash but unsolvable" |
| 12 | Progressive technique unlocking by difficulty | ⬜ Todo | Easy = Singles only, Expert = all 23 |
| 13 | Per-technique usage stats (localStorage) | ✅ Done | Lifetime ×N count on win-modal technique chips |

---

## Bigger Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 14 | Daily puzzle (date-seeded, same for everyone) | ✅ Done | Seeded PRNG per date; completion tracked in localStorage |
| 15 | Custom puzzle import (paste 81 digits) | ✅ Done | CustomImport screen with validation + mini preview |
| 16 | True puzzle generator (permutations, not one fixed template) | ✅ Done | Random fill + uniqueness-checked digging; difficulty graded by required techniques |
| 17 | Daily streak counter | ✅ Done | Shown under Daily Challenge button |
