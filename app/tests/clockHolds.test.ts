import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { useClockHolds } from "../composables/useClockHolds";

function setup() {
  const live = ref(true);
  let ticking = false;
  const c = useClockHolds(() => live.value, {
    start: () => (ticking = true),
    stop: () => (ticking = false),
  });
  return { live, ticking: () => ticking, ...c };
}

describe("useClockHolds", () => {
  it("runs while live with nothing holding it", async () => {
    const c = setup();
    c.live.value = false;
    await nextTick();
    expect(c.ticking()).toBe(false);
    c.live.value = true;
    await nextTick();
    expect(c.ticking()).toBe(true);
    c.live.value = false; // leaving the game screen stops it
    await nextTick();
    expect(c.ticking()).toBe(false);
  });

  it("any hold stops it, and it restarts only once the last is released", async () => {
    const c = setup();
    c.live.value = false;
    await nextTick();
    c.live.value = true;
    c.holds.add("tour");
    await nextTick();
    expect(c.ticking()).toBe(false);
    c.togglePause(); // paused during the tour
    c.holds.delete("tour");
    await nextTick();
    expect(c.ticking()).toBe(false); // the tour ended, but the player's pause still holds it
    c.togglePause();
    await nextTick();
    expect(c.ticking()).toBe(true);
  });

  it("only the player's pause counts as paused", () => {
    const c = setup();
    c.holds.add("finished");
    c.holds.add("tour");
    expect(c.isPaused.value).toBe(false);
    c.togglePause();
    expect(c.isPaused.value).toBe(true);
    c.togglePause();
    expect(c.isPaused.value).toBe(false);
  });

  it("changes undone within a tick never touch the clock", async () => {
    const live = ref(true);
    let calls = 0;
    const c = useClockHolds(() => live.value, { start: () => calls++, stop: () => calls++ });
    c.holds.add("finished");
    c.holds.clear(); // the end modal closes on a new board in the same tick
    await nextTick();
    expect(calls).toBe(0);
    expect(c.running.value).toBe(true);
  });
});
