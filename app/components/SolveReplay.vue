<script setup lang="ts">
import type { Grid } from "../types/sudoku";
import type { StuckMoment, Placement } from "../utils/stuckMoments";
import type { TechniqueId } from "../utils/sudokuGrader";

// "Watch your solve" (the win modal): the game's placements replayed over its givens, with the
// stuck moments marked on the timeline and, at each one, the technique that would have broken it.
// The controls only: each step's board goes out as `frame`, for the game's own board to show.
const props = defineProps<{
  puzzle: Grid;
  placements: Placement[];
  stuck: StuckMoment[];
  zen: boolean; // no clock
}>();
const emit = defineEmits<{
  lesson: [id: TechniqueId];
  frame: [board: Grid, placed: Placement | null];
}>();

const { start, moves, marks } = replayOf(props.puzzle, props.placements, props.stuck);
const last = moves.length;

const step = ref(0);
const board = computed(() => boardAt(start, moves, step.value));
const placed = computed(() => moves[step.value - 1] ?? null);
const mark = computed(() => marks.find((m) => m.step === step.value));
watch([board, placed], ([b, p]) => emit("frame", b, p), { immediate: true });

const playing = ref(false);
// Reduced motion: no autoplay, just the step controls. Read once, like WatchExample.
const still = useMediaQuery("(prefers-reduced-motion: reduce)").value;
const SPEEDS = [1, 2, 4];
const speed = ref(1);
const PACE_MS = 700;
let timer: ReturnType<typeof setTimeout> | undefined;
function stop() {
  playing.value = false;
  clearTimeout(timer);
}
function tick() {
  timer = setTimeout(() => {
    step.value++;
    // Rest on a stuck moment, so its line can be read.
    if (step.value >= last || mark.value) return stop();
    tick();
  }, PACE_MS / speed.value);
}
function play() {
  if (step.value >= last) step.value = 0;
  playing.value = true;
  tick();
}
function go(to: number) {
  stop();
  step.value = Math.min(last, Math.max(0, to));
}
const space = () =>
  still ? go(step.value >= last ? 0 : step.value + 1) : playing.value ? stop() : play();
onUnmounted(stop);

// Space and ←/→ anywhere in the replay, except on a button (its own Space) or the slider (its own
// arrows).
function onKey(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target instanceof HTMLInputElement) return;
  if (e.key === " " && !onButton(e)) {
    e.preventDefault();
    space();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    go(step.value + (e.key === "ArrowLeft" ? -1 : 1));
  }
}
</script>

<template>
  <div
    tabindex="0"
    role="group"
    :aria-label="$t('modal.watchRegion')"
    aria-keyshortcuts="Space ArrowLeft ArrowRight"
    class="rounded-lg outline-offset-4"
    data-testid="solve-replay"
    @keydown="onKey"
  >
    <h2 class="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">{{ $t("modal.watch") }}</h2>
    <p
      class="text-center text-xs font-semibold text-zinc-600 tabular-nums dark:text-zinc-400"
      aria-live="polite"
      data-testid="replay-step"
    >
      {{ step ? $t("modal.watchMove", { n: step, total: last }) : $t("modal.watchGivens") }}
      <template v-if="placed && !zen"> · {{ formatTime(placed.t) }}</template>
    </p>

    <!-- The timeline: a slider, with a marker over it for each stuck moment. -->
    <div class="relative mt-2 px-3 pt-6">
      <button
        v-for="m in marks"
        :key="m.step"
        class="absolute top-0 grid h-6 w-6 -translate-x-1/2 place-items-center"
        :style="{ left: `calc(0.75rem + (100% - 1.5rem) * ${m.step / last})` }"
        :aria-label="$t('modal.watchStuckMark', { at: formatTime(m.at) })"
        :title="$t('modal.watchStuckMark', { at: formatTime(m.at) })"
        data-testid="stuck-mark"
        @click="go(m.step)"
      >
        <span class="h-4 w-1.5 rounded-sm bg-rose-500" />
      </button>
      <input
        type="range"
        min="0"
        :max="last"
        :value="step"
        :aria-label="$t('modal.watchTimeline')"
        :aria-valuetext="
          step ? $t('modal.watchMove', { n: step, total: last }) : $t('modal.watchGivens')
        "
        class="w-full accent-violet-600"
        @input="go(Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- aria-disabled, not disabled, at the ends: a disabled button drops its own focus. -->
    <div class="mt-2 flex items-center justify-center gap-1.5">
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
        :aria-disabled="step === 0"
        @click="go(step - 1)"
      >
        <AppIcon class="h-4 w-4" path="M15 19l-7-7 7-7" />
      </button>
      <button v-if="!still" class="tile tile-primary h-8 px-3 text-xs font-bold" @click="space">
        {{ playing ? $t("academy.watch.pause") : $t("modal.watchPlay") }}
      </button>
      <button
        class="tile grid h-8 w-8 place-items-center"
        :aria-label="$t('academy.watch.forward')"
        :title="$t('academy.watch.forward')"
        :aria-disabled="step === last"
        @click="go(step + 1)"
      >
        <AppIcon class="h-4 w-4" path="M9 5l7 7-7 7" />
      </button>
      <button
        v-if="!still"
        class="tile h-8 px-2 text-xs font-bold tabular-nums"
        :aria-label="`${$t('modal.watchSpeed')}: ${speed}×`"
        :title="$t('modal.watchSpeed')"
        @click="speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!"
      >
        {{ speed }}×
      </button>
    </div>

    <!-- At a stuck moment: how long, and what would have broken it. -->
    <div
      class="mt-3 min-h-14 text-center text-xs text-zinc-700 dark:text-zinc-300"
      aria-live="polite"
      data-testid="replay-stuck"
    >
      <template v-if="mark">
        <p class="font-semibold text-rose-700 tabular-nums dark:text-rose-300">
          {{ $t("modal.stuckAt", { at: formatTime(mark.at), gap: formatTime(mark.gap) }) }}
        </p>
        <p v-if="mark.technique" class="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
          {{ $t("modal.watchUnblock") }}
          <button
            :title="$t('modal.openLesson')"
            class="min-h-6 border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[0.6875rem] font-semibold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
            @click="emit('lesson', mark.technique!)"
          >
            {{ $t(`hint.move.${mark.technique}.name`) }}
          </button>
        </p>
      </template>
    </div>
  </div>
</template>
