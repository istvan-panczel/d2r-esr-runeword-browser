import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  CRAFTING_SLOTS,
  type BaseItem,
  type BasesBundle,
  type CraftingBundle,
  type EnhanceBundle,
} from '@/features/game-data/engine/schema';
import { CRAFTS_MAX_PER_SLOT, type CraftAnnotation, type ItemRef } from '../buildData';
import {
  ENHANCE_SLOT_BY_FAMILY,
  OUTDATED_ANOINTMENT,
  addCraft,
  anointmentPoolsFor,
  compactCrafts,
  craftLookups,
  craftPickerGroups,
  enhanceSlotFor,
  removeCraft,
  renderCraft,
  setCraftUses,
} from './crafts';

const gameData = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data', file), 'utf-8')) as T;
const crafting = gameData<CraftingBundle>('crafting.json');
const enhance = gameData<EnhanceBundle>('enhance.json');
const bases = gameData<BasesBundle>('bases.json').bases;
const lookups = craftLookups(crafting, enhance, bases);

// Small hand-made bundles so the rendering tests do not depend on ESR balance values.
const fakeCrafting: CraftingBundle = {
  forgings: [
    { kind: 'rune', key: 'r19', label: 'Ko Rune', bySlot: { weapon: ['+50 to Strength'] } },
    { kind: 'aura', key: 'au1', label: 'Might Stone', bySlot: { amulet: ['Level 5 Might Aura When Equipped'] } },
  ],
  stacking: [
    {
      kind: 'dstone',
      material: { code: 'ppp', label: 'Dragon Stone' },
      bySlot: { weapon: { lines: ['+5% IAS'], steps: [5, 4, 3, 2, 1], levelReq: 2, cap: 121, capLines: ['+121% IAS'] } },
    },
    {
      kind: 'dstone',
      material: { code: 'ppp', label: 'Dragon Stone' },
      switchItem: { code: 'key', label: 'Key' },
      bySlot: { weapon: { lines: ['+2% to Fire Spell Damage'], steps: [2], levelReq: 2 } },
    },
    { kind: 'meld', material: { code: 'grb', label: 'Perfect Ruby' }, bySlot: { helmet: { lines: ['+10 Life'], levelReq: 3 } } },
  ],
};
const fakeEnhance = {
  corruptionOutcomes: [
    {
      slot: 'body',
      roll: 15,
      mods: [],
      lines: ['Magic Resist +(15 to 20)%'],
      variants: [{ qualities: ['hiq', 'nor', 'low'], mods: [], lines: ['Magic Resist +(25 to 35)%'] }],
    },
    { slot: 'weapon', roll: 1, mods: [], lines: ['+(150 to 200)% Enhanced Damage'] },
  ],
  // ESR 3.3: one pool per item type, class types first
  anointmentSlots: [
    { slot: 'ajav', typeCode: 'ajav', label: 'Amazon Javelin', group: 'weapon', rollRange: 1, socketedRollRange: null },
    { slot: 'jave', typeCode: 'jave', label: 'Javelin', group: 'weapon', rollRange: 1, socketedRollRange: null },
    { slot: 'helm', typeCode: 'helm', label: 'Helm', group: 'helm', rollRange: 1, socketedRollRange: null },
  ],
  anointmentOutcomes: [
    { pool: 'ajav', roll: 1, label: 'of Abyss', mods: [], lines: ['20% Chance to Cast Level 60 Abyss on Melee Attack'] },
    { pool: 'jave', roll: 1, label: 'of Storms', mods: [], lines: ['+5 to Lightning Fury'] },
    { pool: 'helm', roll: 1, label: 'of the Wizard', mods: [], lines: ['+30% Faster Cast Rate'] },
    { pool: 'charm', roll: 2, mods: [], lines: ['+1 to All Skills'] },
  ],
} as unknown as EnhanceBundle;
const fakeBases = [
  { code: 'am5', name: 'Maiden Javelin', ancestors: ['ajav', 'jave', 'weap'] },
  { code: 'jav', name: 'Javelin', ancestors: ['jave', 'weap'] },
  { code: 'xyz', name: 'Odd Stick', ancestors: ['weap'] },
] as unknown as BaseItem[];
const fake = craftLookups(fakeCrafting, fakeEnhance, fakeBases);
const maidenJavelin = { type: 'unique', id: 1, snapshot: { name: 'Titan', baseItem: 'Maiden Javelin' } } as unknown as ItemRef;

