<script setup lang="ts">
import type { WinResult } from "../composables/useWinResult";
import type { Difficulty, Grid } from "../types/sudoku";
import type { NewRecord } from "../utils/records";
import type { Placement } from "../utils/stuckMoments";
import type { TechniqueId } from "../utils/sudokuGrader";

// The end of a game: the win (stars, score, what it took) or the game over. Mounted per showing.
const props = defineProps<{
  title: string;
  message: string;
  win: boolean;
  difficultyLabel: string;
  statsKey: string; // the score row a record line names
  zen: boolean;
  practice: boolean;
  mistakes: number;
  hintsUsed: number;
  seconds: number;
  board: Grid; // the givens, for a challenge code and the replay
  placements: Placement[]; // the replay's moves
  result: WinResult | null; // null for a game over
  techniqueLog: TechniqueId[];
  nextLevel: Difficulty | null;
  nextLoading: boolean;
}>();
const emit = defineEmits<{
  next: [];
  close: [];
  lesson: [id: TechniqueId];
  cue: [kind: "tick" | "stamp", ...n: number[]];
  replay: [frame: { board: Grid; placed: Placement | null } | null];
}>();

const { t } = useI18n();

function recordLine(r: NewRecord): string {
  const show = (v: number | string) =>
    r.kind === "fastest" ? formatTime(v as number) : r.kind === "noHint" ? t(`difficulty.${v}`) : v;
  return t(`records.new.${r.kind}`, {
    difficulty: t(`difficulty.${props.statsKey}`),
    value: show(r.value),
    was: show(r.was),
  });
}

// A clean win: no mistakes and no hints (a nudge counts as one). Zen too: it's how you played.
const perfect = computed(() => props.win && props.mistakes === 0 && props.hintsUsed === 0);
const winStars = computed(() => starsFor(props.mistakes, props.hintsUsed));
const scoreRows = computed(() => {
  const s = props.result?.score;
  if (!s) return [];
  const good = "text-emerald-700 dark:text-emerald-400";
  return [
    { key: "scoreBase", value: s.base, cls: "text-zinc-800 dark:text-zinc-200" },
    { key: "scoreSpeed", value: s.speedBonus, cls: good },
    { key: "scoreFlawless", value: s.flawlessBonus, cls: good },
    {
      key: "scoreMistakePenalty",
      value: -s.mistakePenalty,
      cls: "text-rose-600 dark:text-rose-400",
    },
    { key: "scoreHintPenalty", value: -s.hintPenalty, cls: "text-amber-700 dark:text-amber-400" },
  ].filter((row, i) => !i || row.value);
});

// The win modal plays in steps (useWinSteps): stars, score lines, then the stamp.
const {
  winStep,
  winStepCount,
  scoreLanded,
  winSkipped,
  displayedScore,
  startWinSteps,
  skipWinSteps,
} = useWinSteps({
  stars: winStars,
  rows: scoreRows,
  perfect,
  total: () => props.result?.score?.total,
  cue: (kind, ...n) => emit("cue", kind, ...n),
});

const GAME_URL = "https://wavedash.com/games/sudoku-pro";

// Share a win: the system share sheet where there is one (phones), else the clipboard.
const shared = ref(false);
async function shareWin() {
  const lines = [
    `${t("menu.title")} · ${props.difficultyLabel}`,
    [
      props.zen ? null : `⏱ ${formatTime(props.seconds)}`,
      "★".repeat(winStars.value) + "☆".repeat(3 - winStars.value),
      t("modal.shareMistakes", { n: props.mistakes }),
      t("modal.shareHints", { n: props.hintsUsed }),
    ]
      .filter(Boolean)
      .join(" · "),
    // A friend pastes the code into Your puzzle to play this board against this time. Not a
    // practice board: a drill starts with notes the code can't carry, so the time isn't comparable.
    props.practice
      ? null
      : t(props.zen ? "modal.shareChallengeZen" : "modal.shareChallenge", {
          code: encodeChallenge(props.board, props.zen ? 0 : props.seconds),
        }),
    GAME_URL,
  ];
  const text = lines.filter(Boolean).join("\n");
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    shared.value = true;
    setTimeout(() => (shared.value = false), 2000);
  };
  try {
    if (!navigator.share) return await copy();
    try {
      await navigator.share({ text });
    } catch (e) {
      // A dismissed sheet is the player's choice; anything else (an iframe without web-share
      // permission says NotAllowedError) falls back to the clipboard.
      if ((e as Error).name !== "AbortError") await copy();
    }
  } catch {
    // A blocked clipboard: nothing more to try.
  }
}

