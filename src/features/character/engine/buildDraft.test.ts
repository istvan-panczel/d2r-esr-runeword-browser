import { describe, expect, it } from 'vitest';
import type { Gemword, HtmUniqueItem, MythicalUnique, Runeword } from '@/core/db';
import type { MythicalItemRef, RunewordItemRef, SetItemRef, UniqueItemRef, GemwordItemRef } from '@/features/builds/buildData';
import { STASH_ITEM_FLAGS, type SetsBundle, type TxtRunewordsBundle } from '@/features/game-data/engine/schema';
import { makeBundle, makeItem } from '@/features/stash/testing/stashMocks.mock';
import { stashCatalog } from '@/features/stash/engine/catalog';
import { buildItemTypeIndex } from '@/features/stash/engine/itemTypes';
import type { ItemTextContext } from '@/features/stash/engine/items/itemText';
import { equippedGear } from '../parser/location';
import type { CharacterFile, CharacterItem, EquipSlot, ItemLocation, SkillBinding, WeaponSetNumber } from '../parser/types';
import type { StashItem } from '@/features/stash/parser/types';
import { createBuildDraft, skillsInUseLine, type BuildDraftData } from './buildDraft';
import { checkSaveUpload, draftFromSaveBytes } from './buildDraftRead';

const BUNDLE = makeBundle({
  items: [
    ['cap', STASH_ITEM_FLAGS.armor, 2, 2],
    ['ymg', STASH_ITEM_FLAGS.armor, 2, 2],
    ['bmb', STASH_ITEM_FLAGS.armor, 2, 1],
    ['hax', STASH_ITEM_FLAGS.weapon, 1, 3],
    ['rin', 0, 1, 1],
    ['cm3', STASH_ITEM_FLAGS.charm, 1, 3],
    ['jew', 0, 1, 1],
    ['r01', 0, 1, 1],
    ['gcv', 0, 1, 1],
    ['led', STASH_ITEM_FLAGS.charm, 1, 1],
    ['ast', 0, 1, 1],
    ['hst', STASH_ITEM_FLAGS.weapon, 1, 4],
  ],
  bases: [
    { code: 'cap', name: 'Cap', type: 'helm', tier: 'normal' },
    { code: 'ymg', name: 'Sepulcher Gloves', type: 'glov', tier: 'elite' },
    { code: 'bmb', name: 'Merchant Belt', type: 'belt', tier: 'elite' },
    { code: 'hax', name: 'Hand Axe', type: 'axe', tier: 'normal' },
    { code: 'rin', name: 'Ring', type: 'ring' },
    { code: 'cm3', name: 'Grand Charm', type: 'gcha' },
    { code: 'jew', name: 'Jewel', type: 'jewl' },
    { code: 'r01', name: 'I Rune', type: 'rune' },
    { code: 'gcv', name: 'Chipped Amethyst', type: 'gem' },
    { code: 'led', name: 'Kill Ledger', type: 'gcha' },
    { code: 'ast', name: 'Ascendancy Stone', type: 'misc' },
    { code: 'hst', name: 'Horadric Staff', type: 'staf' },
  ],
  uniques: [
    { id: 5, name: 'Peasant Crown', code: 'cap' },
    { id: 554, name: "Death's Grip", code: 'ymg' },
    { id: 600, name: "Tathamet's Awakening", code: 'hax' },
    { id: 700, name: 'Blademaster Ascendancy Stone', code: 'ast' },
    { id: 701, name: 'Twin Blade', code: 'hax' },
  ],
  setItems: [{ id: 5, name: "Civerb's Ward", code: 'cap', set: "Civerb's Vestments" }],
  sets: [{ id: "Civerb's Vestments", name: "Civerb's Vestments" }],
  runewords: [
    { id: 100, key: 'Runeword1', name: 'Stealth' },
    { id: 101, key: 'Runeword2', name: 'Gemmy' },
    { id: 102, key: 'Runeword3', name: 'Tied' },
  ],
});
const TYPE_ROWS = [
  { code: 'armo', name: 'Any Armor', ancestors: ['armo'] },
  { code: 'helm', name: 'Helm', ancestors: ['helm', 'armo'] },
  { code: 'glov', name: 'Gloves', ancestors: ['glov', 'armo'] },
  { code: 'belt', name: 'Belt', ancestors: ['belt', 'armo'] },
  { code: 'weap', name: 'Weapon', ancestors: ['weap'] },
  { code: 'axe', name: 'Axe', ancestors: ['axe', 'weap'] },
  { code: 'staf', name: 'Staff', ancestors: ['staf', 'weap'] },
  { code: 'misc', name: 'Miscellaneous', ancestors: ['misc'] },
  { code: 'ring', name: 'Ring', ancestors: ['ring', 'misc'] },
  { code: 'char', name: 'Charm', ancestors: ['char', 'misc'] },
  { code: 'gcha', name: 'Grand Charm', ancestors: ['gcha', 'char', 'misc'] },
  { code: 'jewl', name: 'Jewel', ancestors: ['jewl', 'misc'] },
  { code: 'rune', name: 'Rune', ancestors: ['rune', 'misc'] },
  { code: 'gem', name: 'Gem', ancestors: ['gem', 'misc'] },
];
const catalog = stashCatalog(BUNDLE, buildItemTypeIndex(TYPE_ROWS));