describe('enhance slot mapping', () => {
  it('maps every builds slot family to an existing corruption slot in the committed enhance.json', () => {
    const corruptionSlots = new Set(enhance.corruptionSlots.map((slot) => slot.slot));
    for (const family of CRAFTING_SLOTS)
      expect(corruptionSlots.has(ENHANCE_SLOT_BY_FAMILY[family]), `corruption slot for ${family}`).toBe(true);
  });

  it('picks the anointment pool from the base type (class types first), else offers the pools of the slot group', () => {
    const slots = (item: ItemRef | null, family: Parameters<typeof anointmentPoolsFor>[1], from = fake) =>
      anointmentPoolsFor(item, family, from).map((pool) => pool.slot);
    expect(slots(maidenJavelin, 'weapon')).toEqual(['ajav']);
    expect(slots(null, 'weapon')).toEqual(['ajav', 'jave']);
    expect(slots(null, 'helmet')).toEqual(['helm']);
    // A known base no pool matches: the group's pools too, so there is always something to pick
    const oddStick = { type: 'runeword', id: 1, base: { code: 'xyz' } } as unknown as ItemRef;
    expect(slots(oddStick, 'weapon')).toEqual(['ajav', 'jave']);
    // Committed bundles: a circlet rolls the circlet pool; an unknown helmet offers the 4 helm group pools
    const tiara = { type: 'unique', id: 1, snapshot: { baseItem: 'Tiara' } } as unknown as ItemRef;
    expect(slots(tiara, 'helmet', lookups)).toEqual(['circ']);
    expect(slots(null, 'helmet', lookups)).toEqual(['phlm', 'pelt', 'circ', 'helm']);
    for (const family of CRAFTING_SLOTS) expect(anointmentPoolsFor(null, family, lookups).length, family).toBeGreaterThan(0);
  });

  it('maps the families to slots of the same item type', () => {
    const typeCodes: Record<string, string> = {
      weapon: 'weap',
      shield: 'shld',
      helmet: 'helm',
      armor: 'tors',
      gloves: 'glov',
      boots: 'boot',
      belt: 'belt',
      amulet: 'amul',
      ring: 'ring',
    };
    for (const family of CRAFTING_SLOTS) {
      expect(enhance.corruptionSlots.find((slot) => slot.slot === ENHANCE_SLOT_BY_FAMILY[family])?.typeCode).toBe(typeCodes[family]);
    }
  });

  it('resolves ring 1/2 and the weapon swap through the slot family', () => {
    expect(enhanceSlotFor('armor')).toBe('body');
    expect(enhanceSlotFor('helmet')).toBe('helm');
    expect(enhanceSlotFor('ring2')).toBe('ring');
    expect(enhanceSlotFor('weapon2')).toBe('weapon');
    expect(enhanceSlotFor('shield2')).toBe('shield');
  });
});

