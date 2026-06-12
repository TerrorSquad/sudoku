<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTechniqueStats } from '../composables/useTechniqueStats';
import ExampleGrid from './ExampleGrid.vue';
import { ACADEMY_EXAMPLES, type AcademyExample } from '../utils/academyExamples';
import type { TechniqueId } from '../utils/sudokuGrader';

const emit = defineEmits<{
  (e: 'back-to-menu'): void;
}>();

const techStats = useTechniqueStats();

type Tier = 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';

interface Technique {
  id: TechniqueId;
  name: string;       // must match the in-game hint title (hint.move.<id>.name) so the ×N count lines up
  tier: Tier;
  lookFor: string;
  howItHelps: string;
}

// Exactly the techniques the in-game analyzer uses (and can hint), in the order
// the solver tries them. Every example is a real, valid solver state.
const techniques: Technique[] = [
  {
    id: 'naked-single', name: 'Naked Single', tier: 'Basic',
    lookFor: 'A cell where only one digit is a valid candidate — every other digit already appears in its row, column, or box.',
    howItHelps: 'Place that single remaining candidate. No deduction needed; the answer is forced by elimination.',
  },
  {
    id: 'hidden-single', name: 'Hidden Single', tier: 'Basic',
    lookFor: 'Within a row, column, or box, a digit that can only fit in one cell — even if that cell has other candidates too.',
    howItHelps: 'The digit has nowhere else to go in that unit, so it must go there. Place it.',
  },
  {
    id: 'pointing', name: 'Pointing Pair', tier: 'Intermediate',
    lookFor: 'Inside a box, all candidates for a digit lie on a single row or column.',
    howItHelps: 'The digit must land on that line within the box, so remove it from the rest of that row or column outside the box.',
  },
  {
    id: 'box-line', name: 'Box-Line Reduction', tier: 'Intermediate',
    lookFor: 'All candidates for a digit within a row or column are confined to a single box.',
    howItHelps: 'The digit must live in that line, so remove it from every other cell of that box.',
  },
  {
    id: 'naked-pair', name: 'Naked Pair', tier: 'Intermediate',
    lookFor: 'Two cells in the same unit that each hold exactly the same two candidates and no others.',
    howItHelps: 'Those two digits fill those two cells in some order. Remove both from every other cell in the unit.',
  },
  {
    id: 'hidden-pair', name: 'Hidden Pair', tier: 'Intermediate',
    lookFor: 'Two digits that appear as candidates in exactly two cells of a unit, and nowhere else in it.',
    howItHelps: 'Those two cells must hold those two digits, so all their other candidates can be removed.',
  },
  {
    id: 'naked-triple', name: 'Naked Triple', tier: 'Intermediate',
    lookFor: 'Three cells in a unit whose combined candidates are exactly three digits (each cell holds two or three of them).',
    howItHelps: 'Those three digits are locked into those three cells. Eliminate them from every other cell in the unit.',
  },
  {
    id: 'hidden-triple', name: 'Hidden Triple', tier: 'Intermediate',
    lookFor: 'Three digits that appear only across three cells of a unit, and nowhere else in it.',
    howItHelps: 'Those three cells must contain those three digits, so strip all their other candidates.',
  },
  {
    id: 'naked-quad', name: 'Naked Quad', tier: 'Advanced',
    lookFor: 'Four cells in a unit whose combined candidates are exactly four digits.',
    howItHelps: 'Those four digits are confined to those four cells. Eliminate them from all other cells in the unit.',
  },
  {
    id: 'hidden-quad', name: 'Hidden Quad', tier: 'Advanced',
    lookFor: 'Four digits that appear only within four cells of a unit.',
    howItHelps: 'Those four cells own those four digits, so all their other candidates can be removed.',
  },
  {
    id: 'x-wing', name: 'X-Wing', tier: 'Advanced',
    lookFor: 'A digit with exactly two candidate cells in each of two rows (or columns), all sharing the same two columns (or rows).',
    howItHelps: 'The digit is forced into those two lines, so remove it from those columns (or rows) everywhere else.',
  },
  {
    id: 'swordfish', name: 'Swordfish', tier: 'Advanced',
    lookFor: 'Like an X-Wing but across three rows (or columns), with all candidates spanning exactly three columns (or rows).',
    howItHelps: 'The digit is locked into those three lines, so remove it from the crossing lines everywhere else.',
  },
  {
    id: 'jellyfish', name: 'Jellyfish', tier: 'Advanced',
    lookFor: 'A four-line X-Wing: a digit across four rows (or columns) confined to the same four columns (or rows).',
    howItHelps: 'The digit is locked into those four lines, so remove it from the crossing lines everywhere else.',
  },
  {
    id: 'xy-wing', name: 'XY-Wing', tier: 'Expert',
    lookFor: 'Three bivalue cells: a pivot {X,Y} sharing one candidate with each of two pincers {X,Z} and {Y,Z}.',
    howItHelps: 'Whatever fills the pivot, one pincer becomes Z. Any cell seeing both pincers loses Z.',
  },
  {
    id: 'xyz-wing', name: 'XYZ-Wing', tier: 'Expert',
    lookFor: 'Like an XY-Wing, but the pivot holds three candidates {X,Y,Z} and the two pincers are {X,Z} and {Y,Z}.',
    howItHelps: 'One of the three cells must be Z, so any cell seeing all three loses Z.',
  },
];

