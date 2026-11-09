/**
 * `::dstone-caps`: the most each D-stoning adds per builds slot family, from crafting.json (`StackingCraftStep.cap`,
 * worked out from the cubemain cap conditions, see game-data `build/cube/dstoneCaps.ts`). One row per ingredients and
 * cap, the slots sharing that cap joined, so the table stays three columns wide on a phone.
 */
import { CRAFTING_SLOTS, type CraftingSlot } from '../../../game-data/engine/schema.ts';
import type { DirectiveResolver } from './types.ts';

const SLOT_LABELS: Readonly<Record<CraftingSlot, string>> = {
  weapon: 'Weapon',
  shield: 'Shield',
  helmet: 'Helm',
  armor: 'Body armor',
  gloves: 'Gloves',
  boots: 'Boots',
  belt: 'Belt',
  amulet: 'Amulet',
  ring: 'Ring',
};

const ARMOUR: readonly CraftingSlot[] = ['shield', 'helmet', 'armor', 'gloves', 'boots', 'belt'];

/** "Weapon, Any armor" when every armour slot shares the cap, else the slots one by one */
function slotsText(slots: readonly CraftingSlot[]): string {
  const allArmour = ARMOUR.every((slot) => slots.includes(slot));
  const labels = slots.flatMap((slot) => {
    if (!allArmour || !ARMOUR.includes(slot)) return [SLOT_LABELS[slot]];
    return slot === ARMOUR[0] ? ['Any armor'] : [];
  });
  return labels.join(', ');
}

/**
 * A D-stoning with no cap in its recipe rows. Enhanced damage on a weapon still stops: the mod author confirmed (2026-11-09)
 * that the stat's save bits make 500% the absolute cap.
 */
function noRecipeCapText(lines: readonly string[], slot: CraftingSlot): string {
  if (slot === 'weapon' && lines.length === 1 && lines[0].endsWith('% Enhanced Damage')) {
    return "+500% Enhanced Damage (the game's absolute limit)";
  }
  return `${lines.join(', ')} per use, no cap`;
}

export const resolveDstoneCaps: DirectiveResolver = (arg, ctx) => {
  if (arg !== null) return { error: '::dstone-caps takes no argument' };
  if (ctx.crafting === null) return { error: '::dstone-caps needs crafting.json (run npm run game-data:generate)' };
  const rows: string[][] = [];
  for (const option of ctx.crafting.stacking) {
    if (option.kind !== 'dstone') continue;
    const ingredients = [option.material.label, ...(option.switchItem === undefined ? [] : [option.switchItem.label])].join(' + ');
    const slotsByCap = new Map<string, CraftingSlot[]>();
    for (const slot of CRAFTING_SLOTS) {
      const step = option.bySlot[slot];
      if (step === undefined) continue;
      const cap = step.capLines === undefined ? noRecipeCapText(step.lines, slot) : step.capLines.join(', ');
      slotsByCap.set(cap, [...(slotsByCap.get(cap) ?? []), slot]);
    }
    for (const [cap, slots] of slotsByCap) rows.push([ingredients, slotsText(slots), cap]);
  }
  if (rows.length === 0) return { error: '::dstone-caps: crafting.json has no D-stoning options' };
  return { kind: 'table', caption: 'D-stoning caps (what D-stoning adds at most)', header: ['Ingredients', 'Item', 'Cap'], rows };
};