describe('renderCraft', () => {
  it('renders a corruption with its lines and mentions quality variants', () => {
    expect(renderCraft({ kind: 'corruption', slot: 'body', roll: 15 }, 'armor', fake)).toEqual({
      title: 'Corruption',
      lines: ['Magic Resist +(15 to 20)%'],
      note: 'Other values on Superior / Normal / Low Quality items',
      stale: false,
    });
    expect(renderCraft({ kind: 'corruption', slot: 'weapon', roll: 1 }, 'weapon', fake)).toEqual({
      title: 'Corruption',
      lines: ['+(150 to 200)% Enhanced Damage'],
      stale: false,
    });
  });

  it('renders an anointment with its label; an ESR 3.2 per-slot anointment is outdated', () => {
    expect(renderCraft({ kind: 'anointment', itemType: 'ajav', roll: 1 }, 'weapon', fake)).toEqual({
      title: 'Anointment · of Abyss',
      lines: ['20% Chance to Cast Level 60 Abyss on Melee Attack'],
      stale: false,
    });
    expect(renderCraft({ kind: 'anointment', itemType: 'charm', roll: 2 }, 'weapon', fake).title).toBe('Anointment');
    // Even when the old pool id is also a 3.3 type code (helm, ring): the rolls mean other outcomes now
    expect(renderCraft({ kind: 'anointment', pool: 'helm', roll: 1 }, 'helmet', fake)).toEqual({
      title: OUTDATED_ANOINTMENT,
      lines: [],
      stale: true,
    });
    // An anointment of another item type (the slot's item changed): outdated; without the item it is not checked
    const javelin = { kind: 'anointment', itemType: 'jave', roll: 1 } as const;
    expect(renderCraft(javelin, 'weapon', fake, maidenJavelin)).toEqual({ title: OUTDATED_ANOINTMENT, lines: [], stale: true });
    expect(renderCraft(javelin, 'weapon', fake, null).stale).toBe(false);
    expect(renderCraft(javelin, 'weapon', fake).stale).toBe(false);
  });

  it('renders a forging with the slot family line', () => {
    expect(renderCraft({ kind: 'forge', forge: 'rune', key: 'r19' }, 'weapon', fake)).toEqual({
      title: 'Rune Forging · Ko Rune',
      lines: ['+50 to Strength'],
      stale: false,
    });
    expect(renderCraft({ kind: 'forge', forge: 'aura', key: 'au1' }, 'amulet', fake).title).toBe('Aura Forging · Might Stone');
  });

  it('renders D-stoning with the level requirement times uses, the per-use steps and the cap, never a summed total', () => {
    expect(renderCraft({ kind: 'dstone', material: 'ppp', uses: 3 }, 'weapon', fake)).toEqual({
      title: 'D-stoning · Dragon Stone ×3',
      lines: ['+5% IAS', '+6 Level Required'],
      note: 'per use: 5, 4, 3, 2, 1 · cap: +121% IAS',
      stale: false,
    });
    expect(renderCraft({ kind: 'dstone', material: 'ppp', switchItem: 'key', uses: 1 }, 'weapon', fake)).toEqual({
      title: 'D-stoning · Dragon Stone + Key ×1',
      lines: ['+2% to Fire Spell Damage', '+2 Level Required'],
      stale: false,
    });
  });

  it('renders gem melding', () => {
    expect(renderCraft({ kind: 'meld', material: 'grb', uses: 2 }, 'helmet', fake)).toEqual({
      title: 'Gem melding · Perfect Ruby ×2',
      lines: ['+10 Life', '+6 Level Required'],
      stale: false,
    });
  });

  it('marks unknown ids, a slot family without a row and missing bundles as stale, titled from the ids', () => {
    const cases: [CraftAnnotation, string][] = [
      [{ kind: 'corruption', slot: 'body', roll: 7 }, 'Corruption (roll 7)'],
      [{ kind: 'anointment', itemType: 'helm', roll: 4 }, 'Anointment (roll 4)'],
      [{ kind: 'forge', forge: 'rune', key: 'r99' }, 'Forging (rune r99)'],
      [{ kind: 'forge', forge: 'aura', key: 'au1' }, 'Forging (aura au1)'],
      [{ kind: 'dstone', material: 'ppp', switchItem: 'vps', uses: 2 }, 'D-stoning (ppp + vps) ×2'],
      [{ kind: 'meld', material: 'grb', uses: 1 }, 'Gem melding (grb) ×1'],
    ];
    for (const [craft, title] of cases) {
      expect(renderCraft(craft, 'weapon', fake)).toEqual({ title, lines: [], stale: true });
    }
    expect(renderCraft({ kind: 'forge', forge: 'rune', key: 'r19' }, 'weapon', undefined)).toEqual({
      title: 'Forging (rune r19)',
      lines: [],
      stale: true,
    });
    expect(renderCraft({ kind: 'forge', forge: 'rune', key: 'r19' }, 'weapon', craftLookups(undefined, undefined)).stale).toBe(true);
  });

  it('resolves the spec example against the committed bundles', () => {
    expect(renderCraft({ kind: 'forge', forge: 'rune', key: 'r19' }, 'weapon', lookups)).toMatchObject({
      title: 'Rune Forging · Ko Rune',
      stale: false,
    });
    const dstone = renderCraft({ kind: 'dstone', material: 'ppp', uses: 3 }, 'weapon', lookups);
    expect(dstone.stale).toBe(false);
    expect(dstone.title).toBe('D-stoning · Dragon Stone ×3');
  });
});

