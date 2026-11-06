/**
 * Tailwind classes of the campaign map canvas (light + dark). Feature-local: no new theme tokens. Every edge kind has
 * its own line pattern and marker too, so colour is never the only cue.
 */
import type { AreaTerrain } from '@/features/game-data/engine/schema';
import type { EdgeKind } from '../../engine/types';

/** Dot fill + outline per terrain (outdoor green, indoor kinds in earth tones, the Arcane Sanctuary violet) */
export const TERRAIN_CLASS: Record<AreaTerrain, string> = {
  town: 'fill-card stroke-foreground',
  outdoor: 'fill-emerald-200 stroke-emerald-700 dark:fill-emerald-900 dark:stroke-emerald-400',
  cave: 'fill-stone-300 stroke-stone-600 dark:fill-stone-700 dark:stroke-stone-300',
  tomb: 'fill-slate-300 stroke-slate-600 dark:fill-slate-700 dark:stroke-slate-300',
  dungeon: 'fill-amber-200 stroke-amber-800 dark:fill-amber-900 dark:stroke-amber-400',
  temple: 'fill-orange-200 stroke-orange-800 dark:fill-orange-900 dark:stroke-orange-400',
  tower: 'fill-zinc-300 stroke-zinc-700 dark:fill-zinc-700 dark:stroke-zinc-300',
  special: 'fill-violet-200 stroke-violet-700 dark:fill-violet-900 dark:stroke-violet-300',
};

export const TERRAIN_LABEL: Record<AreaTerrain, string> = {
  town: 'town',
  outdoor: 'outdoor area',
  cave: 'cave',
  tomb: 'tomb',
  dungeon: 'dungeon',
  temple: 'temple',
  tower: 'tower',
  special: 'special area',
};

interface EdgeStyle {
  readonly className: string;
  readonly width: number;
  readonly dash?: string;
  /** Marker colour class (arrowheads use `fill`) */
  readonly markerClass: string;
}

export const EDGE_STYLE: Record<EdgeKind, EdgeStyle> = {
  border: { className: 'stroke-muted-foreground/35', width: 5, markerClass: 'fill-muted-foreground' },
  passage: { className: 'stroke-muted-foreground', width: 1.6, markerClass: 'fill-muted-foreground' },
  portal: {
    className: 'stroke-fuchsia-600 dark:stroke-fuchsia-400',
    width: 2,
    dash: '6 4',
    markerClass: 'fill-fuchsia-600 dark:fill-fuchsia-400',
  },
  cube: {
    className: 'stroke-amber-600 dark:stroke-amber-400',
    width: 2,
    dash: '9 3 2 3',
    markerClass: 'fill-amber-600 dark:fill-amber-400',
  },
  act: { className: 'stroke-foreground', width: 2.5, markerClass: 'fill-foreground' },
};

export const EDGE_KIND_LABEL: Record<EdgeKind, string> = {
  border: 'walk across',
  passage: 'entrance',
  portal: 'portal',
  cube: 'cube portal',
  act: 'travel to the next act',
};

/** Marker ids per edge kind: `${prefix}-${kind}` (see CanvasMarkers) */
export const markerId = (prefix: string, kind: string) => `${prefix}-${kind}`;

/** Label halo: a card-coloured outline keeps text legible where it crosses an edge (same as the guide map) */
export const HALO = 'stroke-card [paint-order:stroke] [stroke-linejoin:round] [stroke-width:3px]';

/**
 * The selected station: a soft glow disc and a thick ring around the dot, and its label in a filled pill. Amber, like
 * the search-hit pulse, so "this one" reads the same way in both; the glow and pill keep it apart from dungeon dots.
 */
export const SELECTED_GLOW_CLASS = 'fill-amber-400/35 dark:fill-amber-400/25';
export const SELECTED_RING_CLASS = 'stroke-amber-500 dark:stroke-amber-400';
export const SELECTED_PILL_CLASS = 'fill-amber-400 stroke-amber-600 dark:fill-amber-400 dark:stroke-amber-300';
export const SELECTED_PILL_TEXT_CLASS = 'fill-neutral-950 font-semibold';
