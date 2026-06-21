<script setup lang="ts">
import { ref, computed } from "vue";

import type { TechniqueId } from "../utils/sudokuGrader";

import { useTechniqueStats } from "../composables/useTechniqueStats";
import { ACADEMY_EXAMPLES, type AcademyExample } from "../utils/academyExamples";
import ExampleGrid from "./ExampleGrid.vue";

const emit = defineEmits<{
  (e: "back-to-menu"): void;
}>();

const { t } = useI18n();
const techStats = useTechniqueStats();

type Tier = "Basic" | "Intermediate" | "Advanced" | "Expert";

interface Technique {
  id: TechniqueId;
  tier: Tier;
}

// Exactly the techniques the in-game analyzer uses (and can hint), in the order
// the solver tries them. Names/descriptions/captions come from i18n; the name
// reuses the in-game hint title so the per-technique ×N badge matches.
const techniques: Technique[] = [
  { id: "naked-single", tier: "Basic" },
  { id: "hidden-single", tier: "Basic" },
  { id: "pointing", tier: "Intermediate" },
  { id: "box-line", tier: "Intermediate" },
  { id: "naked-pair", tier: "Intermediate" },
  { id: "hidden-pair", tier: "Intermediate" },
  { id: "naked-triple", tier: "Intermediate" },
  { id: "hidden-triple", tier: "Intermediate" },
  { id: "naked-quad", tier: "Advanced" },
  { id: "hidden-quad", tier: "Advanced" },
  { id: "x-wing", tier: "Advanced" },
  { id: "swordfish", tier: "Advanced" },
  { id: "jellyfish", tier: "Advanced" },
  { id: "xy-wing", tier: "Expert" },
  { id: "xyz-wing", tier: "Expert" },
];

const tiers: Tier[] = ["Basic", "Intermediate", "Advanced", "Expert"];

const techName = (id: TechniqueId) => t(`hint.move.${id}.name`);

const tierStyles: Record<Tier, { badge: string; heading: string; border: string }> = {
  Basic: {
    badge: "bg-emerald-500/15 dark:text-emerald-400 text-emerald-600 border-emerald-500/30",
    heading: "dark:text-emerald-400 text-emerald-600",
    border: "border-emerald-500/20 hover:border-emerald-500/50",
  },
  Intermediate: {
    badge: "bg-amber-500/15 dark:text-amber-400 text-amber-700 border-amber-500/30",
    heading: "dark:text-amber-400 text-amber-700",
    border: "border-amber-500/20 hover:border-amber-500/50",
  },
  Advanced: {
    badge: "bg-violet-500/15 dark:text-violet-400 text-violet-600 border-violet-500/30",
    heading: "dark:text-violet-400 text-violet-600",
    border: "border-violet-500/20 hover:border-violet-500/50",
  },
  Expert: {
    badge: "bg-rose-500/15 dark:text-rose-400 text-rose-600 border-rose-500/30",
    heading: "dark:text-rose-400 text-rose-600",
    border: "border-rose-500/20 hover:border-rose-500/50",
  },
};

function byTier(tier: Tier) {
  return techniques.filter((tech) => tech.tier === tier);
}

function exampleFor(id: TechniqueId): AcademyExample | undefined {
  return ACADEMY_EXAMPLES[id];
}

const RC = (p: { r: number; c: number }) => `R${p.r + 1}C${p.c + 1}`;

// For hidden subsets the eliminations fall inside the pattern cells themselves;
// keep those as indigo pattern cells rather than double-marking them rose.
function elimDisplay(ex: AcademyExample): { r: number; c: number }[] {
  return ex.elimination.filter((e) => !ex.trigger.some((pos) => pos.r === e.r && pos.c === e.c));
}

// A specific, board-accurate caption generated from the real move data + i18n.
function caption(id: TechniqueId, ex: AcademyExample): string {
  const digits = ex.digits.join(" & ");
  const num = ex.digits[0] ?? 0;
  const elim = elimDisplay(ex);
  const nElim = elim.length;
  const elimList = elim.slice(0, 2).map(RC).join(", ");
  const cells = ex.trigger.map(RC).join(", ");
  const k = ex.trigger.length;
  switch (id) {
    case "naked-single":
      return t("academy.caption.nakedSingle", { cell: RC(ex.placement!), num: ex.placement!.num });
    case "hidden-single":
      return t("academy.caption.hiddenSingle", { cell: RC(ex.placement!), num: ex.placement!.num });
    case "pointing":
      return t("academy.caption.pointing", { digits, cells, nElim, elimList });
    case "box-line":
      return t("academy.caption.boxLine", { digits, cells, nElim, elimList });
    case "naked-pair":
    case "naked-triple":
    case "naked-quad":
      return t("academy.caption.nakedSubset", { k, digits, nElim, elimList });
    case "hidden-pair":
    case "hidden-triple":
    case "hidden-quad":
      return t("academy.caption.hiddenSubset", { k, digits });
    case "x-wing":
    case "swordfish":
    case "jellyfish": {
      const lines = t(
        `academy.lines.${id === "x-wing" ? "two" : id === "swordfish" ? "three" : "four"}`,
      );
      return t("academy.caption.fish", { num, lines, nElim, elimList });
    }
    case "xy-wing":
      return t("academy.caption.xyWing", { num, nElim, elimList });
    case "xyz-wing":
      return t("academy.caption.xyzWing", { num, nElim, elimList });
    default:
      return "";
  }
}

