<script setup lang="ts">
withDefaults(defineProps<{ path: string; strokeWidth?: number }>(), { strokeWidth: 2 });
</script>

<template>
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="strokeWidth" :d="path" />
  </svg>
</template>
