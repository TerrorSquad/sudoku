<script setup lang="ts">
defineProps<{ colorMode: boolean; soundEnabled: boolean }>();

const emit = defineEmits<{
  (e: "back-to-menu"): void;
  (e: "update:colorMode", value: boolean): void;
  (e: "update:soundEnabled", value: boolean): void;
}>();
</script>

<template>
  <div class="menu-grid-bg flex min-h-screen w-full flex-col">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-white/95 py-4 pr-4 pl-4 backdrop-blur sm:pl-8 dark:border-zinc-800 dark:bg-[#0c0a09]/95"
    >
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold tracking-wider text-zinc-600 uppercase transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <AppIcon
          class="h-4 w-4"
          path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
        />
        <span class="hidden sm:inline">{{ $t("menu.back") }}</span>
      </button>
      <div class="min-w-0 flex-1">
        <h1
          class="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-lg leading-tight font-black tracking-tight text-transparent sm:text-2xl"
        >
          {{ $t("settings.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">{{ $t("settings.subtitle") }}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <div class="flex flex-col gap-3">
        <label
          class="flex items-center justify-between border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{{
            $t("settings.language")
          }}</span>
          <LocaleSwitcher />
        </label>

        <label
          class="flex items-center justify-between border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{{
            $t("settings.theme")
          }}</span>
          <UColorModeButton />
        </label>

        <label
          class="flex items-center justify-between border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{{
            $t("settings.colorMode")
          }}</span>
          <USwitch
            :model-value="colorMode"
            @update:model-value="(v: boolean) => emit('update:colorMode', v)"
          />
        </label>

        <label
          class="flex items-center justify-between border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{{
            $t("settings.sound")
          }}</span>
          <USwitch
            :model-value="soundEnabled"
            @update:model-value="(v: boolean) => emit('update:soundEnabled', v)"
          />
        </label>
      </div>
    </div>
  </div>
</template>
