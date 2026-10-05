// Index 0 unused so SUDOKU_COLORS[n] lines up with cell values 1-9.
export const SUDOKU_COLORS = [
  "",
  "bg-red-600",
  "bg-orange-500",
  "bg-yellow-300",
  "bg-amber-800",
  "bg-green-600",
  "bg-cyan-300",
  "bg-blue-700",
  "bg-purple-600",
  "bg-pink-300",
] as const;

// Second cue for colour-blind players: 1-3 circles, 4-6 rounded squares, 7-9 diamonds.
// clip-path (not rotate) so the diamond doesn't fight the cell-pop/shake transforms.
const SHAPES = [
  "rounded-full",
  "rounded-md",
  "[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]",
] as const;

/** Colour + shape classes for a digit's dot; size classes are the caller's. */
export function dotClass(n: number): string {
  return `${SUDOKU_COLORS[n]} ${SHAPES[Math.floor((n - 1) / 3)]}`;
}

// In color mode, hint text should say "red" instead of "1" — translations live under colors.1-9.
export function digitLabel(n: number, colorMode: boolean, t: (key: string) => string): string {
  return colorMode ? t(`colors.${n}`) : String(n);
}
