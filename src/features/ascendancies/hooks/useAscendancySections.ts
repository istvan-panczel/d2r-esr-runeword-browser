import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type { AscendancySection } from '@/core/db';

const NO_SECTIONS: readonly AscendancySection[] = [];

/**
 * The other parsed sections of the page's challenge part (the Lich King Bonus) in page order; empty while loading and
 * when the page has none.
 */
export function useAscendancySections(): readonly AscendancySection[] {
  return useLiveQuery(() => db.ascendancySections.toArray().then((sections) => sections.sort((a, b) => a.order - b.order))) ?? NO_SECTIONS;
}
