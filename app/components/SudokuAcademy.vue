<script setup lang="ts">
import { ref, computed } from "vue";
import { useTechniqueStats } from "../composables/useTechniqueStats";
import ExampleGrid from "./ExampleGrid.vue";
import { ACADEMY_EXAMPLES, type AcademyExample } from "../utils/academyExamples";
import type { TechniqueId } from "../utils/sudokuGrader";

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

const tierBadgeClass: Record<Tier, string> = {
  Basic: "bg-emerald-500/15 dark:text-emerald-400 text-emerald-600 border-emerald-500/30",
  Intermediate: "bg-amber-500/15 dark:text-amber-400 text-amber-700 border-amber-500/30",
  Advanced: "bg-violet-500/15 dark:text-violet-400 text-violet-600 border-violet-500/30",
  Expert: "bg-rose-500/15 dark:text-rose-400 text-rose-600 border-rose-500/30",
};

const tierHeading: Record<Tier, string> = {
  Basic: "dark:text-emerald-400 text-emerald-600",
  Intermediate: "dark:text-amber-400 text-amber-700",
  Advanced: "dark:text-violet-400 text-violet-600",
  Expert: "dark:text-rose-400 text-rose-600",
};

const tierBorder: Record<Tier, string> = {
  Basic: "border-emerald-500/20 hover:border-emerald-500/50",
  Intermediate: "border-amber-500/20 hover:border-amber-500/50",
  Advanced: "border-violet-500/20 hover:border-violet-500/50",
  Expert: "border-rose-500/20 hover:border-rose-500/50",
};

function byTier(tier: Tier) {
  return techniques.filter((t) => t.tier === tier);
}

function exampleFor(id: TechniqueId): AcademyExample | undefined {
  return ACADEMY_EXAMPLES[id];
}

const RC = (p: { r: number; c: number }) => `R${p.r + 1}C${p.c + 1}`;

