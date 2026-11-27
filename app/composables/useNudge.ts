import { computed, ref, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";

import type { useSudokuEngine } from "./useSudokuEngine";

import { turnUnit } from "../utils/boardTurn";
import { patternUnit, unitNumber, type BoardUnit, type TechniqueId } from "../utils/sudokuGrader";

// "Nudge first" hint style: the first press names the technique and the row, column or box its
// pattern sits in (or the box holding a wrong entry); pressing again (or the banner's Explain
// button) gives the full step-by-step explanation.
export function useNudge(
  engine: Pick<ReturnType<typeof useSudokuEngine>, "currentBoard" | "peekHint"> &
    Partial<Pick<ReturnType<typeof useSudokuEngine>, "variant" | "turn">>,
  hintsUsed: Ref<number>,
  inGame: Ref<boolean>,
) {
  const { t } = useI18n();
  const nudge = ref<{ unit: BoardUnit; technique: TechniqueId | null } | null>(null);
  const nudgeUnit = computed(() => {
    const unit = nudge.value?.unit;
    if (!unit) return "";
    const u = turnUnit(unit, engine.turn?.value ?? 0); // as the player sees the board
    return t(`hint.nudge.unit.${u.kind}`, { n: unitNumber(u) });
  });
  // Set once a nudge has counted as a hint: explaining and applying that same step is free.
  let paid = false;
  function reset() {
    nudge.value = null;
    paid = false;
  }
  watch(engine.currentBoard, reset, { deep: true });
  // The nudge survives the pause screen's Settings detour, not leaving the game.
  watch(inGame, (playing) => {
    if (!playing) reset();
  });

  /** Shows the next hint as a nudge, counted as a hint; false when one shows already or none is left. */
  function showNudge(): boolean {
    if (nudge.value) return false;
    const peek = engine.peekHint();
    if (!peek) return false;
    nudge.value = peek.move
      ? { unit: patternUnit(peek.move, engine.variant?.value), technique: peek.move.technique }
      : { unit: { kind: "box", ...peek.at }, technique: null };
    hintsUsed.value++;
    paid = true;
    return true;
  }

  // Counts one hint per step, whether it ended at the nudge or went on to the explanation. `free`:
  // the player found this step's pattern themselves (a peek), so only a nudge already paid covers it.
  function chargeHint(free = false) {
    if (paid) paid = false;
    else if (!free) hintsUsed.value++;
  }

  return { nudge, nudgeUnit, showNudge, chargeHint };
}
