<script setup lang="ts">
import { useAchievements } from "../composables/useAchievements";
import { ACHIEVEMENTS, type AchievementTier } from "../utils/achievements";

const emit = defineEmits<{ (e: "back-to-menu"): void }>();

const { locale } = useI18n();
const unlocked = useAchievements().getUnlocked();
const unlockedCount = ACHIEVEMENTS.filter((a) => a.id in unlocked).length;

const TIER_STYLE: Record<AchievementTier, string> = {
  common: "!border-l-zinc-400",
  rare: "!border-l-cyan-500",
  epic: "!border-l-amber-400",
};

const date = (ms: number) => new Date(ms).toLocaleDateString(locale.value);
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
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
          {{ $t("achievements.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">{{ $t("achievements.subtitle") }}</p>
      </div>
      <span class="text-xs font-semibold text-zinc-500 tabular-nums">{{
        $t("achievements.progress", { n: unlockedCount, total: ACHIEVEMENTS.length })
      }}</span>
    </div>

    <div class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="a in ACHIEVEMENTS"
          :key="a.id"
          :data-unlocked="a.id in unlocked"
          :class="[
            TIER_STYLE[a.tier],
            a.id in unlocked ? 'bg-white dark:bg-zinc-900/60' : 'bg-transparent',
          ]"
          class="flex items-start gap-3 border border-l-4 border-zinc-200 p-4 dark:border-zinc-800"
        >
          <AppIcon
            :class="a.id in unlocked ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-600'"
            class="h-8 w-8 shrink-0"
            path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <h3
                :class="
                  a.id in unlocked
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-600 dark:text-zinc-400'
                "
                class="text-sm font-black"
              >
                {{
                  a.hidden && !(a.id in unlocked)
                    ? $t("achievements.hidden")
                    : $t(`achievements.${a.id}.name`)
                }}
              </h3>
              <span class="text-[9px] font-bold text-zinc-500">{{
                $t(`achievements.tier.${a.tier}`)
              }}</span>
            </div>
            <p class="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {{
                a.hidden && !(a.id in unlocked)
                  ? $t("achievements.hiddenDesc")
                  : $t(`achievements.${a.id}.desc`)
              }}
            </p>
            <p
              v-if="a.id in unlocked"
              class="mt-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
            >
              ✓ {{ date(unlocked[a.id]!) }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-10 border-t border-zinc-200 pt-8 text-center dark:border-zinc-800">
        <button
          @click="emit('back-to-menu')"
          class="border border-zinc-300 bg-zinc-50 px-8 py-3 text-sm font-bold text-zinc-700 transition-all hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {{ $t("achievements.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