// On a settled end screen (not over a button, whose own Enter wins): Enter plays the next
// puzzle, Escape closes.
function handleModalKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  const press = e.key === "Enter" || e.key === " ";
  if (press && target.closest?.("[data-end-modal] button")) return; // that button's own click
  // A button behind the overlay kept focus (the numpad, Finish): it mustn't press.
  if (press) e.preventDefault();
  const settled = !props.win || winStep.value >= winStepCount.value;
  if (!settled || e.repeat) return;
  if (e.key === "Enter" && props.nextLevel) {
    e.preventDefault();
    emit("next");
  } else if (e.key === "Escape") {
    emit("close");
  }
}
// "Watch your solve", over the modal: its keys are its own (Esc closes it, back to here). It plays
// on the game's own board (`replay` frames), so the modal steps aside while it's open.
const watching = ref(false);
watch(watching, (on) => on || emit("replay", null));
const canWatch = computed(() => props.win && props.placements.some((p) => !p.restored));
function onKey(e: KeyboardEvent) {
  // The real dialog state: its close event (which clears `watching`) comes a task after Esc.
  if (document.querySelector("[data-end-modal] dialog[open]")) return;
  handleModalKey(e);
  // A key still held from the winning move, or pressed before the steps start, skips nothing.
  if (!e.repeat && winStep.value) skipWinSteps();
}

useEventListener(window, "keydown", onKey);
onMounted(() => {
  if (props.win) startWinSteps();
});
</script>

<template>
  <div
    data-end-modal
    data-pad-scope
    :class="[
      win ? 'modal-delay' : '',
      { 'win-done': winSkipped, 'bg-black/80 backdrop-blur-sm': !watching },
    ]"
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    @pointerdown="winStep && skipWinSteps()"
  >
    <div
      v-show="!watching"
      class="modal-pop panel max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto !rounded-2xl border-t-[0.375rem] p-6 text-center shadow-2xl"
      :class="win ? '!border-t-emerald-500' : '!border-t-rose-500'"
    >
      <h3 class="mb-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
        {{ title }}
      </h3>
      <p class="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {{ message }}
      </p>

      <!-- Star rating: each earned star fills in on its own step -->
      <div
        v-if="win"
        class="mb-4 flex justify-center gap-1.5"
        role="img"
        :aria-label="$t('modal.stars', { n: winStars })"
      >
        <span
          v-for="n in 3"
          :key="n"
          :class="
            n <= winStars && winStep >= n
              ? 'star-pop text-amber-400'
              : 'text-zinc-300 dark:text-zinc-700'
          "
          class="text-3xl leading-none"
          aria-hidden="true"
          >★</span
        >
      </div>

      <!-- A clean win gets the teacher's red-pen stamp, last -->
      <div v-if="perfect" class="mb-4 flex justify-center">
        <span
          data-testid="perfect-stamp"
          class="perfect-stamp"
          :class="winStep >= winStepCount ? 'stamp-in' : 'opacity-0'"
          >{{ $t("modal.perfect") }}</span
        >
      </div>

      <p
        v-if="result?.reachedLevel"
        class="score-badge mb-4 border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-700 dark:text-violet-300"
      >
        ▲ {{ $t("level.up", { n: result.reachedLevel }) }}
      </p>
      <p
        v-for="note in result?.notes ?? []"
        :key="note.text"
        :class="
          note.ok
            ? 'score-badge border-emerald-500/40 bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-300'
            : 'border-zinc-300 font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
        "
        class="mb-4 border px-3 py-2 text-xs"
      >
        {{ note.text }}
      </p>
      <p
        v-for="r in result?.records ?? []"
        :key="r.kind"
        data-testid="new-record"
        :class="scoreLanded ? 'win-in' : 'opacity-0'"
        class="mb-4 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-800 dark:text-amber-300"
      >
        {{ recordLine(r) }}
      </p>

      <!-- Score headline: the total counts up through the lines as they appear -->
      <div v-if="result?.score" class="mb-5">
        <p class="text-[0.6875rem] font-semibold text-zinc-500">
          {{ $t("modal.scoreTotal") }}
        </p>
        <p class="text-5xl leading-tight font-black text-zinc-900 tabular-nums dark:text-zinc-50">
          <span aria-hidden="true">{{ displayedScore }}</span>
          <span class="sr-only">{{ result.score.total }}</span>
        </p>
        <p
          v-if="result.isNewBest"
          :class="scoreLanded ? 'win-in' : 'opacity-0'"
          class="mt-1 inline-block border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.625rem] font-black text-amber-800 dark:text-amber-300"
        >
          ★ {{ $t("modal.scoreNewBest") }}
        </p>

        <!-- breakdown -->
        <div
          class="mt-3 divide-y divide-zinc-200 border border-zinc-200 text-left text-xs dark:divide-zinc-800 dark:border-zinc-800"
        >
          <div
            v-for="(row, i) in scoreRows"
            :key="row.key"
            :class="winStep > winStars + i ? 'win-in' : 'opacity-0'"
            class="flex justify-between px-3 py-1.5"
          >
            <span class="text-zinc-500">{{ $t(`modal.${row.key}`) }}</span>
            <span :class="row.cls" class="font-bold tabular-nums"
              >{{ i ? (row.value > 0 ? "+" : "−") : "" }}{{ Math.abs(row.value) }}</span
            >
          </div>
          <div
            :class="scoreLanded ? 'win-in' : 'opacity-0'"
            class="flex justify-between bg-zinc-500/5 px-3 py-1.5"
          >
            <span class="font-semibold text-zinc-500 dark:text-zinc-400">{{
              $t("modal.scoreLifetime")
            }}</span>
            <span class="font-bold text-zinc-700 tabular-nums dark:text-zinc-300">{{
              result.lifetimeTotal
            }}</span>
          </div>
        </div>
      </div>

      <!-- Win summary -->
      <WinSummary
        v-if="result"
        :difficulty-label="difficultyLabel"
        :zen="zen"
        :mistakes="mistakes"
        :hints-used="hintsUsed"
        :result="result"
        :technique-log="techniqueLog"
        @lesson="(id) => emit('lesson', id)"
      />

      <button
        v-if="canWatch"
        @click="watching = true"
        data-testid="watch-solve"
        class="mb-2 w-full text-sm font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
      >
        {{ $t("modal.watch") }}
      </button>
      <button
        v-if="win"
        @click="shareWin"
        class="mb-2 w-full text-sm font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
      >
        {{ shared ? $t("modal.copied") : $t("modal.share") }}
      </button>
      <div class="flex gap-2">
        <button
          v-if="nextLevel"
          @click="emit('next')"
          data-testid="next-puzzle"
          :aria-busy="nextLoading"
          :disabled="nextLoading"
          class="tile tile-primary flex-1 py-3 text-sm font-bold"
        >
          {{ $t("modal.nextPuzzle", { level: $t(`difficulty.${nextLevel}`) }) }}
        </button>
        <button
          @click="emit('close')"
          :class="nextLevel ? 'px-5' : 'tile-primary flex-1'"
          class="tile py-3 text-sm font-bold"
        >
          {{ $t("modal.close") }}
        </button>
      </div>
    </div>
    <SheetDialog
      v-model:open="watching"
      class="panel mx-auto mt-auto mb-4 max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-4 text-inherit backdrop:bg-transparent lg:mr-8 lg:mb-8"
      :aria-label="$t('modal.watch')"
    >
      <SolveReplay
        v-if="watching && result"
        :puzzle="board"
        :placements="placements"
        :stuck="result.stuck"
        :zen="zen"
        @lesson="(id) => emit('lesson', id)"
        @frame="(board, placed) => emit('replay', { board, placed })"
      />
      <button @click="watching = false" class="tile mt-3 w-full py-2 text-sm font-bold">
        {{ $t("modal.close") }}
      </button>
    </SheetDialog>
  </div>