const tiers: Tier[] = ['Basic', 'Intermediate', 'Advanced', 'Expert'];

const tierMeta: Record<Tier, { badge: string; desc: string }> = {
  Basic:        { badge: 'bg-emerald-500/15 dark:text-emerald-400 text-emerald-600 border-emerald-500/30', desc: 'Single-cell logic — the foundation.' },
  Intermediate: { badge: 'bg-amber-500/15 dark:text-amber-400 text-amber-700 border-amber-500/30',         desc: 'Locked candidates and naked/hidden subsets.' },
  Advanced:     { badge: 'bg-violet-500/15 dark:text-violet-400 text-violet-600 border-violet-500/30',     desc: 'Fish patterns spanning multiple lines.' },
  Expert:       { badge: 'bg-rose-500/15 dark:text-rose-400 text-rose-600 border-rose-500/30',             desc: 'Wing patterns built from bivalue chains.' },
};

const tierHeading: Record<Tier, string> = {
  Basic:        'dark:text-emerald-400 text-emerald-600',
  Intermediate: 'dark:text-amber-400 text-amber-700',
  Advanced:     'dark:text-violet-400 text-violet-600',
  Expert:       'dark:text-rose-400 text-rose-600',
};

const tierBorder: Record<Tier, string> = {
  Basic:        'border-emerald-500/20 hover:border-emerald-500/50',
  Intermediate: 'border-amber-500/20 hover:border-amber-500/50',
  Advanced:     'border-violet-500/20 hover:border-violet-500/50',
  Expert:       'border-rose-500/20 hover:border-rose-500/50',
};

function byTier(tier: Tier) {
  return techniques.filter(t => t.tier === tier);
}

function exampleFor(id: TechniqueId): AcademyExample | undefined {
  return ACADEMY_EXAMPLES[id];
}

const RC = (p: { r: number; c: number }) => `R${p.r + 1}C${p.c + 1}`;

// For hidden subsets the eliminations fall inside the pattern cells themselves;
// keep those as indigo pattern cells rather than double-marking them rose.
function elimDisplay(ex: AcademyExample): { r: number; c: number }[] {
  return ex.elimination.filter(e => !ex.trigger.some(t => t.r === e.r && t.c === e.c));
}

// A specific, board-accurate caption generated from the real move data.
function caption(id: TechniqueId, ex: AcademyExample): string {
  const digits = ex.digits.join(' & ');
  const elim = elimDisplay(ex);
  const nElim = elim.length;
  const elimList = elim.slice(0, 2).map(RC).join(', ');
  const k = ex.trigger.length;
  switch (id) {
    case 'naked-single':
      return `${RC(ex.placement!)} (green) has only one candidate left — ${ex.placement!.num}. Every other digit is already in its row, column, or box, so ${ex.placement!.num} is placed here.`;
    case 'hidden-single':
      return `Across this unit, ${ex.placement!.num} can only go in ${RC(ex.placement!)} (green) — the other empty cells (amber marks) never list it. So ${ex.placement!.num} must go there.`;
    case 'pointing':
      return `Inside one box, every candidate for ${digits} lies on a single line (${ex.trigger.map(RC).join(', ')}, indigo). So ${digits} is removed from the rest of that line — ${nElim} cell(s) in rose (${elimList}).`;
    case 'box-line':
      return `In one line, ${digits} is confined to a single box (${ex.trigger.map(RC).join(', ')}, indigo). So ${digits} is removed from the rest of that box — ${nElim} cell(s) in rose (${elimList}).`;
    case 'naked-pair':
    case 'naked-triple':
    case 'naked-quad':
      return `These ${k} cells (indigo) hold only {${digits}} between them, locking those digits. They're removed from ${nElim} other cell(s) in the unit — rose (${elimList}).`;
    case 'hidden-pair':
    case 'hidden-triple':
    case 'hidden-quad':
      return `{${digits}} appear only in these ${k} cells (indigo) of the unit, so they must live here — every other candidate in those cells is removed.`;
    case 'x-wing':
    case 'swordfish':
    case 'jellyfish': {
      const lines = id === 'x-wing' ? 'two' : id === 'swordfish' ? 'three' : 'four';
      return `${ex.digits[0]} forms this fish across ${lines} lines (indigo corners), locking it into those lines. So ${ex.digits[0]} is removed from the crossing lines — ${nElim} cell(s) in rose (${elimList}).`;
    }
    case 'xy-wing':
      return `A pivot and two pincers (indigo) chain so that one pincer must be ${ex.digits[0]}. Any cell seeing both pincers loses ${ex.digits[0]} — ${nElim} cell(s) in rose (${elimList}).`;
    case 'xyz-wing':
      return `A 3-candidate pivot and two pincers (indigo) share ${ex.digits[0]}. One of the three must be ${ex.digits[0]}, so a cell seeing all three loses it — ${nElim} cell(s) in rose (${elimList}).`;
    default:
      return '';
  }
}

