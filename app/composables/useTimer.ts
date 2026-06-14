import { ref } from "vue";

export function useTimer() {
  const timerSeconds = ref<number>(0);
  const timerInterval = ref<ReturnType<typeof setInterval> | null>(null);
  const isPaused = ref<boolean>(false);

  function startTimer() {
    if (timerInterval.value) return;
    timerInterval.value = setInterval(() => {
      timerSeconds.value++;
    }, 1000);
    isPaused.value = false;
  }

  function stopTimer() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }
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

  function formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = (seconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
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
