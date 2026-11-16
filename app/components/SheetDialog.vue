<script setup lang="ts">
// A modal <dialog> opened by v-model:open: showModal() moves focus in and Esc closes it natively.
const open = defineModel<boolean>("open", { required: true });
const dialog = ref<HTMLDialogElement | null>(null);
// Post-flush, so the sheet's content exists and showModal() focuses its first button.
watch(
  open,
  (isOpen) => {
    if (isOpen) dialog.value?.showModal();
    else dialog.value?.close();
  },
  { flush: "post" },
);
// A click outside the sheet closes it, but not a drag that started inside (selecting text).
let pressedOutside = false;
function onClick(e: MouseEvent) {
  if (pressedOutside && e.target === dialog.value) open.value = false;
  pressedOutside = false;
}
</script>

<template>
  <dialog
    ref="dialog"
    @close="open = false"
    @pointerdown="pressedOutside = $event.target === dialog"
    @click="onClick"
  >
    <slot />
  </dialog>
</template>