describe('crafting list edits', () => {
  const forge: CraftAnnotation = { kind: 'forge', forge: 'rune', key: 'r19' };
  const dstone: CraftAnnotation = { kind: 'dstone', material: 'ppp', uses: 1 };

  it('increments the uses of a D-stoning / meld already in the list, per (material, switch item)', () => {
    const list = addCraft(addCraft([dstone], dstone), { kind: 'dstone', material: 'ppp', switchItem: 'key', uses: 1 });
    expect(list).toEqual([
      { kind: 'dstone', material: 'ppp', uses: 2 },
      { kind: 'dstone', material: 'ppp', switchItem: 'key', uses: 1 },
    ]);
    expect(addCraft([{ kind: 'meld', material: 'grb', uses: 99 }], { kind: 'meld', material: 'grb', uses: 1 })).toEqual([
      { kind: 'meld', material: 'grb', uses: 99 },
    ]);
  });

  it('keeps one forging, corruption and anointment per slot', () => {
    expect(addCraft([forge, dstone], { kind: 'forge', forge: 'stat', key: 'gcr' })).toEqual([
      { kind: 'forge', forge: 'stat', key: 'gcr' },
      dstone,
    ]);
  });

  it('ignores a new entry past the cap', () => {
    const full = Array.from({ length: CRAFTS_MAX_PER_SLOT }, (_, index): CraftAnnotation => ({
      kind: 'meld',
      material: `m${String(index)}`,
      uses: 1,
    }));
    expect(addCraft(full, forge)).toBe(full);
  });

  it('sets uses within 1..99 and removes entries', () => {
    expect(setCraftUses([forge, dstone], 1, 0)).toEqual([forge, dstone]);
    expect(setCraftUses([forge, dstone], 1, 120)).toEqual([forge, { ...dstone, uses: 99 }]);
    expect(setCraftUses([forge, dstone], 0, 5)).toEqual([forge, dstone]);
    expect(removeCraft([forge, dstone], 0)).toEqual([dstone]);
  });

  it('compactCrafts drops empty and missing lists', () => {
    expect(compactCrafts({ weapon: [forge], helmet: [], belt: undefined })).toEqual({ weapon: [forge] });
  });
});

