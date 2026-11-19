import { ref } from "vue";

export function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

// The game clock. When it runs is useClockHolds' call, not its callers'.
export function useTimer() {
  const timerSeconds = ref<number>(0);
  const {
    pause: stopTimer,
    resume,
    isActive,
  } = useIntervalFn(() => timerSeconds.value++, 1000, { immediate: false });

  function startTimer() {
    if (isActive.value) return; // resume() would restart the second under way
    resume();
  }

  return { timerSeconds, startTimer, stopTimer, formatTime };
}