const text: ItemTextContext = {
  catalog,
  hasText: false,
  names: {
    magicPrefix: (id) => (id === 1 ? 'Shimmering' : null),
    magicSuffix: (id) => (id === 1 ? 'of Vita' : null),
    autoAffix: () => null,
    rareName: (id) => (id === 1 ? 'Havoc' : id === 2 ? 'Finger' : null),
    lowQuality: () => null,
    superior: 'Superior',
  },
};

const noSnapshotColumns = { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [] };
const unique = (fields: Partial<HtmUniqueItem>): HtmUniqueItem => ({
  id: 1,
  name: 'Peasant Crown',
  baseItem: 'Cap',
  baseItemCode: 'cap',
  page: 'armors',
  category: 'Helm',
  itemLevel: 1,
  reqLevel: 1,
  properties: [],
  isAncientCoupon: false,
  gambleItem: '',
  notes: '',
  ...fields,
});
const mythical = (name: string, id: number, properties: string[] = []): MythicalUnique => ({
  id,
  name,
  baseItem: 'Hand Axe',
  baseItemLink: '',
  category: 'Mythical Unique Weapons',
  itemLevel: 1,
  reqLevel: 1,
  properties,
  specialProperties: [],
  notes: [],
  imageUrl: '',
});
const runeword = (fields: Partial<Runeword>): Runeword => ({
  name: 'Stealth',
  variant: 1,
  sockets: 2,
  reqLevel: 1,
  sortKey: 1,
  isLod: false,
  runes: ['I Rune'],
  gems: [],
  ingredients: ['I Rune'],
  allowedItems: ['Weapon'],
  excludedItems: [],
  affixes: [],
  columnAffixes: noSnapshotColumns,
  tierPointTotals: [],
  ...fields,
});
const gemword = (fields: Partial<Gemword>): Gemword => ({
  name: 'Gemmy',
  variant: 1,
  sockets: 1,
  reqLevel: 1,
  sortKey: 1,
  gems: ['Chipped Amethyst'],
  ingredients: ['Chipped Amethyst'],
  allowedItems: ['Axe'],
  affixes: [],
  columnAffixes: noSnapshotColumns,
  ...fields,
});

const SETS: SetsBundle = {
  sets: [
    {
      id: "Civerb's Vestments",
      name: "Civerb's Vestments",
      items: [{ name: "Civerb's Ward", baseName: 'Cap', code: 'cap', category: 'Helm', reqLevel: 1, lines: [], partial: [] }],
    },
  ],
} as unknown as SetsBundle;

const TXT: TxtRunewordsBundle = {
  runewords: [
    { key: 'Runeword1', name: 'Stealth', rows: [{ ingredients: ['r01'], sockets: 2, jewels: 1, itypes: [], etypes: [] }] },
    { key: 'Runeword2', name: 'Gemmy', rows: [{ ingredients: ['Chipped Amethyst'], sockets: 1, jewels: 0, itypes: [], etypes: [] }] },
    { key: 'Runeword3', name: 'Tied', rows: [{ ingredients: ['r01'], sockets: 2, jewels: 0, itypes: [], etypes: [] }] },
  ],
} as unknown as TxtRunewordsBundle;