describe('craftPickerGroups', () => {
  it('lists the options for the slot family and hides the single-use groups once set', () => {
    const groups = craftPickerGroups('weapon', fake, [], maidenJavelin);
    expect(groups.map((group) => group.heading)).toEqual(['Corruption', 'Anointment · Amazon Javelin', 'Forging', 'D-stoning']);
    expect(groups[1]?.options.map((option) => option.craft)).toEqual([{ kind: 'anointment', itemType: 'ajav', roll: 1 }]);
    // Without a known base: first the item type, then its outcomes
    const choose = craftPickerGroups('weapon', fake, []);
    expect(choose.map((group) => group.heading)).toEqual(['Corruption', 'Anointment: pick the item type', 'Forging', 'D-stoning']);
    expect(choose[1]?.options.map((option) => [option.label, option.pool, option.craft])).toEqual([
      ['Amazon Javelin', 'ajav', null],
      ['Javelin', 'jave', null],
    ]);
    expect(craftPickerGroups('weapon', fake, [], null, 'jave')[1]?.options.map((option) => option.craft)).toEqual([
      { kind: 'anointment', itemType: 'jave', roll: 1 },
    ]);
    expect(groups.find((group) => group.heading === 'Forging')?.options.map((option) => option.label)).toEqual(['Rune Forging · Ko Rune']);
    expect(groups.find((group) => group.heading === 'D-stoning')?.options.map((option) => option.craft)).toEqual([
      { kind: 'dstone', material: 'ppp', uses: 1 },
      { kind: 'dstone', material: 'ppp', switchItem: 'key', uses: 1 },
    ]);
    expect(groups.find((group) => group.heading === 'D-stoning')?.options.map((option) => option.detail)).toEqual([
      '+5% IAS, cap +121% IAS',
      '+2% to Fire Spell Damage',
    ]);
    const withSingles = craftPickerGroups(
      'weapon',
      fake,
      [
        { kind: 'forge', forge: 'rune', key: 'r19' },
        { kind: 'corruption', slot: 'weapon', roll: 1 },
        { kind: 'anointment', itemType: 'ajav', roll: 1 },
      ],
      maidenJavelin
    );
    expect(withSingles.map((group) => group.heading)).toEqual(['D-stoning']);
    // An outdated anointment does not hide the group: a new pick replaces it
    const outdated: CraftAnnotation = { kind: 'anointment', pool: 'weapon', roll: 1 };
    expect(craftPickerGroups('weapon', fake, [outdated], maidenJavelin).map((group) => group.heading)).toContain(
      'Anointment · Amazon Javelin'
    );
    expect(addCraft([outdated], { kind: 'anointment', itemType: 'ajav', roll: 1 })).toEqual([
      { kind: 'anointment', itemType: 'ajav', roll: 1 },
    ]);
    // Nor does one of another item type (the slot's item changed)
    const otherType: CraftAnnotation = { kind: 'anointment', itemType: 'jave', roll: 1 };
    expect(craftPickerGroups('weapon', fake, [otherType], maidenJavelin).map((group) => group.heading)).toContain(
      'Anointment · Amazon Javelin'
    );
  });

  it('uses the enhance slot of the family and the outcome lines for search', () => {
    const armor = craftPickerGroups('armor', fake, []);
    const corruption = armor.find((group) => group.heading === 'Corruption');
    expect(corruption?.options.map((option) => option.craft)).toEqual([{ kind: 'corruption', slot: 'body', roll: 15 }]);
    expect(corruption?.options[0]?.search).toContain('magic resist');
    expect(craftPickerGroups('helmet', fake, []).map((group) => group.heading)).toEqual(['Anointment · Helm', 'Gem melding']);
  });

  it('offers options for every slot family from the committed bundles', () => {
    for (const slot of ['helmet', 'armor', 'weapon', 'shield', 'gloves', 'boots', 'belt', 'amulet', 'ring1'] as const) {
      const headings = craftPickerGroups(slot, lookups, []).map((group) => group.heading.replace(/ · .*$/, ''));
      // Without a base: the slot's pools to choose from (a single pool: its outcomes directly)
      expect(headings, slot).toEqual(expect.arrayContaining(['Corruption', 'Forging', 'D-stoning']));
      expect(
        headings.some((heading) => heading.startsWith('Anointment')),
        slot
      ).toBe(true);
    }
  });
});
