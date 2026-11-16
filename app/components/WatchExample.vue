<script setup lang="ts">
// A worked example that can play its move out in narrated steps (utils/patternMarks.ts `beats`):
// where to look, the pattern's cells, its links, then what it removes or places. It rests on the
// last step, the full drawing, so the card reads as before until someone presses Watch it.
import { computed, onUnmounted, ref } from "vue";

import type { AcademyExample } from "../utils/academyExamples";
import type { TechniqueId } from "../utils/sudokuGrader";

import { lessonFromExample } from "../utils/lesson";
import { beats } from "../utils/patternMarks";
import ExampleGrid from "./ExampleGrid.vue";

const props = defineProps<{
  id: TechniqueId;
  example: AcademyExample;
  elimination: { r: number; c: number }[];
  /** The board-accurate caption of the whole move: the last step's line. */
  caption: string;
}>();
const { t } = useI18n();

const lesson = lessonFromExample(props.id);
const steps = lesson
  ? beats(lesson.move, (r, c, n) => !!lesson.notes[r]?.[c]?.includes(n))
  : [{ step: "result" as const, marks: [] }];
const last = steps.length - 1;
const i = ref(last);
const watching = ref(false); // stepped away from the resting full drawing at least once
const playing = ref(false);
// Reduced motion: no auto-advance, just the step controls.
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

const beat = computed(() => steps[i.value]!);
const at = (step: string) => steps.findIndex((s) => s.step === step);
// The cell fills follow the steps too: the pattern once it's ringed, the result at the end.
const shown = computed(() => {
  const past = (step: string) => !watching.value || i.value >= Math.max(at(step), 0);
  return {
    trigger: past("cells") ? props.example.trigger : [],
    elimination: past("result") ? props.elimination : [],
    target: past("result") ? props.example.target : [],
  };
});
const line = computed(() => {
  if (!watching.value) return props.caption;
  switch (beat.value.step) {
    case "look":
      return t(`academy.tech.${props.id}.lookFor`);
    case "cells":
      return t("academy.watch.cells");
    case "links":
      return t("academy.watch.links");
    default:
      return props.caption;
  }
});

const PACE_MS = 1800;
let timer: ReturnType<typeof setTimeout> | undefined;
function stop() {
  playing.value = false;
  clearTimeout(timer);
}
function tick() {
  if (i.value >= last) return stop();
  timer = setTimeout(() => {
    i.value++;
    tick();
  }, PACE_MS);
}
function play() {
  watching.value = true;
  if (i.value >= last) i.value = 0;
  if (still) return;
  playing.value = true;
  tick();
}
const toggle = () => (playing.value ? stop() : play());
function go(to: number) {
  stop();
  watching.value = true;
  i.value = Math.min(last, Math.max(0, to));
}
onUnmounted(stop);

// Space plays or pauses, ←/→ step, once the example has focus (a focused button keeps its Space).
function onKey(e: KeyboardEvent) {
  const onButton = !!(e.target as HTMLElement).closest?.("button");
  if (e.key === " " && !onButton) {
    e.preventDefault();
    toggle();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    go(i.value - 1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    go(i.value + 1);
  }
}
</script>

<template>
  <div
    tabindex="0"
    class="rounded-lg outline-offset-4"
    :aria-label="$t('academy.watch.region')"
    data-testid="watch-example"
    @keydown="onKey"
  >
    <ExampleGrid
      :board="example.board"
      :notes="example.notes"
      :target="shown.target"
      :trigger="shown.trigger"
      :elimination="shown.elimination"
      :marks="beat.marks"
      :digits="watching ? example.digits : undefined"
    />
    <div class="mt-3 flex items-center justify-center gap-1.5">
      <button
        class="tile grid h-8 w-8 place-items-center"
        :aria-label="$t('academy.watch.restart')"
        :title="$t('academy.watch.restart')"
        @click="go(0)"
      >
        <AppIcon class="h-4 w-4" path="M4 4v6h6M4.5 15a8 8 0 102.3-8.3L4 10" />
      </button>
      <button
        class="tile grid h-8 w-8 place-items-center"
        :aria-label="$t('academy.watch.back')"
        :title="$t('academy.watch.back')"
        :disabled="i === 0"
        @click="go(i - 1)"
      >
        <AppIcon class="h-4 w-4" path="M15 19l-7-7 7-7" />
      </button>
      <button
        v-if="!still"
        class="tile tile-primary h-8 px-3 text-xs font-bold"
        :aria-pressed="playing"
        data-testid="watch-play"
        @click="toggle"
      >
        {{ playing ? $t("academy.watch.pause") : $t("academy.watch.play") }}
      </button>
      <button
        class="tile grid h-8 w-8 place-items-center"
        :aria-label="$t('academy.watch.forward')"
        :title="$t('academy.watch.forward')"
        :disabled="i === last"
        @click="go(i + 1)"
      >
        <AppIcon class="h-4 w-4" path="M9 5l7 7-7 7" />
      </button>
      <span class="ml-1 text-[0.6875rem] font-semibold text-zinc-500 tabular-nums">{{
        $t("academy.watch.step", { n: i + 1, total: steps.length })
      }}</span>
    </div>
    <p
      class="mx-auto mt-3 min-h-10 max-w-sm text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
      aria-live="polite"
      data-testid="watch-caption"
    >
      {{ line }}
    </p>
  </div>
</template>
