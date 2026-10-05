<script setup lang="ts">
import { usePreferences, type HintStyle, type MistakeLimit } from "../composables/usePreferences";
import { canVibrate } from "../utils/haptics";

const emit = defineEmits<{ (e: "back-to-menu"): void }>();

const {
  colorMode,
  soundEnabled,
  hapticsEnabled,
  digitFirst,
  showTimer,
  mistakeLimit,
  highlightErrors,
  hintStyle,
} = usePreferences();

const vibrationSupported = canVibrate();

// Native <select> hands back strings; the limit is stored as a number.
const limit = computed({
  get: () => String(mistakeLimit.value),
  set: (v: string) => (mistakeLimit.value = Number(v) as MistakeLimit),
});
const style = computed({
  get: () => hintStyle.value,
  set: (v: HintStyle) => (hintStyle.value = v),
});
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-white/95 py-4 pr-4 pl-4 backdrop-blur sm:pl-8 dark:border-zinc-800 dark:bg-[#0d141b]/95"
    >
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <AppIcon
          class="h-4 w-4"
          path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
        />
        <span class="hidden sm:inline">{{ $t("menu.back") }}</span>
      </button>
      <div class="min-w-0 flex-1">
        <h1
          class="text-lg leading-tight font-black tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50"
        >
          {{ $t("settings.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">{{ $t("settings.subtitle") }}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <div class="flex flex-col gap-3">
        <label class="row">
          <span class="label">{{ $t("settings.language") }}</span>
          <LocaleSwitcher />
        </label>

        <label class="row">
          <span class="label">{{ $t("settings.theme") }}</span>
          <UColorModeButton />
        </label>

        <h2 class="group-title">{{ $t("settings.groupGame") }}</h2>

        <label class="row">
          <span class="label">{{ $t("settings.colorMode") }}</span>
          <USwitch v-model="colorMode" />
        </label>

        <label class="row">
          <span>
            <span class="label">{{ $t("settings.digitFirst") }}</span>
            <span class="hint">{{ $t("settings.digitFirstHint") }}</span>
          </span>
          <USwitch v-model="digitFirst" />
        </label>

        <label class="row">
          <span class="label">{{ $t("settings.showTimer") }}</span>
          <USwitch v-model="showTimer" />
        </label>

        <label class="row">
          <span class="label">{{ $t("settings.mistakeLimit") }}</span>
          <select v-model="limit" class="select">
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="0">{{ $t("settings.limitNone") }}</option>
          </select>
        </label>

        <label class="row">
          <span>
            <span class="label">{{ $t("settings.highlightErrors") }}</span>
            <span class="hint">{{ $t("settings.highlightErrorsHint") }}</span>
          </span>
          <USwitch v-model="highlightErrors" />
        </label>

        <label class="row">
          <span>
            <span class="label">{{ $t("settings.hintStyle") }}</span>
            <span class="hint">{{ $t("settings.hintStyleHint") }}</span>
          </span>
          <select v-model="style" class="select">
            <option value="full">{{ $t("settings.hintFull") }}</option>
            <option value="nudge">{{ $t("settings.hintNudge") }}</option>
          </select>
        </label>

        <h2 class="group-title">{{ $t("settings.groupFeedback") }}</h2>

        <label class="row">
          <span class="label">{{ $t("settings.sound") }}</span>
          <USwitch v-model="soundEnabled" />
        </label>

        <label v-if="vibrationSupported" class="row">
          <span class="label">{{ $t("settings.haptics") }}</span>
          <USwitch v-model="hapticsEnabled" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--color-zinc-200);
  background: var(--color-zinc-50);
  padding: 0.75rem 1rem;
}
:global(.dark) .row {
  border-color: var(--color-zinc-800);
  background: var(--color-zinc-900);
}
.label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-zinc-700);
}
:global(.dark) .label {
  color: var(--color-zinc-300);
}
.hint {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--color-zinc-500);
}
.group-title {
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-zinc-600);
}
:global(.dark) .group-title {
  color: var(--color-zinc-400);
}
.select {
  border: 1px solid var(--color-zinc-300);
  background: white;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
  color: var(--color-zinc-900);
}
:global(.dark) .select {
  border-color: var(--color-zinc-700);
  background: var(--color-zinc-900);
  color: var(--color-zinc-100);
}
</style>