// For hidden subsets the eliminations fall inside the pattern cells themselves;
// keep those as indigo pattern cells rather than double-marking them rose.
function elimDisplay(ex: AcademyExample): { r: number; c: number }[] {
  return ex.elimination.filter((e) => !ex.trigger.some((t) => t.r === e.r && t.c === e.c));
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
  <div class="min-h-screen w-full flex flex-col">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 backdrop-blur border-b pl-4 sm:pl-8 pr-4 py-4 flex items-center gap-4 dark:bg-[#0c0a09]/95 dark:border-zinc-800 bg-white/95 border-zinc-200"
    >
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider transition-colors dark:text-zinc-400 dark:hover:text-zinc-100 text-zinc-600 hover:text-zinc-900"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
          />
        </svg>
        <span class="hidden sm:inline">{{ $t("menu.back") }}</span>
      </button>
      <div class="flex-1 min-w-0">
        <h1
          class="text-lg sm:text-2xl font-black tracking-tight leading-tight dark:text-zinc-100 text-zinc-900"
        >
          {{ $t("academy.title") }}
        </h1>
        <p class="text-xs text-zinc-500 hidden sm:block">
          {{ $t("academy.subtitle", { n: total }) }}
        </p>
      </div>
      <span class="shrink-0 text-xs text-zinc-600 font-semibold hidden sm:inline">{{
        $t("academy.count", { n: total })
      }}</span>
    </div>

    <!-- Content -->
    <div class="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto w-full">
      <!-- Example legend -->
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 sm:mb-8 px-3 sm:px-4 py-3 border text-[11px] dark:bg-zinc-900/40 dark:border-zinc-800 dark:text-zinc-400 bg-zinc-50 border-zinc-200 text-zinc-600"
      >
        <span class="font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700">{{
          $t("academy.colors")
        }}</span>
        <span class="flex items-center gap-1.5"
          ><span class="w-3 h-3 bg-emerald-500/30 ring-1 ring-emerald-500 inline-block"></span>
          {{ $t("academy.placedCell") }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="w-3 h-3 bg-indigo-500/40 ring-1 ring-indigo-400 inline-block"></span>
          {{ $t("academy.pattern") }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="w-3 h-3 bg-rose-500/40 ring-1 ring-rose-400 inline-block"></span>
          {{ $t("academy.eliminated") }}</span
        >
        <span class="ml-auto text-zinc-600 hidden sm:inline">{{ $t("academy.tapHint") }}</span>
      </div>

      <div v-for="tier in tiers" :key="tier" class="mb-10 sm:mb-12">
        <!-- Tier heading -->
        <div class="flex items-center gap-3 mb-2">
          <h2
            :class="tierHeading[tier]"
            class="text-lg sm:text-xl font-black uppercase tracking-widest"
          >
            {{ $t(`academy.tier.${tier}`) }}
          </h2>
          <span
            :class="tierBadgeClass[tier]"
            class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border"
          >
            {{ byTier(tier).length }}
          </span>
          <div class="flex-1 h-px dark:bg-zinc-800 bg-zinc-200" />
        </div>
        <p class="text-xs text-zinc-500 mb-4">{{ $t(`academy.tier.${tier}Desc`) }}</p>

        <!-- Cards grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="tech in byTier(tier)"
            :key="tech.id"
            :class="tierBorder[tier]"
            class="border p-4 sm:p-5 transition-colors cursor-pointer dark:bg-zinc-900/60 bg-zinc-50"
            @click="toggleExample(tech.id)"
          >
            <div class="flex items-start justify-between gap-3 mb-3">
              <h3 class="text-base font-black leading-tight dark:text-zinc-100 text-zinc-900">
                {{ techName(tech.id) }}
              </h3>
              <div class="flex items-center gap-1.5 shrink-0">
                <span
                  v-if="techStats.getCount(techName(tech.id)) > 0"
                  class="text-[9px] font-bold px-1.5 py-0.5 border dark:bg-zinc-700/60 dark:border-zinc-600 dark:text-zinc-400 bg-zinc-200 border-zinc-300 text-zinc-600"
                  :title="$t('modal.usedTotal', { n: techStats.getCount(techName(tech.id)) })"
                  >×{{ techStats.getCount(techName(tech.id)) }}</span
                >
                <svg
                  class="w-4 h-4 text-zinc-500 transition-transform"
                  :class="{ 'rotate-180': expanded.has(tech.id) }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  {{ $t("academy.lookForLabel") }}
                </p>
                <p class="text-sm leading-relaxed dark:text-zinc-300 text-zinc-700">
                  {{ $t(`academy.tech.${tech.id}.lookFor`) }}
                </p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  {{ $t("academy.howItHelpsLabel") }}
                </p>
                <p class="text-sm leading-relaxed dark:text-zinc-400 text-zinc-600">
                  {{ $t(`academy.tech.${tech.id}.howItHelps`) }}
                </p>
              </div>
            </div>

            <div
              v-if="expanded.has(tech.id) && exampleFor(tech.id)"
              class="mt-4 pt-4 border-t dark:border-zinc-800 border-zinc-200"
              @click.stop
            >
              <p
                class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 text-center"
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
                class="text-xs leading-relaxed mt-3 text-center max-w-sm mx-auto dark:text-zinc-400 text-zinc-600"
              >
                {{ caption(tech.id, exampleFor(tech.id)!) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t pt-8 text-center dark:border-zinc-800 border-zinc-200">
        <p class="text-xs text-zinc-600 leading-relaxed max-w-lg mx-auto">
          {{ $t("academy.footer") }}
        </p>
        <button
          @click="emit('back-to-menu')"
          class="mt-6 px-8 py-3 border text-sm font-bold uppercase tracking-wider transition-all active:scale-95 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 bg-zinc-50 hover:bg-zinc-100 border-zinc-300 text-zinc-700"
        >
          {{ $t("academy.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
