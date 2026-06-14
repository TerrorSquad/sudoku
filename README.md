# Sudoku Pro

A Sudoku game built with **Nuxt 4 / Vue 3** that teaches you how to solve Sudoku through step-by-step interactive hints.

**Live demo:** https://terrorsquad.github.io/sudoku/

---

## How to play

The board follows standard Sudoku rules: fill every row, column, and 3×3 box with the digits 1–9, each appearing exactly once.

### Controls

| Action            | Keyboard               | Mouse / Touch            |
| ----------------- | ---------------------- | ------------------------ |
| Enter a number    | `1`–`9`                | Number pad at the bottom |
| Erase a cell      | `Backspace` / `Delete` | Erase button             |
| Toggle notes mode | `N`                    | Notes button             |
| Request a hint    | `H`                    | CSP Savjet button        |
| Auto-fill notes   | `A`                    | Auto Bilješke button     |
| Undo last move    | —                      | Nazad button             |

### Notes mode

Press **N** (or the Notes button) to toggle pencil-mark mode. In this mode, numbers are entered as small candidates inside the cell rather than as a final answer. Use **Auto Bilješke** to instantly fill in all valid candidates for every empty cell — a great starting point before applying the solving techniques below.

---

## Solving techniques (hints)

The hint system detects whichever technique applies to the current board state and walks you through it step by step — from the simplest to the most advanced.

### 1 · Naked Single

**When:** Only one number is possible in a cell.

A cell's row, column, and box together eliminate every digit except one. That digit is the answer. This is the most common technique for beginners.

> _Highlighted in blue: all cells that block the other candidates._

---

### 2 · Hidden Single

**When:** A digit can only go in one cell within a row, column, or box.

Even if the target cell has multiple candidates, you can find where a specific number _must_ go by scanning an entire unit (row, column, or box) and seeing that no other cell in that unit accepts it.

> _Highlighted in blue: the filled cells that rule out the digit elsewhere in the unit._

---

### 3 · Naked Pair

**When:** Two cells in the same unit share exactly the same two candidates.

Those two numbers are "locked" into those two cells — they cannot appear anywhere else in that unit. You can therefore eliminate both candidates from every other cell in the same row, column, or box.

> _Blue: the pair cells. Red: cells where the pair's digits can be eliminated._

---

### 4 · Pointing Pair / Triple

**When:** Within a 3×3 box, all candidates for a digit fall on the same row or column.

That digit must land somewhere in those cells inside the box, so it cannot appear in the rest of that row or column outside the box.

> _Blue: the aligned candidate cells inside the box. Red: eliminations outside the box._

---

### 5 · X-Wing

**When:** A digit appears exactly twice in each of two different rows, and those occurrences share the same two columns.

The digit must occupy one of the two diagonals of the resulting rectangle. Either way it fills both columns within those two rows, so it can be eliminated from all other cells in those two columns.

> _Blue: the four rectangle corners. Red: column eliminations outside the two rows._

---

## Difficulty levels

| Level            | Cells removed |
| ---------------- | ------------- |
| Lako (Easy)      | 30            |
| Srednje (Medium) | 42            |
| Teško (Hard)     | 52            |
| Ekspert          | 58            |

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:3000)
pnpm dev

# Generate static build
pnpm generate

# Preview static build locally
pnpm preview
```

---

## Deployment (GitHub Pages)

The repository ships with a GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that automatically builds and deploys the app on every push to `main`.

### First-time setup

1. Push this repository to GitHub (already at `TerrorSquad/sudoku`).
2. Go to **Settings → Pages** in the GitHub repository.
3. Under **Source**, select **GitHub Actions**.
4. Push to `main` — the workflow runs automatically and publishes the site.

The live URL will be: `https://terrorsquad.github.io/sudoku/`

---

## Tech stack

- [Nuxt 4](https://nuxt.com) (static generation, `ssr: false`)
- [Vue 3](https://vuejs.org) with Composition API
- [Tailwind CSS](https://tailwindcss.com)
- TypeScript (strict mode + `noUncheckedIndexedAccess`)
