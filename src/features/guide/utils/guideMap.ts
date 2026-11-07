/** Pure helpers of the guide overview (`/guide`; first written for the old note map, `/guide/map`). */
import type { GuideBundle, GuideNote, GuideSpineStep } from '../engine/schema';

export type GuideMapGroup =
  | { readonly kind: 'step'; readonly index: number; readonly step: GuideSpineStep; readonly notes: GuideNote[] }
  | { readonly kind: 'other'; readonly notes: GuideNote[] };

/** The note that closes the "Other topics" list (a reference page, not a topic). */
const LAST_OTHER = 'glossary';

/**
 * The overview's list (every note of the bundle, once): one group per spine step (notes in spine order, slugs missing from the bundle skipped, a note listed
 * on two steps shown on the first only), then the notes on no step as "Other topics", alphabetical by title with the
 * glossary last. The "other" group is left out when it would be empty.
 */
export function groupNotesForMap(bundle: Pick<GuideBundle, 'notes' | 'spine'>): GuideMapGroup[] {
  const bySlug = new Map(bundle.notes.map((note) => [note.slug, note]));
  const placed = new Set<string>();
  const groups: GuideMapGroup[] = bundle.spine.steps.map((step, index) => ({
    kind: 'step',
    index,
    step,
    notes: step.notes.flatMap((slug) => {
      const note = bySlug.get(slug);
      if (note === undefined || placed.has(slug)) return [];
      placed.add(slug);
      return [note];
    }),
  }));

  const rank = (note: GuideNote) => (note.slug === LAST_OTHER ? 1 : 0);
  const other = bundle.notes
    .filter((note) => !placed.has(note.slug))
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'en') || a.slug.localeCompare(b.slug, 'en'));
  if (other.length > 0) groups.push({ kind: 'other', notes: other });
  return groups;
}
