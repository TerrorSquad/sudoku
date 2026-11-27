<script setup lang="ts">
// "Can this go?": the selected cell's pencil marks as buttons; one asks whether anything on the
// board rules it out. The answer (and whether it opens as a peek) comes from the game.
defineProps<{
  digits: number[];
  colorMode: boolean;
  /** The digit asked about, while its answer shows. */
  asked: number | null;
  answer: string;
  canShow: boolean;
}>();
const emit = defineEmits<{ (e: "ask", num: number): void; (e: "show"): void }>();
const { t } = useI18n();
</script>

<template>
  <div class="panel mt-3 flex flex-col gap-2 p-3 text-xs" data-testid="can-this-go">
    <p>
      <span class="font-bold text-zinc-600 dark:text-zinc-400">{{ $t("hint.canGo.ask") }}</span>
      <span class="ml-1 text-zinc-500">{{ $t("hint.canGo.desc") }}</span>
    </p>
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="n in digits"
        :key="n"
        type="button"
        :aria-label="$t('hint.canGo.pick', { num: digitLabel(n, colorMode, t) })"
        :aria-pressed="asked === n"
        :class="asked === n ? 'bg-violet-500/25' : 'bg-violet-500/10'"
        class="flex min-h-8 min-w-8 items-center justify-center border border-violet-500/30 px-2 font-semibold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
        @click="emit('ask', n)"
      >
        <span v-if="colorMode" :class="dotClass(n)" class="h-4 w-4" />
        <template v-else>{{ n }}</template>
      </button>
    </div>
    <div v-if="answer" class="flex flex-wrap items-center gap-2">
      <p data-testid="can-go-answer" class="leading-relaxed text-zinc-700 dark:text-zinc-300">
        {{ answer }}
      </p>
      <button
        v-if="canShow"
        type="button"
        class="font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        @click="emit('show')"
      >
        {{ $t("hint.canGo.show") }}
      </button>
    </div>
  </div>
</template>
