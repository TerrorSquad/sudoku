import { computed, onScopeDispose, ref, type Ref } from "vue";

// The win modal plays in steps once it has faded in: each earned star with a tick, then each
// score line as the total counts up through it, then the stamp. The DOM holds the real numbers
// throughout (unrevealed parts are only transparent). A tap or key skips to the end, and reduced
// motion starts there.
const WIN_STEPS_AT_MS = 1100; // as .modal-delay finishes fading the result in
const WIN_STEP_MS = 160;

export function useWinSteps(opts: {
  stars: Ref<number>;
  rows: Ref<{ value: number }[]>;
  perfect: Ref<boolean>;
  /** The real total, which the count lands on. */
  total: () => number | undefined;
  cue: (kind: "tick" | "stamp", ...n: number[]) => void;
}) {
  const { stars: winStars, rows: scoreRows, perfect, total, cue } = opts;
  const winStepCount = computed(
    () => winStars.value + scoreRows.value.length + (perfect.value ? 1 : 0),
  );
  const winStep = ref(0);
  // The total has landed: what hangs off it (a new best, records, the lifetime line) shows now.
  const scoreLanded = computed(() => winStep.value >= winStars.value + scoreRows.value.length);
  const winSkipped = ref(false);
  const displayedScore = ref<number>(0); // the visual total; the real one sits beside it, sr-only
  let winTimers: ReturnType<typeof setTimeout>[] = [];
  let countFrame = 0;

  function stopWinSteps() {
    winTimers.forEach(clearTimeout);
    winTimers = [];
    cancelAnimationFrame(countFrame);
  }

  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  function startWinSteps() {
    stopWinSteps();
    winStep.value = 0;
    winSkipped.value = false;
    displayedScore.value = 0;
    if (reducedMotion.value) {
      skipWinSteps();
      if (perfect.value) cue("stamp");
      return;
    }
    for (let k = 1; k <= winStepCount.value; k++)
      winTimers.push(setTimeout(() => winStepTo(k), WIN_STEPS_AT_MS + (k - 1) * WIN_STEP_MS));
  }

  function winStepTo(k: number) {
    winStep.value = k;
    const rows = scoreRows.value;
    const row = k - winStars.value - 1;
    if (k <= winStars.value) cue("tick", k);
    else if (row < rows.length) {
      const sum = rows.slice(0, row + 1).reduce((a, r) => a + r.value, 0);
      // Penalties can take the running sum below zero; the real total is floored, so it lands there.
      countScoreTo(row === rows.length - 1 ? total()! : Math.max(0, sum));
    } else cue("stamp");
  }

  function skipWinSteps() {
    if (winStep.value >= winStepCount.value) return;
    stopWinSteps();
    winSkipped.value = true;
    winStep.value = winStepCount.value;
    displayedScore.value = total() ?? 0;
  }

  function countScoreTo(to: number) {
    cancelAnimationFrame(countFrame);
    const from = displayedScore.value;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / WIN_STEP_MS);
      displayedScore.value = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) countFrame = requestAnimationFrame(tick);
    };
    countFrame = requestAnimationFrame(tick);
  }

  onScopeDispose(stopWinSteps);
  return {
    winStep,
    winStepCount,
    scoreLanded,
    winSkipped,
    displayedScore,
    startWinSteps,
    skipWinSteps,
  };
}
