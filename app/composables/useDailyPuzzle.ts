import type { Grid } from '../types/sudoku';

const SOLVED_TEMPLATE = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function seedFromDate(dateStr: string): number {
  return dateStr.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 1);
}

// Mulberry32 seeded PRNG
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function generateDailyBoard(dateStr: string): Grid {
  const rng = makeRng(seedFromDate(dateStr));
  // 45 cells removed → medium-hard
  const removeCount = 45;
  const cells = Array.from({ length: 81 }, (_, i) => i);
  // Fisher-Yates shuffle with seeded rng
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const board = SOLVED_TEMPLATE.map(row => [...row]);
  for (let i = 0; i < removeCount; i++) {
    const idx = cells[i]!;
    board[Math.floor(idx / 9)]![idx % 9] = 0;
  }
  return board as Grid;
}

const SAVE_PREFIX = 'sudoku_v1_daily_';

interface DailyRecord {
  completed: boolean;
  time: number;
  mistakes: number;
}

export function useDailyPuzzle() {
  const key = todayKey();

  function getBoard(): Grid {
    return generateDailyBoard(key);
  }

  function getRecord(): DailyRecord | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + key);
      return raw ? (JSON.parse(raw) as DailyRecord) : null;
    } catch {
      return null;
    }
  }

  function markComplete(time: number, mistakes: number): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SAVE_PREFIX + key, JSON.stringify({ completed: true, time, mistakes }));
    } catch { }
  }

  return { getBoard, getRecord, markComplete, dateKey: key };
}
