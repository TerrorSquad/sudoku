import { ref } from "vue";

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

export function useTimer() {
  const timerSeconds = ref<number>(0);
  const isPaused = ref<boolean>(false);
  const {
    pause: stopTimer,
    resume,
    isActive,
  } = useIntervalFn(() => timerSeconds.value++, 1000, { immediate: false });

  function startTimer() {
    if (isActive.value) return; // resume() would restart the second under way
    resume();
    isPaused.value = false;
  }

  function resetTimer() {
    stopTimer();
    timerSeconds.value = 0;
    isPaused.value = false;
  }

  function togglePause() {
    if (isPaused.value) {
      startTimer();
    } else {
      stopTimer();
      isPaused.value = true;
    }
  }

  return {
    timerSeconds,
    isPaused,
    startTimer,
    stopTimer,
    resetTimer,
    togglePause,
    formatTime,
  };
}