</template>

<!-- Non-scoped: the .dark ancestor lives on <html>, outside this component's scope. -->
<style>
/* The result appears after the win wave has swept the board. */
.modal-delay {
  animation: modal-delay 0.3s 0.9s ease-out both;
}
@keyframes modal-delay {
  from {
    opacity: 0;
    pointer-events: none;
  }
  to {
    opacity: 1;
    pointer-events: auto;
  }
}

@keyframes star-pop {
  0% {
    transform: scale(0) rotate(-30deg);
    opacity: 0;
  }
  70% {
    transform: scale(1.3) rotate(8deg);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}
.star-pop {
  animation: star-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* A win-modal line appearing on its step. */
.win-in {
  animation: win-in 0.22s ease-out both;
}
@keyframes win-in {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }
}

/* "Perfect!" in the teacher's red pen, stamped on at a slant. */
.perfect-stamp {
  display: inline-block;
  padding: 0.2rem 0.8rem;
  border: 0.25rem double currentColor;
  border-radius: 0.375rem;
  color: var(--color-rose-700);
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-8deg);
}
.dark .perfect-stamp {
  color: var(--color-rose-300);
}
.stamp-in {
  animation: stamp-in 0.3s cubic-bezier(0.3, 1.3, 0.5, 1) both;
}
@keyframes stamp-in {
  0% {
    opacity: 0;
    transform: rotate(-8deg) scale(2.2);
  }
  65% {
    opacity: 1;
    transform: rotate(-8deg) scale(0.94);
  }
  100% {
    transform: rotate(-8deg) scale(1);
  }
}

/* Skipped (a tap or a key): everything is already in place. */
.win-done .win-in,
.win-done .star-pop,
.win-done .stamp-in {
  animation: none;
}

@keyframes score-badge {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  70% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.score-badge {
  animation: score-badge 0.4s 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
</style>
