<script setup lang="ts">
import type { BoardUnit } from "../utils/sudokuGrader";

// A finished row, column, box or diagonal ticked off in pen: a stroke under a row, beside a
// column, round a box, along a diagonal. One SVG in board units; each stroke draws itself once,
// then fades. `units` carry the placed cell (r, c), which names the unit.
const props = defineProps<{ units: BoardUnit[] }>();

function path({ kind, r, c }: BoardUnit): string {
  if (kind === "row") return `M0.3 ${r + 0.86} Q4.5 ${r + 0.95} 8.7 ${r + 0.83}`;
  if (kind === "col") return `M${c + 0.86} 0.3 Q${c + 0.95} 4.5 ${c + 0.83} 8.7`;
  if (kind === "diag") return "M0.35 0.35 L8.65 8.65";
  if (kind === "anti") return "M8.65 0.35 L0.35 8.65";
  const x = c - (c % 3);
  const y = r - (r % 3);
  // Round the box and a little past the start, the way a pen closes a loop.
  return `M${x + 0.4} ${y + 0.12} H${x + 2.7} Q${x + 2.9} ${y + 0.12} ${x + 2.9} ${y + 0.4} V${y + 2.65} Q${x + 2.9} ${y + 2.9} ${x + 2.65} ${y + 2.9} H${x + 0.35} Q${x + 0.1} ${y + 2.9} ${x + 0.1} ${y + 2.65} V${y + 0.35} Q${x + 0.1} ${y + 0.08} ${x + 0.6} ${y + 0.1}`;
}
const strokes = computed(() =>
  props.units.map((u) => ({ key: `${u.kind}-${u.r}-${u.c}`, d: path(u) })),
);
</script>

<template>
  <svg
    class="unit-strokes pointer-events-none absolute inset-0 z-20 h-full w-full"
    viewBox="0 0 9 9"
    preserveAspectRatio="none"
    aria-hidden="true"
    data-testid="unit-strokes"
  >
    <path
      v-for="(s, i) in strokes"
      :key="s.key"
      :d="s.d"
      :style="{ '--stagger': `${i * 120}ms` }"
      pathLength="1"
    />
  </svg>
</template>

<!-- Non-scoped: the dark variant hangs off <html>. -->
<style>
.unit-strokes {
  fill: none;
  stroke: #1f8a5b;
  stroke-width: 0.07;
  stroke-linecap: round;
  overflow: visible;
  mix-blend-mode: multiply;
}
.dark .unit-strokes {
  stroke: var(--color-emerald-300);
  mix-blend-mode: normal;
}
.unit-strokes path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  /* Each stroke starts on its own beat (--stagger), and fades 1.1 s after it starts. */
  animation:
    unit-draw 0.45s ease-out var(--stagger, 0s) forwards,
    unit-fade 0.4s ease-in calc(var(--stagger, 0s) + 1.1s) forwards;
}
@keyframes unit-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes unit-fade {
  to {
    opacity: 0;
  }
}
</style>
