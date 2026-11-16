<script setup lang="ts">
// The Academy's way into Spot it: a tier to play, with its best time, or to rush, with its longest.
import type { Tier } from "../utils/progression";

const emit = defineEmits<{ (e: "spot", tier: Tier, rush: boolean): void }>();
const best = readSpotBest(readJSON<unknown>(SPOT_BEST_KEY, {}));
const rushBest = readSpotBest(readJSON<unknown>(RUSH_BEST_KEY, {}));
</script>

<template>
  <section class="panel p-4 sm:col-span-2">
    <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">{{ $t("spot.title") }}</h2>
    <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
      {{ $t("spot.desc", { miss: MISS_PENALTY, skip: SKIP_PENALTY }) }}
    </p>
    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="spot-it">
      <button
        v-for="tier in SPOT_TIERS"
        :key="tier"
        @click="emit('spot', tier, false)"
        class="tile flex flex-col items-center px-2 py-2 text-sm font-bold"
      >
        {{ $t(`academy.tier.${tier}`) }}
        <span
          class="text-[0.6875rem] font-semibold text-zinc-600 tabular-nums dark:text-zinc-400"
          >{{
            best[tier] ? $t("spot.best", { time: formatSpotTime(best[tier]!) }) : $t("spot.noBest")
          }}</span
        >
      </button>
    </div>
    <h3 class="mt-4 text-sm font-black text-zinc-900 dark:text-zinc-100">
      {{ $t("spot.rush.title") }}
    </h3>
    <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
      {{ $t("spot.rush.desc", { n: RUSH_LIVES }) }}
    </p>
    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="spot-rush">
      <button
        v-for="tier in SPOT_TIERS"
        :key="tier"
        @click="emit('spot', tier, true)"
        class="tile flex flex-col items-center px-2 py-2 text-sm font-bold"
      >
        {{ $t(`academy.tier.${tier}`) }}
        <span
          class="text-[0.6875rem] font-semibold text-zinc-600 tabular-nums dark:text-zinc-400"
          >{{
            rushBest[tier] ? $t("spot.best", { time: rushBest[tier] }) : $t("spot.noBest")
          }}</span
        >
      </button>
    </div>
  </section>
</template>
