<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";

import type { TechniqueId } from "../utils/sudokuGrader";

import { useTechniquePath } from "../composables/useTechniquePath";
import { useTechniqueStats } from "../composables/useTechniqueStats";
import { ACADEMY_EXAMPLES, type AcademyExample } from "../utils/academyExamples";
import { MASTERY_STYLE, TIER_STYLES as tierStyles } from "../utils/academyStyles";
import { BASICS_IDS, type BasicsId } from "../utils/basics";
import { masteryFor } from "../utils/mastery";
import { ACADEMY_TECHNIQUES, nextChallenge, type Tier, type Week } from "../utils/progression";
import AcademyMap from "./AcademyMap.vue";
import ExampleGrid from "./ExampleGrid.vue";
import PathPanels from "./PathPanels.vue";
import ReviewPanel from "./ReviewPanel.vue";
import ScreenHeader from "./ScreenHeader.vue";
import SpotItPanel from "./SpotItPanel.vue";
import WatchExample from "./WatchExample.vue";

// Opens on this technique's lesson, expanded and scrolled to (the win screen links here).
const props = defineProps<{ focus?: TechniqueId | null; inGame?: boolean }>();

const emit = defineEmits<{
  (e: "back-to-menu"): void;
  (e: "practice", id: TechniqueId): void;
  (e: "lesson", id: TechniqueId): void;
  (e: "basics", id: BasicsId): void;
  (e: "weekly", week: Week): void;
  (e: "spot", tier: Tier): void;
  (e: "review", ids: TechniqueId[]): void;
}>();

const { t, te } = useI18n();
const techStats = useTechniqueStats();

// Exactly the techniques the in-game analyzer uses (and can hint), in the order of the
// technique path. Names/descriptions/captions come from i18n; the name reuses the hint title.
const techniques = ACADEMY_TECHNIQUES;

// The technique path: completed challenges, and the one the player is on.
const path = useTechniquePath();
const done = path.getDone();
const nextId = nextChallenge(done);
const pathState = (id: TechniqueId) =>
  done.includes(id) ? "done" : id === nextId ? "next" : "locked";
const stepOf = (id: TechniqueId) => techniques.findIndex((tech) => tech.id === id) + 1;
// "How to play", the path's step 0: four short lessons before the first technique.
const basicsDone = path.getBasics();
const basicsNext = BASICS_IDS.find((id) => !basicsDone.includes(id)) ?? null;

const countOf = (id: TechniqueId) => techStats.getCount(id);
// Each lesson's best stars; a finished lesson also counts toward mastery (see utils/mastery.ts).
const lessonStars = path.getStars();
const starsOf = (id: TechniqueId) => lessonStars[id] ?? 0;
const masteryOf = (id: TechniqueId) => masteryFor(countOf(id), starsOf(id));
const masteryTitle = (id: TechniqueId) =>
  countOf(id) === 0
    ? t(`academy.mastery.${masteryOf(id)}`)
    : `${t(`academy.mastery.${masteryOf(id)}`)} · ${t("modal.usedTotal", { n: countOf(id) })}`;

const tiers = [...new Set(techniques.map((tech) => tech.tier))];

const techName = (id: TechniqueId) => t(`hint.move.${id}.name`);
// Steps and tips are one message each, split on newlines: "|" is vue-i18n's plural separator.
const splitLines = (key: string) => t(key).split("\n");

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
    case "skyscraper":
      return t("academy.caption.skyscraper", { num, nElim, elimList });
    case "two-string-kite":
      return t("academy.caption.kite", { num, nElim, elimList });
    case "unique-rectangle":
      return t("academy.caption.uniqueRectangle", { digits, nElim, elimList });
    case "simple-coloring":
      return t("academy.caption.coloring", { num, nElim, elimList });
    case "finned-x-wing":
      return t("academy.caption.finnedXWing", { num, nElim, elimList });
    case "w-wing":
      return t("academy.caption.wWing", { num, nElim, elimList });
    case "bug-plus-one":
      return t("academy.caption.bug", { cell: RC(ex.placement!), num: ex.placement!.num });
    default:
      return "";
  }
}

const expanded = ref<Set<string>>(new Set(props.focus ? [props.focus] : []));
function showCard(id: string) {
  const card = document.getElementById(`lesson-${id}`);
  if (!card) return;
  card.scrollIntoView();
  card.focus({ preventScroll: true }); // keyboard and screen-reader users land on the lesson
}
onMounted(() => props.focus && showCard(props.focus));

