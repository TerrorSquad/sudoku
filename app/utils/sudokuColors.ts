// Index 0 unused so SUDOKU_COLORS[n] lines up with cell values 1-9.
export const SUDOKU_COLORS = [
  "",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-400",
  "bg-lime-500",
  "bg-green-600",
  "bg-teal-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
] as const;

// In color mode, hint text should say "red" instead of "1" — translations live under colors.1-9.
export function digitLabel(n: number, colorMode: boolean, t: (key: string) => string): string {
  return colorMode ? t(`colors.${n}`) : String(n);
}
