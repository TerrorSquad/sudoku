<script lang="ts">
import type { Lesson } from "../utils/lesson";
import type { Beat } from "../utils/patternMarks";
import type { TechniqueId } from "../utils/sudokuGrader";

// The steps of each example, built once (lessonFromExample replays the solver).
const cache = new Map<TechniqueId, { lesson: Lesson | null; steps: Beat[] }>();
function stepsOf(id: TechniqueId) {
  let entry = cache.get(id);
  if (!entry) {
    const lesson = lessonFromExample(id);
    const steps: Beat[] = lesson
      ? beats(lesson.move, (r, c, n) => !!lesson.notes[r]?.[c]?.includes(n))
      : [{ step: "result", marks: [] }];
    cache.set(id, (entry = { lesson, steps }));
  }
  return entry;
}
</script>

<script setup lang="ts">
// A worked example that can play its move out in narrated steps (utils/patternMarks.ts `beats`):
// where to look, the pattern's cells, its links, then what it removes or places. It rests on the
// last step, the full drawing, so the card reads as before until someone presses Watch it. The words
// are the move told with the example's real rows and columns (explain.ts), each beat saying what
// it draws: all of it at rest.

import type { AcademyExample } from "../utils/academyExamples";

const props = defineProps<{
  id: TechniqueId;
  example: AcademyExample;
  elimination: { r: number; c: number }[];
}>();
const { t } = useI18n();

const { lesson, steps } = stepsOf(props.id);
// The Academy's boards show digits, so the words do too (no colour mode here).
const story = computed(() =>
  lesson ? narrate(lesson.move, (r, c, n) => !!lesson.notes[r]?.[c]?.includes(n), t, String) : [],
);
const caption = computed(() => story.value.map((s) => s.text).join(" "));
// A beat tells the sentences since the last beat shown: a step with nothing to draw is skipped,
// so its words go with the next one.
const ORDER = ["look", "cells", "links", "result"];
function told(i: number): string {
  const from = i ? ORDER.indexOf(steps[i - 1]!.step) : -1;
  const to = ORDER.indexOf(steps[i]!.step);
  return story.value
    .filter((s) => ORDER.indexOf(s.step) > from && ORDER.indexOf(s.step) <= to)
    .map((s) => s.text)
    .join(" ");
}
const last = steps.length - 1;
const i = ref(last);
const watching = ref(false); // stepped away from the resting full drawing at least once
const playing = ref(false);
// Reduced motion: no auto-advance, just the step controls.
// Read once: a live value could hide Play/Pause mid-playback.
const still = useMediaQuery("(prefers-reduced-motion: reduce)").value;

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
  if (!watching.value) return caption.value;
  const step = beat.value.step;
  if (step === "look") return t(`academy.tech.${props.id}.lookFor`);
  return told(i.value) || (step === "result" ? caption.value : t(`academy.watch.${step}`));
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
  playing.value = true;
  tick();
}
function go(to: number) {
  stop();
  watching.value = true;
  i.value = Math.min(last, Math.max(0, to));
}
// Space plays or pauses; with reduced motion (no Play) it steps on, round to the start at the end.
const space = () =>
  still ? go(i.value >= last ? 0 : i.value + 1) : playing.value ? stop() : play();
onUnmounted(stop);

// Space and ←/→ once the example has focus (a focused button keeps its own Space).
function onKey(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey) return; // Alt+← is the browser's Back
  if (e.key === " " && !onButton(e)) {
    e.preventDefault();
    space();
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
    role="group"
    aria-keyshortcuts="Space ArrowLeft ArrowRight"
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
    <!-- aria-disabled, not disabled, at the ends: a disabled button drops its own focus. -->
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
        :aria-disabled="i === 0"
        @click="go(i - 1)"
      >
        <AppIcon class="h-4 w-4" path="M15 19l-7-7 7-7" />
      </button>
      <button
        v-if="!still"
        class="tile tile-primary h-8 px-3 text-xs font-bold"
        data-testid="watch-play"
        @click="space"
      >
        {{ playing ? $t("academy.watch.pause") : $t("academy.watch.play") }}
      </button>
      <button
        class="tile grid h-8 w-8 place-items-center"
        :aria-label="$t('academy.watch.forward')"
        :title="$t('academy.watch.forward')"
        :aria-disabled="i === last"
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
