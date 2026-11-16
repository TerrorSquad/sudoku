<script setup lang="ts">
import type { TechniqueId } from "../utils/sudokuGrader";

import { MASTERY_STYLE, TIER_STYLES as tierStyles } from "../utils/academyStyles";
import { ACADEMY_TECHNIQUES as techniques, BUILDS_ON, MAP_COLUMN } from "../utils/progression";

// The technique map: tiers as rows, each technique in its MAP_COLUMN, and a line from each
// technique to what builds on it (BUILDS_ON). Lines sit in the grid's own units (a cell is 1×1),
// so they meet the nodes' centres at any width.
const props = defineProps<{
  pathState: (id: TechniqueId) => "done" | "next" | "locked";
  starsOf: (id: TechniqueId) => number;
  masteryOf: (id: TechniqueId) => number;
}>();
const emit = defineEmits<{ (e: "open", id: TechniqueId): void }>();

const { t } = useI18n();
const techName = (id: TechniqueId) => t(`hint.move.${id}.name`);

const tiers = [...new Set(techniques.map((tech) => tech.tier))];
const MAP_COLS = Math.max(...Object.values(MAP_COLUMN)) + 1;
const mapPos = new Map(
  techniques.map((tech) => [tech.id, { row: tiers.indexOf(tech.tier), col: MAP_COLUMN[tech.id] }]),
);
// In the order they're drawn, row by row, so Tab follows what you see.
const mapNodes = techniques.toSorted(
  (a, b) => mapPos.get(a.id)!.row - mapPos.get(b.id)!.row || MAP_COLUMN[a.id] - MAP_COLUMN[b.id],
);
// The links are drawn (aria-hidden), so each node also says what it builds on.
const buildsOnText = (id: TechniqueId) =>
  BUILDS_ON[id]?.length
    ? t("academy.map.buildsOn", { names: BUILDS_ON[id]!.map(techName).join(", ") })
    : "";
const occupied = (row: number, col: number) =>
  [...mapPos.values()].some((p) => p.row === row && p.col === col);
const mapEdges = Object.entries(BUILDS_ON).flatMap(([id, pre]) =>
  pre.map((from) => {
    const a = mapPos.get(from)!;
    const b = mapPos.get(id as TechniqueId)!;
    const [x1, y1, x2, y2] = [a.col + 0.5, a.row + 0.5, b.col + 0.5, b.row + 0.5];
    // Along a row, bow over any node in between rather than run behind it. The curve peaks
    // halfway to its control point: 0.45 of a row up, above even a tile with stars and a badge.
    const span = Math.abs(a.col - b.col);
    const lo = Math.min(a.col, b.col);
    const between = Array.from({ length: Math.max(span - 1, 0) }, (_, k) => lo + k + 1);
    const d =
      a.row === b.row && between.some((col) => occupied(a.row, col))
        ? `M${x1} ${y1} Q${(x1 + x2) / 2} ${y1 - 0.9} ${x2} ${y2}`
        : `M${x1} ${y1} L${x2} ${y2}`;
    return { key: `${from}>${id}`, d, done: props.pathState(from) === "done" };
  }),
);
</script>

<template>
  <section
    class="panel mb-10 overflow-x-auto p-3 sm:p-4"
    :aria-label="$t('academy.view.map')"
    data-testid="technique-map"
  >
    <div class="flex min-w-[58rem]">
      <!-- Tier names, one per row. -->
      <div class="flex w-24 shrink-0 flex-col pr-2">
        <p
          v-for="tier in tiers"
          :key="tier"
          class="flex h-28 items-center text-xs font-black text-zinc-700 dark:text-zinc-300"
        >
          {{ $t(`academy.tier.${tier}`) }}
        </p>
      </div>
      <div
        class="relative grid flex-1 grid-rows-4"
        :style="{ gridTemplateColumns: `repeat(${MAP_COLS}, minmax(0, 1fr))` }"
      >
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          :viewBox="`0 0 ${MAP_COLS} ${tiers.length}`"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            v-for="e in mapEdges"
            :key="e.key"
            :d="e.d"
            fill="none"
            vector-effect="non-scaling-stroke"
            :class="
              e.done
                ? 'stroke-violet-500 dark:stroke-violet-400'
                : 'stroke-zinc-300 dark:stroke-zinc-600'
            "
            stroke-width="1.5"
          />
        </svg>
        <div
          v-for="tech in mapNodes"
          :key="tech.id"
          :style="{
            gridRow: mapPos.get(tech.id)!.row + 1,
            gridColumn: mapPos.get(tech.id)!.col + 1,
          }"
          class="relative flex h-28 items-center justify-center px-1"
        >
          <button
            :class="[
              tierStyles[tech.tier].border,
              pathState(tech.id) === 'next' && 'ring-2 ring-violet-500',
            ]"
            :data-path="pathState(tech.id)"
            :data-testid="`map-${tech.id}`"
            class="tile flex w-full flex-col items-center gap-0.5 px-1 py-1.5 text-center"
            @click="emit('open', tech.id)"
          >
            <span class="text-[0.6875rem] leading-tight font-bold text-zinc-900 dark:text-zinc-100">
              <span
                v-if="pathState(tech.id) === 'done'"
                class="text-emerald-700 dark:text-emerald-400"
                >✓
              </span>
              {{ techName(tech.id) }}
            </span>
            <span
              v-if="starsOf(tech.id)"
              class="text-[0.625rem] tracking-tight text-amber-700 dark:text-amber-400"
              :aria-label="$t('lesson.starsLabel', { n: starsOf(tech.id) })"
              role="img"
              >{{ "★".repeat(starsOf(tech.id)) + "☆".repeat(3 - starsOf(tech.id)) }}</span
            >
            <span
              v-if="masteryOf(tech.id) > 0"
              :class="MASTERY_STYLE[masteryOf(tech.id)]"
              class="border px-1 text-[0.5625rem] font-bold"
              >{{ $t(`academy.mastery.${masteryOf(tech.id)}`) }}</span
            >
            <span v-if="pathState(tech.id) === 'next'" class="sr-only">{{ $t("path.next") }}</span>
            <span v-if="buildsOnText(tech.id)" class="sr-only">{{ buildsOnText(tech.id) }}</span>
          </button>
        </div>
      </div>
    </div>
    <p class="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{{ $t("academy.map.hint") }}</p>
  </section>
</template>