// The techniques as cards, or as a map of what builds on what (AcademyMap).
const view = ref<"list" | "map">("list");
async function openFromMap(id: TechniqueId) {
  view.value = "list";
  expanded.value = new Set([...expanded.value, id]);
  await nextTick();
  showCard(id);
}
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
    <ScreenHeader
      :back-label="$t(inGame ? 'settings.backToGame' : 'menu.back')"
      @back="emit('back-to-menu')"
    >
      <div class="min-w-0 flex-1">
        <h1
          class="text-lg leading-tight font-black tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50"
        >
          {{ $t("academy.title") }}
        </h1>
        <p class="hidden text-xs text-zinc-500 sm:block">
          {{ $t("academy.subtitle", { n: total }) }}
        </p>
      </div>
      <span
        class="hidden shrink-0 text-xs font-semibold text-zinc-600 sm:inline dark:text-zinc-400"
        >{{ $t("academy.count", { n: total }) }}</span
      >
    </ScreenHeader>

    <!-- Content -->
    <div class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <!-- How to play: the path's step 0. -->
      <section class="panel mb-3 p-4" data-testid="basics">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">
            <span class="text-violet-700 dark:text-violet-300">{{
              $t("path.step", { n: 0 })
            }}</span>
            · {{ $t("basics.title") }}
          </h2>
          <span class="text-xs font-bold text-violet-700 tabular-nums dark:text-violet-300">{{
            $t("basics.progress", { done: basicsDone.length, total: BASICS_IDS.length })
          }}</span>
        </div>
        <p v-if="basicsNext" class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {{ $t("basics.desc") }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="id in BASICS_IDS"
            :key="id"
            @click="emit('basics', id)"
            :class="id === basicsNext ? 'tile-primary' : ''"
            class="tile px-3 py-1.5 text-xs font-bold"
          >
            <span v-if="basicsDone.includes(id)" class="text-emerald-700 dark:text-emerald-400"
              >✓</span
            >
            {{ $t(`basics.lesson.${id}`) }}
          </button>
        </div>
      </section>

      <!-- The technique path and the technique of the week. -->
      <div class="mb-6 grid gap-3 sm:mb-8 sm:grid-cols-2">
        <PathPanels @lesson="(id) => emit('lesson', id)" @weekly="(w) => emit('weekly', w)" />

        <ReviewPanel @review="(ids) => emit('review', ids)" />
        <SpotItPanel @spot="(tier) => emit('spot', tier)" />
      </div>

      <!-- The techniques as cards, or as a map of what builds on what. -->
      <div class="mb-4 flex gap-1.5" role="group" :aria-label="$t('academy.view.label')">
        <button
          v-for="v in ['list', 'map'] as const"
          :key="v"
          :aria-pressed="view === v"
          :class="view === v ? 'tile-primary' : ''"
          class="tile px-3 py-1.5 text-xs font-bold"
          @click="view = v"
        >
          {{ $t(`academy.view.${v}`) }}
        </button>
      </div>

      <AcademyMap
        v-if="view === 'map'"
        :path-state="pathState"
        :stars-of="starsOf"
        :mastery-of="masteryOf"
        @open="openFromMap"
      />

      <template v-if="view === 'list'">
        <!-- Example legend -->
        <div
          class="panel mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-[0.6875rem] text-zinc-600 sm:mb-8 sm:px-4 dark:text-zinc-400"
        >
          <span class="font-bold text-zinc-700 dark:text-zinc-300">{{ $t("academy.colors") }}</span>
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
          <span class="ml-auto hidden text-zinc-600 sm:inline dark:text-zinc-400">{{
            $t("academy.tapHint")
          }}</span>
        </div>

        <div v-for="tier in tiers" :key="tier" class="mb-10 sm:mb-12">
          <!-- Tier heading -->
          <div class="mb-2 flex items-center gap-3">
            <h2 :class="tierStyles[tier].heading" class="text-lg font-black sm:text-xl">
              {{ $t(`academy.tier.${tier}`) }}
            </h2>
            <span
              :class="tierStyles[tier].badge"
              class="border px-2 py-0.5 text-[0.625rem] font-bold"
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
              :id="`lesson-${tech.id}`"
              tabindex="-1"
              :class="[
                tierStyles[tier].border,
                pathState(tech.id) === 'next' && 'ring-2 ring-violet-500/60',
              ]"
              :data-path="pathState(tech.id)"
              class="panel cursor-pointer scroll-mt-24 p-4 sm:p-5"
              @click="toggleExample(tech.id)"
            >
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-base leading-tight font-black text-zinc-900 dark:text-zinc-100">
                    {{ techName(tech.id) }}
                  </h3>
                  <!-- Only some techniques have a common other name. -->
                  <p
                    v-if="te(`academy.tech.${tech.id}.aka`)"
                    class="mt-0.5 text-[0.6875rem] text-zinc-500"
                  >
                    {{ $t("academy.aka", { names: $t(`academy.tech.${tech.id}.aka`) }) }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <!-- Path state; the free Practice button below stays open either way. -->
                  <span
                    v-if="pathState(tech.id) === 'done'"
                    class="border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[0.5625rem] font-bold text-emerald-700 dark:text-emerald-300"
                    >✓ {{ $t("path.cardDone") }}</span
                  >
                  <span
                    v-else-if="pathState(tech.id) === 'next'"
                    class="border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[0.5625rem] font-bold text-violet-700 dark:text-violet-300"
                    >{{ $t("path.next") }}</span
                  >
                  <!-- A later step: just its place on the path, not a lock (the lesson is free). -->
                  <span v-else class="text-[0.625rem] font-bold text-zinc-500 tabular-nums">{{
                    $t("path.step", { n: stepOf(tech.id) })
                  }}</span>
                  <span
                    v-if="starsOf(tech.id)"
                    data-testid="card-stars"
                    role="img"
                    :aria-label="$t('lesson.starsLabel', { n: starsOf(tech.id) })"
                    :title="$t('lesson.starsLabel', { n: starsOf(tech.id) })"
                    class="text-xs tracking-tight text-amber-700 dark:text-amber-400"
                    >{{ "★".repeat(starsOf(tech.id)) + "☆".repeat(3 - starsOf(tech.id)) }}</span
                  >
                  <span
                    v-if="masteryOf(tech.id) > 0"
                    :class="MASTERY_STYLE[masteryOf(tech.id)]"
                    class="border px-1.5 py-0.5 text-[0.5625rem] font-bold"
                    :title="masteryTitle(tech.id)"
                    >{{ $t(`academy.mastery.${masteryOf(tech.id)}`)
                    }}<template v-if="countOf(tech.id)"> ×{{ countOf(tech.id) }}</template></span
                  >
                  <AppIcon
                    class="h-4 w-4 text-zinc-500 transition-transform"
                    :class="{ 'rotate-180': expanded.has(tech.id) }"
                    path="M19 9l-7 7-7-7"
                  />
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="min-w-0 flex-1 space-y-3">
                  <div>
                    <p class="mb-1 text-[0.625rem] font-bold text-zinc-500">
                      {{ $t("academy.lookForLabel") }}
                    </p>
                    <p class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {{ $t(`academy.tech.${tech.id}.lookFor`) }}
                    </p>
                  </div>
                  <div>
                    <p class="mb-1 text-[0.625rem] font-bold text-zinc-500">
                      {{ $t("academy.howItHelpsLabel") }}
                    </p>
                    <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {{ $t(`academy.tech.${tech.id}.howItHelps`) }}
                    </p>
                  </div>
                  <div>
                    <p class="mb-1 text-[0.625rem] font-bold text-zinc-500">
                      {{ $t("academy.spotLabel") }}
                    </p>
                    <ol
                      class="list-decimal space-y-0.5 pl-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                    >
                      <li v-for="step in splitLines(`academy.tech.${tech.id}.spot`)" :key="step">
                        {{ step }}
                      </li>
                    </ol>
                  </div>
                  <!-- Folded so 22 cards don't become walls of text; .stop keeps the card's example shut. -->
                  <details @click.stop>
                    <summary
                      class="cursor-pointer text-[0.625rem] font-bold text-violet-700 dark:text-violet-300"
                    >
                      {{ $t("academy.moreLabel") }}
                    </summary>
                    <div class="mt-2 space-y-3">
                      <div>
                        <p class="mb-1 text-[0.625rem] font-bold text-zinc-500">
                          {{ $t("academy.whyLabel") }}
                        </p>
                        <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {{ $t(`academy.tech.${tech.id}.why`) }}
                        </p>
                      </div>
                      <div>
                        <p class="mb-1 text-[0.625rem] font-bold text-zinc-500">
                          {{ $t("academy.tipsLabel") }}
                        </p>
                        <ul
                          class="list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
                        >
                          <li v-for="tip in splitLines(`academy.tech.${tech.id}.tips`)" :key="tip">
                            {{ tip }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
                <!-- Thumbnail of the worked example; the full one opens on click. -->
                <div
                  v-if="!expanded.has(tech.id) && exampleFor(tech.id)"
                  class="hidden w-[6.5rem] shrink-0 sm:block"
                >
                  <ExampleGrid
                    mini
                    :board="exampleFor(tech.id)!.board"
                    :target="exampleFor(tech.id)!.target"
                    :trigger="exampleFor(tech.id)!.trigger"
                    :elimination="elimDisplay(exampleFor(tech.id)!)"
                  />
                </div>
              </div>

              <div class="mt-4 flex gap-2">
                <button
                  class="tile flex-1 px-2 py-2 text-xs font-bold text-violet-700 dark:text-violet-300"
                  @click.stop="emit('lesson', tech.id)"
                >
                  {{ $t("lesson.button") }}
                </button>
                <button
                  class="tile flex-1 px-2 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                  @click.stop="emit('practice', tech.id)"
                >
                  {{ $t("practice.button") }}
                </button>
              </div>

              <div
                v-if="expanded.has(tech.id) && exampleFor(tech.id)"
                class="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"
                @click.stop
              >
                <p class="mb-3 text-center text-[0.625rem] font-bold text-zinc-500">
                  {{ $t("academy.workedExample") }}
                </p>
                <WatchExample
                  :id="tech.id"
                  :example="exampleFor(tech.id)!"
                  :elimination="elimDisplay(exampleFor(tech.id)!)"
                  :caption="caption(tech.id, exampleFor(tech.id)!)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Footer -->
      <div class="border-t border-zinc-200 pt-8 text-center dark:border-zinc-800">
        <p class="mx-auto max-w-lg text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {{ $t("academy.footer") }}
        </p>
        <button
          @click="emit('back-to-menu')"
          class="tile mt-6 px-8 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300"
        >
          {{ $t(inGame ? "settings.backToGame" : "academy.back") }}
        </button>
      </div>
    </div>
  </div>
</template>
