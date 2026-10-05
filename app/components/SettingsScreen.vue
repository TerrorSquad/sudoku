<script setup lang="ts">
import { usePreferences, type HintStyle, type MistakeLimit } from "../composables/usePreferences";
import { canVibrate } from "../utils/haptics";
import {
  applyBackup,
  backupFilename,
  createBackup,
  parseBackup,
  type Backup,
} from "../utils/progressBackup";

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

// --- Export / import of local progress ---
function exportProgress() {
  const blob = new Blob([JSON.stringify(createBackup(localStorage), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

// A parsed file waits for explicit confirmation: importing replaces everything.
const pending = ref<{ backup: Backup; items: number } | null>(null);
const importError = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  pending.value = null;
  importError.value = null;
  if (!file) return;
  const result = parseBackup(await file.text());
  if (result.ok) pending.value = { backup: result.backup, items: result.items };
  else importError.value = result.error;
  input.value = ""; // allow choosing the same file again
}

function confirmImport() {
  if (!pending.value) return;
  applyBackup(localStorage, pending.value.backup);
  // Every composable reads storage on load, so a reload is the simplest way to pick it all up.
  location.reload();
}

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
        <label class="s-row">
          <span class="s-label">{{ $t("settings.language") }}</span>
          <LocaleSwitcher />
        </label>

        <label class="s-row">
          <span class="s-label">{{ $t("settings.theme") }}</span>
          <UColorModeButton />
        </label>

        <h2 class="mt-3 text-[13px] font-bold text-zinc-600 dark:text-zinc-400">
          {{ $t("settings.groupGame") }}
        </h2>

        <label class="s-row">
          <span class="s-label">{{ $t("settings.colorMode") }}</span>
          <USwitch v-model="colorMode" />
        </label>

        <label class="s-row">
          <span>
            <span class="s-label">{{ $t("settings.digitFirst") }}</span>
            <span class="s-hint">{{ $t("settings.digitFirstHint") }}</span>
          </span>
          <USwitch v-model="digitFirst" />
        </label>

        <label class="s-row">
          <span class="s-label">{{ $t("settings.showTimer") }}</span>
          <USwitch v-model="showTimer" />
        </label>

        <label class="s-row">
          <span class="s-label">{{ $t("settings.mistakeLimit") }}</span>
          <select v-model="limit" class="s-select">
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="0">{{ $t("settings.limitNone") }}</option>
          </select>
        </label>

        <label class="s-row">
          <span>
            <span class="s-label">{{ $t("settings.highlightErrors") }}</span>
            <span class="s-hint">{{ $t("settings.highlightErrorsHint") }}</span>
          </span>
          <USwitch v-model="highlightErrors" />
        </label>

        <label class="s-row">
          <span>
            <span class="s-label">{{ $t("settings.hintStyle") }}</span>
            <span class="s-hint">{{ $t("settings.hintStyleHint") }}</span>
          </span>
          <select v-model="style" class="s-select">
            <option value="full">{{ $t("settings.hintFull") }}</option>
            <option value="nudge">{{ $t("settings.hintNudge") }}</option>
          </select>
        </label>

        <h2 class="mt-3 text-[13px] font-bold text-zinc-600 dark:text-zinc-400">
          {{ $t("settings.groupFeedback") }}
        </h2>

        <label class="s-row">
          <span class="s-label">{{ $t("settings.sound") }}</span>
          <USwitch v-model="soundEnabled" />
        </label>

        <label v-if="vibrationSupported" class="s-row">
          <span class="s-label">{{ $t("settings.haptics") }}</span>
          <USwitch v-model="hapticsEnabled" />
        </label>

        <h2 class="mt-3 text-[13px] font-bold text-zinc-600 dark:text-zinc-400">
          {{ $t("settings.groupData") }}
        </h2>

        <div class="s-row">
          <span>
            <span class="s-label">{{ $t("settings.export") }}</span>
            <span class="s-hint">{{ $t("settings.exportHint") }}</span>
          </span>
          <button type="button" class="s-action" @click="exportProgress">
            {{ $t("settings.exportButton") }}
          </button>
        </div>

        <div class="s-row">
          <span>
            <span class="s-label">{{ $t("settings.import") }}</span>
            <span class="s-hint">{{ $t("settings.importHint") }}</span>
          </span>
          <button type="button" class="s-action" @click="fileInput?.click()">
            {{ $t("settings.importButton") }}
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            data-testid="import-file"
            @change="onFile"
          />
        </div>

        <p v-if="importError" role="alert" class="s-notice s-error">
          {{ $t(`settings.importError.${importError}`) }}
        </p>

        <div v-if="pending" role="alertdialog" class="s-notice">
          <p>
            {{
              $t("settings.importConfirm", {
                date: new Date(pending.backup.exportedAt).toLocaleDateString(),
                n: pending.items,
              })
            }}
          </p>
          <div class="flex gap-2">
            <button type="button" class="s-action s-danger" @click="confirmImport">
              {{ $t("settings.importReplace") }}
            </button>
            <button type="button" class="s-action" @click="pending = null">
              {{ $t("settings.importCancel") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.s-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--color-zinc-200);
  background: var(--color-zinc-50);
  padding: 0.75rem 1rem;
}
.dark .s-row {
  border-color: var(--color-zinc-800);
  background: var(--color-zinc-900);
}
.s-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-zinc-700);
}
.dark .s-label {
  color: var(--color-zinc-300);
}
.s-hint {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--color-zinc-500);
}
.s-action {
  border: 1px solid var(--color-zinc-300);
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-zinc-700);
  white-space: nowrap;
}
.s-action:hover {
  background: var(--color-zinc-100);
}
.s-action.s-danger {
  border-color: var(--color-rose-600);
  color: var(--color-rose-700);
}
.dark .s-action {
  border-color: var(--color-zinc-700);
  color: var(--color-zinc-200);
}
.dark .s-action:hover {
  background: var(--color-zinc-800);
}
.dark .s-action.s-danger {
  border-color: var(--color-rose-500);
  color: var(--color-rose-300);
}
.s-notice {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--color-amber-500);
  background: color-mix(in srgb, var(--color-amber-300) 25%, transparent);
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-zinc-800);
}
.s-notice.s-error {
  border-color: var(--color-rose-500);
  background: color-mix(in srgb, var(--color-rose-300) 25%, transparent);
}
.dark .s-notice {
  color: var(--color-zinc-100);
}
.s-select {
  border: 1px solid var(--color-zinc-300);
  background: white;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
  color: var(--color-zinc-900);
}
.dark .s-select {
  border-color: var(--color-zinc-700);
  background: var(--color-zinc-900);
  color: var(--color-zinc-100);
}
</style>
