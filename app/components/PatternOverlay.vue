<script setup lang="ts">
// The pattern drawn over the board in pen, as a puzzle book prints it (utils/patternMarks.ts).
// One SVG over the whole board, in board units; each mark draws itself on once when it appears,
// frames first, then links, rings, and the red-pen strokes last.

import type { Mark } from "../utils/patternMarks";

// turn: the board's quarter turns. Pencil marks turn back upright inside their cells, so the pen
// moves with them (turnSlot) and a written digit turns back too.
const props = defineProps<{ marks: Mark[]; turn?: number }>();

const ORDER: Record<Mark["kind"], number> = { frame: 0, line: 1, ring: 2, cross: 3, place: 3 };
const drawn = computed(() =>
  props.marks
    .map((m) => ({ m: turned(m), key: JSON.stringify(m) }))
    .filter((d, i, all) => all.findIndex((e) => e.key === d.key) === i)
    .toSorted((a, b) => ORDER[a.m.kind] - ORDER[b.m.kind])
    .map((d, i) => ({ ...d, delay: `${Math.min(i, 14) * 60}ms` })),
);
function turned(m: Mark): Mark {
  const q = props.turn ?? 0;
  if (!q) return m;
  if (m.kind === "line") return { ...m, a: turnSlot(m.a, q), b: turnSlot(m.b, q) };
  return m.kind === "ring" || m.kind === "cross" ? { ...m, at: turnSlot(m.at, q) } : m;
}
// Turns a ring's or cross's own drawing back upright about its point.
const upright = (at: { x: number; y: number }) =>
  props.turn ? `rotate(${-90 * props.turn} ${at.x} ${at.y})` : undefined;
// A cross: a short pen stroke rising through the mark.
const S = 0.13;
</script>

<template>
  <svg
    v-if="drawn.length"
    class="pattern-overlay pointer-events-none absolute inset-0 z-20 h-full w-full"
    viewBox="0 0 9 9"
    preserveAspectRatio="none"
    aria-hidden="true"
    data-testid="pattern-overlay"
  >
    <template v-for="{ m, key, delay } in drawn" :key="key">
      <rect
        v-if="m.kind === 'frame'"
        class="pm-frame"
        :style="{ animationDelay: delay }"
        :x="m.x + 0.04"
        :y="m.y + 0.04"
        :width="m.w - 0.08"
        :height="m.h - 0.08"
        rx="0.12"
      />
      <line
        v-else-if="m.kind === 'line'"
        :class="m.style === 'strong' ? 'pm-strong' : 'pm-weak'"
        :style="{ animationDelay: delay }"
        :x1="m.a.x"
        :y1="m.a.y"
        :x2="m.b.x"
        :y2="m.b.y"
        pathLength="1"
      />
      <g
        v-else-if="m.kind === 'ring'"
        :class="m.tone === 'alt' ? 'pm-alt' : ''"
        :transform="upright(m.at)"
      >
        <text
          v-if="m.ghost"
          class="pm-ghost-digit pm-ink"
          :x="m.at.x"
          :y="m.at.y"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {{ m.num }}
        </text>
        <circle
          class="pm-ring"
          :style="{ animationDelay: delay }"
          :cx="m.at.x"
          :cy="m.at.y"
          r="0.15"
          pathLength="1"
        />
      </g>
      <g v-else-if="m.kind === 'cross'" :class="{ 'pm-ghost': m.fade }" :transform="upright(m.at)">
        <text
          v-if="m.ghost"
          class="pm-ghost-digit"
          :x="m.at.x"
          :y="m.at.y"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {{ m.num }}
        </text>
        <line
          class="pm-cross"
          :style="{ animationDelay: m.fade ? '0ms' : delay }"
          :x1="m.at.x - S"
          :y1="m.at.y + S"
          :x2="m.at.x + S"
          :y2="m.at.y - S"
          pathLength="1"
        />
      </g>
      <circle
        v-else-if="m.kind === 'place'"
        class="pm-place"
        :style="{ animationDelay: delay }"
        :cx="m.at.x"
        :cy="m.at.y"
        r="0.4"
        pathLength="1"
      />
    </template>
  </svg>
</template>

<!-- Non-scoped: the dark variant hangs off <html>. Pen blue for the pattern, green ink for its
     second colour and placements, red pen for what it removes. -->
<style>
.pattern-overlay {
  --pm-pen: var(--color-violet-600);
  --pm-alt: #2f7d54;
  --pm-red: var(--color-rose-600);
  fill: none;
  stroke-linecap: round;
  overflow: visible;
  /* Ink, not paint: a line crossing a printed digit darkens under it instead of covering it. */
  mix-blend-mode: multiply;
}
.dark .pattern-overlay {
  --pm-pen: var(--color-violet-300);
  --pm-alt: #6fd39b;
  --pm-red: var(--color-rose-400);
  mix-blend-mode: screen;
}
.pm-frame {
  stroke: var(--pm-pen);
  stroke-width: 0.03;
  stroke-dasharray: 0.09 0.07;
  stroke-opacity: 0.7;
  opacity: 0;
  animation: pm-fade 0.3s ease-out forwards;
}
.pm-strong,
.pm-ring,
.pm-cross,
.pm-place {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: pm-draw 0.45s ease-out forwards;
}
.pm-strong {
  stroke: var(--pm-pen);
  stroke-width: 0.05;
}
.pm-weak {
  stroke: var(--pm-pen);
  stroke-width: 0.04;
  stroke-dasharray: 0.11 0.09;
  stroke-opacity: 0.75;
  opacity: 0;
  animation: pm-fade 0.35s ease-out forwards;
}
.pm-ring {
  stroke: var(--pm-pen);
  stroke-width: 0.035;
}
.pm-alt .pm-ring {
  stroke: var(--pm-alt);
}
.pm-ghost-digit.pm-ink {
  fill: var(--pm-pen);
}
.pm-alt .pm-ghost-digit.pm-ink {
  fill: var(--pm-alt);
}
.pm-cross {
  stroke: var(--pm-red);
  stroke-width: 0.05;
}
.pm-place {
  stroke: var(--pm-alt);
  stroke-width: 0.05;
}
/* A mark just crossed out: the digit lingers in red under the stroke, then both fade. */
.pm-ghost {
  animation: pm-gone 0.5s ease-in 0.7s forwards;
}
.pm-ghost-digit {
  fill: var(--pm-red);
  font-family: var(--font-game);
  font-size: 0.24px;
  font-weight: 900;
}
@keyframes pm-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes pm-fade {
  to {
    opacity: 1;
  }
}
@keyframes pm-gone {
  to {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pattern-overlay * {
    animation: none !important;
    stroke-dashoffset: 0;
    opacity: 1;
  }
  .pattern-overlay .pm-ghost {
    display: none;
  }
}
</style>