const data = (overrides: Partial<BuildDraftData> = {}): BuildDraftData => ({
  catalog,
  text,
  sets: SETS,
  txtRunewords: TXT,
  typeNames: new Map(TYPE_ROWS.map((type) => [type.code, type.name])),
  uniques: [unique({}), unique({ id: 2, name: "Death's Grip", baseItem: 'Sepulcher Gloves', baseItemCode: 'ymg', category: 'Gloves' })],
  mythicals: [],
  runewords: [runeword({})],
  gemwords: [gemword({})],
  ascendancies: ['Blademaster'],
  skillIds: ['Attack', 'Frenzy', 'Whirlwind'],
  skillNames: new Map([
    [0, 'Attack'],
    [1, 'Frenzy'],
    [2, 'Whirlwind'],
    [3, 'Teleport'],
  ]),
  ...overrides,
});

const equipped = (slot: EquipSlot, weaponSet: WeaponSetNumber | null = null): ItemLocation => ({
  kind: 'equipped',
  slot,
  weaponSet,
  rawBody: 0,
});
const charmSlot: ItemLocation = { kind: 'charm', x: 0, y: 0 };
const inventory: ItemLocation = { kind: 'inventory', x: 0, y: 0 };

function character(code: string, location: ItemLocation, fields: Partial<StashItem> = {}, socketed: CharacterItem[] = []): CharacterItem {
  return { ...makeItem(code, fields), location, socketed } as CharacterItem;
}
const child = (code: string, fields: Partial<StashItem> = {}) => character(code, { kind: 'socketed', socket: 0 }, fields);

const binding = (skillId: number | null): SkillBinding => ({ skillId, leftHand: false, raw: 0 });

function save(items: CharacterItem[], merc: CharacterItem[] = [], fields: Partial<CharacterFile> = {}): CharacterFile {
  return {
    name: 'Tester',
    classId: 4,
    className: 'Barbarian',
    level: 50,
    lastSavedAt: 1000,
    skills: [],
    hotkeys: [],
    handSkills: { left: binding(null), right: binding(null), swapLeft: binding(null), swapRight: binding(null) },
    items: { player: items, corpses: [], merc, golem: null },
    gear: equippedGear(items),
    mercGear: equippedGear(merc),
    incomplete: null,
    ...fields,
  } as unknown as CharacterFile;
}

const variantOf = (file: CharacterFile, overrides?: Partial<BuildDraftData>) =>
  createBuildDraft(file, data(overrides), 'x.d2s').values.variants[0];

describe('createBuildDraft: identity', () => {
  it('fills class, level, name and hard skill points, dropping zero points', () => {
    const draft = createBuildDraft(
      save([], [], {
        skills: [
          { skillId: 1, points: 20 },
          { skillId: 2, points: 0 },
        ],
      }),
      data(),
      'x.d2s'
    );
    expect(draft.values.name).toBe('Tester');
    expect(draft.values.characterClass).toBe('Barbarian');
    expect(draft.values.variants[0].level).toBe(50);
    expect(draft.values.variants[0].skillPoints).toEqual({ Frenzy: 20 });
  });
});

