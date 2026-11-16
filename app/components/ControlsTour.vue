<script setup lang="ts">
// The game's controls tour, drawn by driver.js over the [data-tour] controls. app.vue loads it
// lazily (defineAsyncComponent), so driver.js and its CSS load only when a tour plays.
import { driver } from "driver.js";

const emit = defineEmits<{ (e: "done"): void }>();
const { t } = useI18n();
const still = useMediaQuery("(prefers-reduced-motion: reduce)").value;

const STEPS = ["digits", "notes", "hint", "undo", "pause"] as const;
const tour = driver({
  steps: STEPS.map((id) => ({
    element: `[data-tour="${id}"]`,
    popover: { title: t(`tour.${id}Title`), description: t(`tour.${id}`) },
  })),
  animate: !still,
  smoothScroll: !still,
  showProgress: true,
  progressText: t("tour.progress", { current: "{{current}}", total: "{{total}}" }),
  nextBtnText: t("tour.next"),
  prevBtnText: t("tour.prev"),
  doneBtnText: t("tour.done"),
  closeBtnLabel: t("tour.close"),
  popoverClass: "controls-tour",
  // A look, not a lesson: the highlighted control can't be pressed mid-tour.
  disableActiveInteraction: true,
  // An overlay scope for a controller (useGamepad): the D-pad walks its buttons, A presses one.
  onPopoverRender: (popover) => popover.wrapper.setAttribute("data-pad-scope", ""),
  onDestroyed: () => emit("done"),
});
onMounted(() => tour.drive());
onUnmounted(() => {
  if (tour.isActive()) tour.destroy();
});
</script>

<template>
  <!-- driver.js draws the tour on <body> -->
</template>

<style src="driver.js/dist/driver.css"></style>

<!-- Non-scoped: driver.js draws outside this component and .dark lives on <html>. Two classes beat
     driver.css, which resets the popover with all: unset. Paper card, ink outline, like .panel. -->
<style>
.driver-popover.controls-tour {
  font-family: inherit;
  color: var(--color-zinc-900);
  background: var(--tile);
  border: 1.5px solid var(--tray-line);
  border-radius: 0.5rem;
  box-shadow: 0.1875rem 0.1875rem 0 var(--tile-lip);
  padding: 1rem;
}
.dark .driver-popover.controls-tour {
  color: var(--color-zinc-100);
}
/* The cut-out already points at the control. */
.controls-tour .driver-popover-arrow {
  display: none;
}
.controls-tour .driver-popover-title {
  padding-right: 1.5rem;
  font-size: 1rem;
  font-weight: 800;
}
.controls-tour .driver-popover-description {
  font-size: 0.875rem;
}
.controls-tour .driver-popover-progress-text,
.controls-tour .driver-popover-close-btn {
  color: var(--color-zinc-500);
}
.controls-tour .driver-popover-close-btn:hover,
.controls-tour .driver-popover-close-btn:focus-visible {
  color: inherit;
}
.controls-tour .driver-popover-footer-btn {
  color: inherit;
  background: var(--tile);
  border: 1.5px solid var(--tile-edge);
  border-radius: 0.4375rem;
  box-shadow: 0.125rem 0.1875rem 0 var(--tile-lip);
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
}
.controls-tour .driver-popover-footer-btn:hover,
.controls-tour .driver-popover-footer-btn:focus-visible {
  background: var(--tile);
  border-color: var(--tray-line);
}
.controls-tour :focus-visible {
  outline: 2px solid var(--tray-line);
  outline-offset: 2px;
}
</style>
