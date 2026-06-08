import type { CharacterClass } from '../constants';

interface ClassStyle {
  /** Tailwind classes that tint the class badge for this class. */
  readonly badge: string;
}

// Thematic per-class accent applied to the class tag. Full class strings so Tailwind picks them up.
export const CLASS_STYLES: Record<CharacterClass, ClassStyle> = {
  Amazon: { badge: 'border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-300' },
  Assassin: { badge: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  Barbarian: { badge: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300' },
  Druid: { badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  Necromancer: { badge: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  Paladin: { badge: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  Sorceress: { badge: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
};

/** Looks up the style for a class string (builds store `class` as a plain string). */
export function classStyle(characterClass: string): ClassStyle | undefined {
  return CLASS_STYLES[characterClass as CharacterClass];
}