describe('createBuildDraft: item bridge', () => {
  it('branches on quality first: a set item whose id equals a unique id stays a set item', () => {
    const item = character('cap', equipped('head'), { quality: 'set', setId: 5, uniqueId: null });
    const ref = variantOf(save([item])).items?.helmet as SetItemRef;
    expect(ref.type).toBe('set');
    expect(ref.name).toBe("Civerb's Ward");
  });

  it('matches a unique by name and row code, never storing the save id', () => {
    const item = character('cap', equipped('head'), { quality: 'unique', uniqueId: 5 });
    const ref = variantOf(save([item])).items?.helmet as UniqueItemRef;
    expect(ref.snapshot.name).toBe('Peasant Crown');
    expect(ref.id).toBe(1);
  });

  it('keeps a converted unique in the slot it is really in, with a note and a check row', () => {
    const belt = character('bmb', equipped('belt'), { quality: 'unique', uniqueId: 554 });
    const draft = createBuildDraft(save([belt]), data(), 'x.d2s');
    const variant = draft.values.variants[0];
    expect((variant.items?.belt as UniqueItemRef).snapshot.name).toBe("Death's Grip");
    expect(variant.items?.gloves).toBeUndefined();
    expect(variant.itemNotes?.belt).toBe('On Merchant Belt');
    expect(draft.report.rows).toMatchObject([
      { slot: 'belt', severity: 'check', base: 'Merchant Belt', message: 'Listed as Sepulcher Gloves; in game on a Merchant Belt' },
    ]);
    expect(draft.report.matched).toBe(1);
  });

  it('turns an equipped quest item (null unique id) into a custom item and ignores stored ones', () => {
    const staff = character('hst', equipped('rightHand', 1), { quality: 'unique', uniqueId: null });
    const stored = character('hst', inventory, { quality: 'unique', uniqueId: null });
    const draft = createBuildDraft(save([staff, stored]), data(), 'x.d2s');
    expect(draft.values.variants[0].items?.weapon).toEqual({ type: 'freetext', name: 'Horadric Staff' });
    expect(draft.report.items).toEqual([{ section: 'player', slot: 'weapon', kind: 'quest', outcome: 'custom' }]);
    expect(draft.report.rows[0]).toMatchObject({ severity: 'fix', kindLabel: 'Quest item' });
  });

  it('labels rare and crafted custom items with what they are, not magic ones', () => {
    const rare = character('rin', equipped('rightRing'), { quality: 'rare', rareNameIds: [1, 2] });
    const crafted = character('rin', equipped('leftRing'), { quality: 'crafted', rareNameIds: [1, 2] });
    const magic = character('rin', equipped('neck'), { quality: 'magic', prefixIds: [1], suffixIds: [0] });
    const variant = variantOf(save([rare, crafted, magic]));
    expect(variant.items?.ring1).toEqual({ type: 'freetext', name: 'Havoc Finger (Ring)' });
    expect(variant.items?.ring2).toEqual({ type: 'freetext', name: 'Havoc Finger (Ring)' });
    expect(variant.items?.amulet).toEqual({ type: 'freetext', name: 'Shimmering Ring' });
  });

  it('keeps all socket fillers on a unique', () => {
    const item = character('cap', equipped('head'), { quality: 'unique', uniqueId: 5 }, [
      child('r01', { compact: true, quality: null }),
      child('jew', { quality: 'magic', prefixIds: [1], suffixIds: [0] }),
    ]);
    expect((variantOf(save([item])).items?.helmet as UniqueItemRef).socketed).toEqual(['I Rune', 'Shimmering Jewel']);
  });

  it('flags a same-name mythical variant for review, stripping the HTM variant suffix', () => {
    const item = character('hax', equipped('rightHand', 1), { quality: 'unique', uniqueId: 600 });
    const mythicals = [mythical("Tathamet's Awakening (Fire Variant)", 1), mythical("Tathamet's Awakening (Cold Variant)", 2)];
    const draft = createBuildDraft(save([item]), data({ mythicals }), 'x.d2s');
    expect((draft.values.variants[0].items?.weapon as MythicalItemRef).type).toBe('mythical');
    expect(draft.report.items[0]).toMatchObject({ kind: 'mythical', outcome: 'check' });
    expect(draft.report.rows[0]?.message).toContain('Check this is the right one');
  });

  it('leaves a unique without a catalogue row on the fix list by its name', () => {
    const item = character('hax', equipped('rightHand', 1), { quality: 'unique', uniqueId: 701 });
    const draft = createBuildDraft(save([item]), data(), 'x.d2s');
    expect(draft.values.variants[0].items?.weapon).toEqual({ type: 'freetext', name: 'Twin Blade' });
    expect(draft.report.items[0]).toMatchObject({ kind: 'unique', outcome: 'custom' });
  });
});

