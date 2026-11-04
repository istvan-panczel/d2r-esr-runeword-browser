/**
 * Local colours of the page around the canvas (connection chips, trust labels, heads-up rows, the waypoint chip),
 * light + dark, as literal Tailwind classes (the scanner must see them). Not global theme tokens: the owner's rule is no
 * new app colours. The edge colours follow the canvas (`canvas/canvasStyles.ts` EDGE_STYLE).
 */
import type { EdgeKind } from '../engine/types';
import type { FactTone } from '../utils/sourceLabels';

/** Text colour of a connection chip's glyph per edge kind */
export const EDGE_TEXT_CLASS: Record<EdgeKind, string> = {
  border: 'text-muted-foreground',
  passage: 'text-muted-foreground',
  portal: 'text-fuchsia-600 dark:text-fuchsia-400',
  cube: 'text-amber-600 dark:text-amber-400',
  act: 'text-foreground',
};

export const ONE_WAY_TEXT_CLASS = 'text-foreground font-semibold';

/** Trust label chip per tone */
export const FACT_TONE_CLASS: Record<FactTone, string> = {
  neutral: 'border-border text-muted-foreground',
  official: 'border-emerald-700/40 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300',
  caution: 'border-dashed border-amber-600/70 text-amber-800 dark:border-amber-400/60 dark:text-amber-300',
  confirmed: 'border-primary/40 text-foreground',
};

/** The "Heads up" rows */
export const WARNING_BOX_CLASS = 'border-amber-500/40 bg-amber-500/5 text-foreground dark:border-amber-400/30 dark:bg-amber-400/10';

/** Warning icon colour */
export const WARNING_ICON_CLASS = 'text-amber-600 dark:text-amber-400';

/** The waypoint chip (the canvas draws a sky ring around waypoint dots) */
export const WAYPOINT_CHIP_CLASS = 'bg-sky-700 text-white dark:bg-sky-500 dark:text-neutral-950';
