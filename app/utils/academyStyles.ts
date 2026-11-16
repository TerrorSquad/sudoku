// Tailwind classes shared by the Academy's cards and its map.
import type { Tier } from "./progression";

export const MASTERY_STYLE = [
  "",
  "border-zinc-300 bg-zinc-200 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400",
  "border-cyan-400/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
] as const;

export const TIER_STYLES: Record<Tier, { badge: string; heading: string; border: string }> = {
  Basic: {
    badge: "bg-emerald-500/15 dark:text-emerald-400 text-emerald-600 border-emerald-500/30",
    heading: "dark:text-emerald-400 text-emerald-600",
    border: "border-emerald-500/20 hover:border-emerald-500/50",
  },
  Intermediate: {
    badge: "bg-amber-500/15 dark:text-amber-400 text-amber-700 border-amber-500/30",
    heading: "dark:text-amber-400 text-amber-700",
    border: "border-amber-500/20 hover:border-amber-500/50",
  },
  Advanced: {
    badge: "bg-violet-500/15 dark:text-violet-300 text-violet-600 border-violet-500/30",
    heading: "dark:text-violet-300 text-violet-600",
    border: "border-violet-500/20 hover:border-violet-500/50",
  },
  Expert: {
    badge: "bg-rose-500/15 dark:text-rose-300 text-rose-600 border-rose-500/30",
    heading: "dark:text-rose-300 text-rose-600",
    border: "border-rose-500/20 hover:border-rose-500/50",
  },
};