const expanded = ref<Set<string>>(new Set());
function toggleExample(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  expanded.value = next;
}

const total = computed(() => techniques.length);
</script>

<template>
  <div class="min-h-screen w-full flex flex-col">
    <!-- Header -->
    <div class="sticky top-0 z-10 backdrop-blur border-b pl-4 sm:pl-8 pr-4 py-4 flex items-center gap-4 dark:bg-[#0c0a09]/95 dark:border-zinc-800 bg-white/95 border-zinc-200">
      <button
        @click="emit('back-to-menu')"
        class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider transition-colors dark:text-zinc-400 dark:hover:text-zinc-100 text-zinc-600 hover:text-zinc-900"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
        <span class="hidden sm:inline">Menu</span>
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg sm:text-2xl font-black tracking-tight leading-tight dark:text-zinc-100 text-zinc-900">Sudoku Academy</h1>
        <p class="text-xs text-zinc-500 hidden sm:block">The {{ total }} techniques the analyzer uses — each with a real worked example</p>
      </div>
      <span class="shrink-0 text-xs text-zinc-600 font-semibold hidden sm:inline">{{ total }} techniques</span>
    </div>

    <!-- Content -->
    <div class="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto w-full">

      <!-- Example legend -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 sm:mb-8 px-3 sm:px-4 py-3 border text-[11px] dark:bg-zinc-900/40 dark:border-zinc-800 dark:text-zinc-400 bg-zinc-50 border-zinc-200 text-zinc-600">
        <span class="font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700">Colors</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-emerald-500/30 ring-1 ring-emerald-500 inline-block"></span> Placed cell</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-indigo-500/40 ring-1 ring-indigo-400 inline-block"></span> Pattern</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-rose-500/40 ring-1 ring-rose-400 inline-block"></span> Eliminated</span>
        <span class="ml-auto text-zinc-600 hidden sm:inline">Tap a card to see it worked out</span>
      </div>

      <div v-for="tier in tiers" :key="tier" class="mb-10 sm:mb-12">
        <!-- Tier heading -->
        <div class="flex items-center gap-3 mb-2">
          <h2 :class="tierHeading[tier]" class="text-lg sm:text-xl font-black uppercase tracking-widest">{{ tier }}</h2>
          <span :class="tierMeta[tier].badge" class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border">
            {{ byTier(tier).length }}
          </span>
          <div class="flex-1 h-px dark:bg-zinc-800 bg-zinc-200" />
        </div>
        <p class="text-xs text-zinc-500 mb-4">{{ tierMeta[tier].desc }}</p>

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
              <h3 class="text-base font-black leading-tight dark:text-zinc-100 text-zinc-900">{{ tech.name }}</h3>
              <div class="flex items-center gap-1.5 shrink-0">
                <span
                  v-if="techStats.getCount(tech.name) > 0"
                  class="text-[9px] font-bold px-1.5 py-0.5 border dark:bg-zinc-700/60 dark:border-zinc-600 dark:text-zinc-400 bg-zinc-200 border-zinc-300 text-zinc-600"
                  :title="`You've used this ${techStats.getCount(tech.name)} time(s)`"
                >×{{ techStats.getCount(tech.name) }}</span>
                <svg
                  class="w-4 h-4 text-zinc-500 transition-transform"
                  :class="{ 'rotate-180': expanded.has(tech.id) }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">What to look for</p>
                <p class="text-sm leading-relaxed dark:text-zinc-300 text-zinc-700">{{ tech.lookFor }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">How it helps</p>
                <p class="text-sm leading-relaxed dark:text-zinc-400 text-zinc-600">{{ tech.howItHelps }}</p>
              </div>
            </div>

            <div v-if="expanded.has(tech.id) && exampleFor(tech.id)" class="mt-4 pt-4 border-t dark:border-zinc-800 border-zinc-200" @click.stop>
              <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 text-center">Worked example</p>
              <ExampleGrid
                :board="exampleFor(tech.id)!.board"
                :notes="exampleFor(tech.id)!.notes"
                :target="exampleFor(tech.id)!.target"
                :trigger="exampleFor(tech.id)!.trigger"
                :elimination="elimDisplay(exampleFor(tech.id)!)"
              />
              <p class="text-xs leading-relaxed mt-3 text-center max-w-sm mx-auto dark:text-zinc-400 text-zinc-600">
                {{ caption(tech.id, exampleFor(tech.id)!) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t pt-8 text-center dark:border-zinc-800 border-zinc-200">
        <p class="text-xs text-zinc-600 leading-relaxed max-w-lg mx-auto">
          These are exactly the techniques the in-game analyzer uses. When you request a hint, it applies them from Basic to Expert and shows the same step-by-step deduction.
        </p>
        <button
          @click="emit('back-to-menu')"
          class="mt-6 px-8 py-3 border text-sm font-bold uppercase tracking-wider transition-all active:scale-95 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 bg-zinc-50 hover:bg-zinc-100 border-zinc-300 text-zinc-700"
        >
          Back to Menu
        </button>
      </div>

    </div>
  </div>
</template>