describe('createBuildDraft: runewords and gemwords', () => {
  it('keeps the real base and only the jewels as socket fillers', () => {
    const item = character('hax', equipped('rightHand', 1), { runewordId: 100, sockets: 2 }, [
      child('r01', { compact: true, quality: null }),
      child('jew', { quality: 'magic', prefixIds: [1], suffixIds: [0] }),
    ]);
    const ref = variantOf(save([item])).items?.weapon as RunewordItemRef;
    expect(ref.type).toBe('runeword');
    expect(ref.base).toEqual({ code: 'hax', name: 'Hand Axe' });
    expect(ref.socketed).toEqual(['Shimmering Jewel']);
  });

  it('narrows variants by the socket count', () => {
    const item = character('hax', equipped('rightHand', 1), { runewordId: 100, sockets: 3 });
    const runewords = [runeword({ variant: 1, sockets: 2 }), runeword({ variant: 2, sockets: 3 })];
    const ref = variantOf(save([item]), { runewords }).items?.weapon as RunewordItemRef;
    expect(ref.variant).toBe(2);
  });

  it('flags a tie the socket count cannot break', () => {
    const item = character('hax', equipped('rightHand', 1), { runewordId: 102, sockets: 2 });
    const runewords = [
      runeword({ name: 'Tied', variant: 1, allowedItems: ['Axe'] }),
      runeword({ name: 'Tied', variant: 2, allowedItems: ['Axe'] }),
    ];
    const draft = createBuildDraft(save([item]), data({ runewords }), 'x.d2s');
    expect((draft.values.variants[0].items?.weapon as RunewordItemRef).variant).toBe(1);
    expect(draft.report.items[0]).toMatchObject({ kind: 'runeword', outcome: 'check' });
  });

  it('picks a gemword by its gems, slot and the item type, without socket fillers', () => {
    const item = character('hax', equipped('rightHand', 1), { runewordId: 101, sockets: 1 }, [
      child('gcv', { compact: true, quality: null }),
    ]);
    const gemwords = [
      gemword({ variant: 1, gems: ['Chipped Sapphire'], allowedItems: ['Axe'] }),
      gemword({ variant: 2, allowedItems: ['Helm'] }),
      gemword({ variant: 3, allowedItems: ['Axe'] }),
    ];
    const draft = createBuildDraft(save([item]), data({ gemwords }), 'x.d2s');
    const ref = draft.values.variants[0].items?.weapon as GemwordItemRef;
    expect(ref.type).toBe('gemword');
    expect(ref.variant).toBe(3);
    expect(draft.report.items[0]).toMatchObject({ kind: 'gemword', outcome: 'matched' });
  });
});

describe('createBuildDraft: sections', () => {
  it('puts weapon set II in the swap slots and includes the mercenary', () => {
    const main = character('cap', equipped('head'), { quality: 'unique', uniqueId: 5 });
    const swap = character('hax', equipped('rightHand', 2), { quality: 'rare', rareNameIds: [1, 2] });
    const merc = character('cap', equipped('head'), { quality: 'unique', uniqueId: 5 });
    const variant = variantOf(save([main, swap], [merc]));
    expect(variant.weaponSwap?.weapon2).toEqual({ type: 'freetext', name: 'Havoc Finger (Hand Axe)' });
    expect((variant.mercenary?.helmet as UniqueItemRef).snapshot.name).toBe('Peasant Crown');
    expect(variant.items?.weapon).toBeUndefined();
  });
});

