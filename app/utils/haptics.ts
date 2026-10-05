// Short vibration cues for touch devices. A no-op where the Vibration API is missing (iOS Safari,
// desktop browsers), so callers never need to check.

const PATTERNS = {
  place: 8,
  mistake: [40, 40, 40],
  complete: [12, 30, 12, 30, 24],
  win: [20, 40, 20, 40, 60],
} as const;

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(kind: keyof typeof PATTERNS): void {
  if (!canVibrate()) return;
  // Some browsers throw if called before a user gesture; a missed buzz isn't worth an error.
  try {
    navigator.vibrate(PATTERNS[kind] as number | number[]);
  } catch {
    /* ignore */
  }
}
