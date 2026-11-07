/** The source badges' labels and colours (SourceBadge, the legend, the fact tables) */
import type { ModifierFactOrigin } from '@/features/game-data/engine/schema';
import type { SourceKind } from './modifierContent';

/**
 * Per source kind: the short label (inline after a claim), the badge label (fact tables, legend), the full meaning
 * (tooltips) and the colours. Vanilla claims get a dashed, muted amber look: not confirmed for ESR.
 */
export const SOURCE_KINDS: Readonly<Record<SourceKind, { short: string; label: string; full: string; className: string }>> = {
  'esr-config': {
    short: 'ESR config',
    label: 'ESR config',
    full: "ESR config: the mod's loader plugin configs and memory patches (d2rloader)",
    className: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  },
  'esr-files': {
    short: 'ESR files',
    label: 'ESR game files',
    full: "ESR game files: the mod's txt tables, strings, official docs and patch notes",
    className: 'border-sky-600/40 bg-sky-500/10 text-sky-800 dark:text-sky-300',
  },
  'mod-author': {
    short: 'Mod author',
    label: 'ESR mod author',
    full: "ESR mod author: CelestialRay's answers to our questions about the current ESR version (dated in the card's sources)",
    className: 'border-teal-600/40 bg-teal-500/10 text-teal-800 dark:text-teal-300',
  },
  vanilla: {
    short: 'Vanilla D2',
    label: 'Vanilla D2 behaviour, not confirmed for ESR',
    full: 'Vanilla D2 behaviour, not confirmed for ESR',
    className: 'border-dashed border-amber-600/50 bg-amber-500/5 text-amber-800/90 dark:text-amber-300/90',
  },
  community: {
    short: 'Community',
    label: 'Community (older ESR version)',
    full: 'Community (older ESR version): the unofficial wiki and its mod-author Q&A, written for ESR 3.9 / 3.10',
    className: 'border-violet-600/40 bg-violet-500/10 text-violet-800 dark:text-violet-300',
  },
};

export const FACT_ORIGIN_SOURCE: Readonly<Record<ModifierFactOrigin, SourceKind>> = {
  'esr-config': 'esr-config',
  'game-files': 'esr-files',
  'vanilla-engine': 'vanilla',
};
