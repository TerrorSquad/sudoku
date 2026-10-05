import { ref, watch, type Ref } from "vue";

import { readJSON, writeJSON } from "../utils/safeJson";

// One place for every player preference, persisted per key under sudoku_v1_pref_*. The refs are
// module-level singletons so the game and the Settings screen always share the same state.

export type MistakeLimit = 0 | 3 | 5; // 0 = unlimited
export type HintStyle = "full" | "nudge";

function pref<T>(name: string, fallback: T): Ref<T> {
  const state = ref(readJSON<T>(`sudoku_v1_pref_${name}`, fallback)) as Ref<T>;
  watch(state, (v) => writeJSON(`sudoku_v1_pref_${name}`, v));
  return state;
}

let shared: ReturnType<typeof create> | null = null;

function create() {
  return {
    // Keys kept from before this composable existed, so nobody loses their settings.
    colorMode: pref("color_mode", false),
    soundEnabled: pref("sound", true),
    hapticsEnabled: pref("haptics", true),
    /** Tap a digit first, then tap cells to place it (faster on touch screens). */
    digitFirst: pref("digit_first", false),
    showTimer: pref("show_timer", true),
    mistakeLimit: pref<MistakeLimit>("mistake_limit", 3),
    /** Off = wrong entries are not marked; mistakes still count toward the score. */
    highlightErrors: pref("highlight_errors", true),
    hintStyle: pref<HintStyle>("hint_style", "full"),
  };
}

export function usePreferences() {
  shared ??= create();
  return shared;
}