describe('createBuildDraft: charm inventory', () => {
  const vita = (location: ItemLocation) => character('cm3', location, { quality: 'magic', prefixIds: [0], suffixIds: [1] });

  it('merges identical names and leaves single charms bare', () => {
    const single = character('cm3', charmSlot, { quality: 'magic', prefixIds: [1], suffixIds: [0] });
    expect(variantOf(save([vita(charmSlot), vita(charmSlot), single])).charms).toEqual([
      '2x Grand Charm of Vita',
      'Shimmering Grand Charm',
    ]);
  });

  it('skips the Kill Ledger and charms outside the charm inventory', () => {
    const ledger = character('led', charmSlot, { quality: 'unique', uniqueId: 700 });
    expect(variantOf(save([ledger, vita(inventory)])).charms).toBeUndefined();
  });

  it('reads the ascendancy from a stone in the charm inventory, not as a charm', () => {
    const stone = character('ast', charmSlot, { quality: 'unique', uniqueId: 700 });
    const variant = variantOf(save([stone]));
    expect(variant.ascendancy).toBe('Blademaster');
    expect(variant.charms).toBeUndefined();
  });

  it('takes a stone held elsewhere too (the game converts a held stone on login since ESR 3.3.04)', () => {
    const stone = character('ast', inventory, { quality: 'unique', uniqueId: 700 });
    expect(variantOf(save([stone])).ascendancy).toBe('Blademaster');
  });
});

describe('skillsInUseLine', () => {
  const names = new Map([
    [1, 'Frenzy'],
    [2, 'Whirlwind'],
    [3, 'Teleport'],
    [4, 'Shout'],
  ]);
  const hands = (left: number | null, right: number | null, swapLeft = left, swapRight = right) => ({
    left: binding(left),
    right: binding(right),
    swapLeft: binding(swapLeft),
    swapRight: binding(swapRight),
  });

  it('keeps hands and hotkeys, drops Attack and duplicates, keeps item-granted skills', () => {
    const line = skillsInUseLine(
      { handSkills: hands(1, 2), hotkeys: [binding(1), binding(4), binding(3), binding(3), binding(0), binding(null)] },
      names
    );
    expect(line).toBe('Left: Frenzy · Right: Whirlwind. Hotkeys: Shout, Teleport.');
  });

  it('adds the swap pair only when it differs', () => {
    expect(skillsInUseLine({ handSkills: hands(1, 2, 4, 3), hotkeys: [] }, names)).toBe(
      'Left: Frenzy · Right: Whirlwind · Swap left: Shout · Swap right: Teleport.'
    );
  });

  it('is blank for an unused character', () => {
    expect(skillsInUseLine({ handSkills: hands(0, 0), hotkeys: [binding(0)] }, names)).toBe('');
  });
});

describe('createBuildDraft: report', () => {
  it('counts matched and custom items', () => {
    const named = character('cap', equipped('head'), { quality: 'unique', uniqueId: 5 });
    const rare = character('rin', equipped('rightRing'), { quality: 'rare', rareNameIds: [1, 2] });
    const { report } = createBuildDraft(save([named, rare]), data(), 'x.d2s');
    expect(report.matched).toBe(1);
    expect(report.total).toBe(2);
    expect(report.rows).toHaveLength(1);
  });

  it('names what stayed empty when the walk stopped early', () => {
    const incomplete = { section: 'merc-items' as const, message: 'x', unverified: 'corpse' as const };
    expect(createBuildDraft(save([], [], { incomplete }), data(), 'x.d2s').report.incompleteNote).toContain('mercenary gear');
    const later = { section: 'bound-demon' as const, message: 'x', unverified: 'bound-demon' as const };
    expect(createBuildDraft(save([], [], { incomplete: later }), data(), 'x.d2s').report.incompleteNote).toContain('nothing in this draft');
  });

  it('carries the verified .d2rl version of a save handed over by My Character, null without one', () => {
    expect(createBuildDraft(save([]), data(), 'x.d2s').report.sidecarVersion).toBeNull();
    expect(createBuildDraft(save([]), data(), 'x.d2s', '3.3.02').report.sidecarVersion).toBe('3.3.02');
  });
});

describe('save upload', () => {
  it('rejects anything but a .d2s', () => {
    expect(checkSaveUpload('stash.d2i', 100)?.title).toBe('Not a character save');
    expect(checkSaveUpload('Hero.d2s', 100)).toBeNull();
    expect(checkSaveUpload('Hero.d2s', 100 * 1024 * 1024)?.title).toBe('Not a character save');
  });

  it('turns a parse failure into an error, not a throw', () => {
    const result = draftFromSaveBytes(new Uint8Array(32), 'bad.d2s', BUNDLE, data());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.title).toBe('Could not read this save');
  });
});
