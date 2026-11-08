// The live state of the import panel: a review row stays open while its slot still holds what the import put there.

import type { DraftReviewRow, DraftSlot } from '@/features/character/engine/buildDraft';
import type { GearSection, SectionDraft, VariantDraft } from '../components/buildFormModel';
import { itemRefKey } from './resolveItem';

const SECTION_LABELS: Readonly<Record<GearSection, string>> = { player: 'Player', swap: 'Weapon Swap', merc: 'Mercenary' };

const SLOT_LABELS: Readonly<Record<DraftSlot, string>> = {
  helmet: 'Helmet',
  amulet: 'Amulet',
  armor: 'Armor',
  weapon: 'Weapon',
  shield: 'Shield',
  gloves: 'Gloves',
  belt: 'Belt',
  boots: 'Boots',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  weapon2: 'Weapon',
  shield2: 'Shield',
};

/** "Mercenary · Gloves" */
export function reviewRowSlotLabel(row: Pick<DraftReviewRow, 'section' | 'slot'>): string {
  return `${SECTION_LABELS[row.section]} · ${SLOT_LABELS[row.slot]}`;
}

function sectionOf(draft: VariantDraft, section: GearSection): SectionDraft<string> {
  return draft[section];
}

/** Whether the slot still holds the imported item. */
export function isReviewRowOpen(row: DraftReviewRow, draft: VariantDraft): boolean {
  const current = sectionOf(draft, row.section).items[row.slot] ?? null;
  return current !== null && itemRefKey(current) === itemRefKey(row.ref);
}

/** The rows still to look at: the slot unchanged and not dismissed. None when the imported variant is gone. */
export function openReviewRows(
  rows: readonly DraftReviewRow[],
  draft: VariantDraft | undefined,
  dismissed: ReadonlySet<string>
): readonly DraftReviewRow[] {
  if (draft === undefined) return [];
  return rows.filter((row) => !dismissed.has(row.id) && isReviewRowOpen(row, draft));
}
