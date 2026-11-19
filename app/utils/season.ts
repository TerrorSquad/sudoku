export type Season = "winter" | "spring" | "summer" | "autumn";

// The menu's seasonal paper: meteorological seasons by the player's local month.
// ponytail: northern hemisphere only; shift by six months if southern players ask.
const BY_MONTH: Season[] = [
  "winter",
  "winter",
  "spring",
  "spring",
  "spring",
  "summer",
  "summer",
  "summer",
  "autumn",
  "autumn",
  "autumn",
  "winter",
];

export function seasonFor(date: Date): Season {
  return BY_MONTH[date.getMonth()]!;
}
