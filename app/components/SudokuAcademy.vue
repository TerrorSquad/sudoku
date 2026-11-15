<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

import type { TechniqueId } from "../utils/sudokuGrader";

import { useTechniquePath } from "../composables/useTechniquePath";
import { useTechniqueStats } from "../composables/useTechniqueStats";
import { ACADEMY_EXAMPLES, type AcademyExample } from "../utils/academyExamples";
import { BASICS_IDS, type BasicsId } from "../utils/basics";
import { lessonFromExample } from "../utils/lesson";
import { masteryFor } from "../utils/mastery";
import { patternMarks, type Mark } from "../utils/patternMarks";
import {
  ACADEMY_TECHNIQUES,
  nextChallenge,
  weekOf,
  type Tier,
  type Week,
} from "../utils/progression";
import ExampleGrid from "./ExampleGrid.vue";

// Opens on this technique's lesson, expanded and scrolled to (the win screen links here).
const props = defineProps<{ focus?: TechniqueId | null; inGame?: boolean }>();

const emit = defineEmits<{
  (e: "back-to-menu"): void;
  (e: "practice", id: TechniqueId): void;
  (e: "lesson", id: TechniqueId): void;
  (e: "basics", id: BasicsId): void;
  (e: "weekly", week: Week): void;
}>();

const { t } = useI18n();
const techStats = useTechniqueStats();

// Exactly the techniques the in-game analyzer uses (and can hint), in the order of the
// technique path. Names/descriptions/captions come from i18n; the name reuses the hint title.
const techniques = ACADEMY_TECHNIQUES;

// The technique path: completed challenges, and the one the player is on.
const path = useTechniquePath();
const done = path.getDone();
const nextId = nextChallenge(done);
const doneCount = techniques.filter((tech) => done.includes(tech.id)).length;
const pathState = (id: TechniqueId) =>
  done.includes(id) ? "done" : id === nextId ? "next" : "locked";
// Key, technique and seed all from one date, so a click after midnight Sunday can't mix weeks.
const week = weekOf();
const weeklyDone = path.getWeeksDone().includes(week.key);
const stepOf = (id: TechniqueId) => techniques.findIndex((tech) => tech.id === id) + 1;
// "How to play", the path's step 0: four short lessons before the first technique.
const basicsDone = path.getBasics();
const basicsNext = BASICS_IDS.find((id) => !basicsDone.includes(id)) ?? null;

const MASTERY_STYLE = [
  "",
  "border-zinc-300 bg-zinc-200 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400",
  "border-cyan-400/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
] as const;

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
    badge: "bg-violet-500/15 dark:text-violet-300 text-violet-600 border-violet-500/30",
    heading: "dark:text-violet-300 text-violet-600",
    border: "border-violet-500/20 hover:border-violet-500/50",
  },
  Expert: {
    badge: "bg-rose-500/15 dark:text-rose-300 text-rose-600 border-rose-500/30",
    heading: "dark:text-rose-300 text-rose-600",
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
// The worked example's pattern drawn in pen; built when a card first opens.
const marksCache = new Map<TechniqueId, Mark[]>();
function marksFor(id: TechniqueId): Mark[] {
  let marks = marksCache.get(id);
  if (!marks) {
    const lesson = lessonFromExample(id);
    const has = (r: number, c: number, n: number) => !!lesson?.notes[r]?.[c]?.includes(n);
    marks = lesson ? patternMarks(lesson.move, has) : [];
    marksCache.set(id, marks);
  }
  return marks;
}

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
onMounted(() => {
  const card = props.focus && document.getElementById(`lesson-${props.focus}`);
  if (!card) return;
  card.scrollIntoView();
  card.focus({ preventScroll: true }); // keyboard and screen-reader users land on the lesson
});
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
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-[var(--ground)] py-4 pr-4 pl-4 sm:pl-8 dark:border-zinc-800"
    >
      <button
        :aria-label="$t(inGame ? 'settings.backToGame' : 'menu.back')"
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <AppIcon
          class="h-4 w-4"
          path="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
        />
        <span class="hidden sm:inline">{{ $t(inGame ? "settings.backToGame" : "menu.back") }}</span>
      </button>
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
    </div>

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
        <section class="panel p-4" data-testid="technique-path">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">
              {{ $t("path.title") }}
            </h2>
            <span class="text-xs font-bold text-violet-700 tabular-nums dark:text-violet-300">{{
              $t("path.progress", { done: doneCount, total })
            }}</span>
          </div>
          <div
            class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            aria-hidden="true"
          >
            <div
              class="h-full rounded-full bg-violet-600"
              :style="{ width: `${(doneCount / total) * 100}%` }"
            />
          </div>
          <template v-if="nextId">
            <p class="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              {{ $t("path.nextHint", { name: techName(nextId) }) }}
            </p>
            <button
              class="tile tile-primary mt-3 w-full px-3 py-2.5 text-sm font-bold"
              @click="emit('lesson', nextId)"
            >
              {{ $t("path.next") }}: {{ techName(nextId) }}
            </button>
          </template>
          <p v-else class="mt-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {{ $t("path.allDone", { n: total }) }}
          </p>
        </section>

        <section class="panel p-4" data-testid="technique-of-week">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="text-sm font-black text-zinc-900 dark:text-zinc-100">
              {{ $t("weekly.title") }}
            </h2>
            <span v-if="weeklyDone" class="text-xs font-bold text-emerald-700 dark:text-emerald-400"
              >✓ {{ $t("weekly.done") }}</span
            >
          </div>
          <p class="mt-2 text-base font-black text-zinc-900 dark:text-zinc-100">
            {{ techName(week.technique) }}
          </p>
          <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{{ $t("weekly.desc") }}</p>
          <button
            class="tile tile-amber mt-3 w-full px-3 py-2.5 text-sm font-bold"
            @click="emit('weekly', week)"
          >
            {{ $t("weekly.play") }}
          </button>
        </section>
      </div>

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
              <h3 class="text-base leading-tight font-black text-zinc-900 dark:text-zinc-100">
                {{ techName(tech.id) }}
              </h3>
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
              <ExampleGrid
                :board="exampleFor(tech.id)!.board"
                :notes="exampleFor(tech.id)!.notes"
                :target="exampleFor(tech.id)!.target"
                :trigger="exampleFor(tech.id)!.trigger"
                :elimination="elimDisplay(exampleFor(tech.id)!)"
                :marks="marksFor(tech.id)"
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