const expanded = ref<Set<string>>(new Set());
function toggleExample(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

const total = computed(() => techniques.length);
</script>

<template>
  <div class="flex min-h-screen w-full flex-col">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-white/95 py-4 pr-4 pl-4 backdrop-blur sm:pl-8 dark:border-zinc-800 dark:bg-[#0c0a09]/95"
    >
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold tracking-wider text-zinc-600 uppercase transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <AppIcon class="h-4 w-4" path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        <span class="hidden sm:inline">{{ $t("menu.back") }}</span>
      </button>
      <div class="min-w-0 flex-1">
        <h1
          class="text-lg leading-tight font-black tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100"
        >
          {{ $t("academy.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">
          {{ $t("academy.subtitle", { n: total }) }}
        </p>
      </div>
      <span class="hidden shrink-0 text-xs font-semibold text-zinc-600 sm:inline">{{
        $t("academy.count", { n: total })
      }}</span>
    </div>

    <!-- Content -->
    <div class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <!-- Example legend -->
      <div
        class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] text-zinc-600 sm:mb-8 sm:px-4 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
      >
        <span class="font-bold tracking-widest text-zinc-700 uppercase dark:text-zinc-300">{{
          $t("academy.colors")
        }}</span>
        <span class="flex items-center gap-1.5"
          ><span class="inline-block h-3 w-3 bg-emerald-500/30 ring-1 ring-emerald-500"></span>
          {{ $t("academy.placedCell") }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="inline-block h-3 w-3 bg-indigo-500/40 ring-1 ring-indigo-400"></span>
          {{ $t("academy.pattern") }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="inline-block h-3 w-3 bg-rose-500/40 ring-1 ring-rose-400"></span>
          {{ $t("academy.eliminated") }}</span
        >
        <span class="ml-auto hidden text-zinc-600 sm:inline">{{ $t("academy.tapHint") }}</span>
      </div>

      <div v-for="tier in tiers" :key="tier" class="mb-10 sm:mb-12">
        <!-- Tier heading -->
        <div class="mb-2 flex items-center gap-3">
          <h2
            :class="tierStyles[tier].heading"
            class="text-lg font-black tracking-widest uppercase sm:text-xl"
          >
            {{ $t(`academy.tier.${tier}`) }}
          </h2>
          <span
            :class="tierStyles[tier].badge"
            class="border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
          >
            {{ byTier(tier).length }}
          </span>
          <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <p class="mb-4 text-xs text-zinc-500">{{ $t(`academy.tier.${tier}Desc`) }}</p>

        <!-- Cards grid -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="tech in byTier(tier)"
            :key="tech.id"
            :class="tierStyles[tier].border"
            class="cursor-pointer border bg-zinc-50 p-4 transition-colors sm:p-5 dark:bg-zinc-900/60"
            @click="toggleExample(tech.id)"
          >
            <div class="mb-3 flex items-start justify-between gap-3">
              <h3 class="text-base leading-tight font-black text-zinc-900 dark:text-zinc-100">
                {{ techName(tech.id) }}
              </h3>
              <div class="flex shrink-0 items-center gap-1.5">
                <span
                  v-if="techStats.getCount(techName(tech.id)) > 0"
                  class="border border-zinc-300 bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400"
                  :title="$t('modal.usedTotal', { n: techStats.getCount(techName(tech.id)) })"
                  >×{{ techStats.getCount(techName(tech.id)) }}</span
                >
                <AppIcon
                  class="h-4 w-4 text-zinc-500 transition-transform"
                  :class="{ 'rotate-180': expanded.has(tech.id) }"
                  path="M19 9l-7 7-7-7"
                />
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <p class="mb-1 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  {{ $t("academy.lookForLabel") }}
                </p>
                <p class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {{ $t(`academy.tech.${tech.id}.lookFor`) }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  {{ $t("academy.howItHelpsLabel") }}
                </p>
                <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {{ $t(`academy.tech.${tech.id}.howItHelps`) }}
                </p>
              </div>
            </div>

            <div
              v-if="expanded.has(tech.id) && exampleFor(tech.id)"
              class="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"
              @click.stop
            >
              <p
                class="mb-3 text-center text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
              >
                {{ $t("academy.workedExample") }}
              </p>
              <ExampleGrid
                :board="exampleFor(tech.id)!.board"
                :notes="exampleFor(tech.id)!.notes"
                :target="exampleFor(tech.id)!.target"
                :trigger="exampleFor(tech.id)!.trigger"
                :elimination="elimDisplay(exampleFor(tech.id)!)"
              />
              <p
                class="mx-auto mt-3 max-w-sm text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
              >
                {{ caption(tech.id, exampleFor(tech.id)!) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-zinc-200 pt-8 text-center dark:border-zinc-800">
        <p class="mx-auto max-w-lg text-xs leading-relaxed text-zinc-600">
          {{ $t("academy.footer") }}
        </p>
        <button
          @click="emit('back-to-menu')"
          class="mt-6 border border-zinc-300 bg-zinc-50 px-8 py-3 text-sm font-bold tracking-wider text-zinc-700 uppercase transition-all hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {{ $t("academy.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
