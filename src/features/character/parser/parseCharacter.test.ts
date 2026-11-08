import { describe, expect, it } from 'vitest';
import { ITEM_FLAG } from '../../stash/parser/parseItem.ts';
import type { TestItem } from '../../stash/parser/testItems.ts';
import { CharacterParseError } from './errors.ts';
import { parseCharacter } from './parseCharacter.ts';
import { buildSave, indexOfMarker, testData, withChecksum } from './testCharacter.ts';

function parseError(bytes: Uint8Array): CharacterParseError {
  try {
    parseCharacter(bytes, testData);
  } catch (error) {
    if (error instanceof CharacterParseError) return error;
    throw error;
  }
  throw new Error('expected a CharacterParseError');
}

describe('parseCharacter', () => {
  it('reads the header fields, attributes and skills', () => {
    const character = parseCharacter(
      buildSave({
        classId: 2,
        level: 77,
        name: 'Wawa',
        lastSavedAt: 1_794_169_893,
        stats: [
          { id: 0, value: 80 },
          { id: 6, value: 1000 * 256 },
          { id: 926, value: 3 },
        ],
        skills: [5, 1],
        hotkeys: [0x246, 0x81a2],
        handSkills: [574, 590, 574, 591],
      }),
      testData
    );
    expect(character).toMatchObject({
      name: 'Wawa',
      classId: 2,
      className: 'Warlock',
      level: 77,
      lastSavedAt: 1_794_169_893,
      activeWeapon: 0,
      gameVersion: 3,
    });
    expect(character.attributes).toEqual([
      { id: 0, raw: 80, value: 80 },
      { id: 6, raw: 256_000, value: 1000 },
      { id: 926, raw: 3, value: 3 },
    ]);
    expect(character.baseAttributes.strength).toBe(80);
    expect(character.baseAttributes.life).toBe(1000);
    expect(character.baseAttributes.gold).toBe(0);
    expect(character.skills).toEqual([
      { skillId: 663, points: 5 },
      { skillId: 664, points: 1 },
    ]);
    expect(character.hotkeys[0]).toEqual({ raw: 0x246, skillId: 0x246, leftHand: false });
    expect(character.hotkeys[1]).toEqual({ raw: 0x81a2, skillId: 0x1a2, leftHand: true });
    expect(character.hotkeys[2]).toEqual({ raw: 0xffff, skillId: null, leftHand: true });
    expect(character.handSkills.swapRight.skillId).toBe(591);
    expect(character.mercenary).toBeNull();
  });

  it('reads the mercenary header when one was hired', () => {
    const character = parseCharacter(buildSave({ mercSeed: 42, mercFlags: 0x10000, merc: [] }), testData);
    expect(character.mercenary).toEqual({ flags: 0x10000, dead: true, seed: 42, nameIndex: 7, typeId: 24, experience: 12345 });
  });

  it('walks every section up to the end of the file', () => {
    const bytes = buildSave({
      player: [{ code: 'hax', mode: 1, body: 4, quality: 2 }],
      merc: [{ code: 'xlm', mode: 1, body: 3, quality: 2 }],
      summons: [{ skill: 440, monster: 357 }],
    });
    const character = parseCharacter(bytes, testData);
    expect(character.sections.map((section) => section.name)).toEqual([
      'header',
      'quests',
      'waypoints',
      'npc',
      'attributes',
      'skills',
      'player-items',
      'corpses',
      'merc-items',
      'golem',
      'bound-demon',
      'summons',
    ]);
    character.sections.forEach((section, i) => {
      expect(section.start).toBe(i === 0 ? 0 : character.sections[i - 1]?.end);
    });
    expect(character.sections.at(-1)?.end).toBe(bytes.length);
    expect(character.summons).toEqual([{ skillId: 440, monsterId: 357 }]);
    expect(character.items.merc).toHaveLength(1);
  });

  it('reads a corpse and a golem item when present', () => {
    const character = parseCharacter(
      buildSave({
        corpses: [{ header: 7, items: [{ code: 'hax', mode: 1, body: 4, quality: 2 }] }],
        golem: { code: 'hax', quality: 2 },
      }),
      testData
    );
    expect(character.items.corpses).toHaveLength(1);
    expect(character.items.corpses[0]?.headerBytes).toEqual(new Uint8Array(12).fill(7));
    expect(character.items.corpses[0]?.items[0]?.code).toBe('hax');
    expect(character.items.golem?.code).toBe('hax');
  });

  it('turns the quest item unique sentinel into no unique', () => {
    const character = parseCharacter(buildSave({ player: [{ code: 'hdm', quality: 7, fileIndex: 65535, store: 1 }] }), testData);
    expect(character.items.player[0]).toMatchObject({ code: 'hdm', quality: 'unique', uniqueId: null });
  });

  it('keeps a real unique id', () => {
    const character = parseCharacter(buildSave({ player: [{ code: 'hdm', quality: 7, fileIndex: 215, store: 1 }] }), testData);
    expect(character.items.player[0]?.uniqueId).toBe(215);
  });

  it('nests socketed children and gives them a socket location', () => {
    const character = parseCharacter(
      buildSave({ player: [{ code: 'hax', mode: 1, body: 4, quality: 2, sockets: 2, socketed: [{ code: 'jew', x: 1 }] }] }),
      testData
    );
    const parent = character.items.player[0];
    expect(parent?.location).toMatchObject({ kind: 'equipped', slot: 'rightHand', weaponSet: 1, rawBody: 4 });
    expect(parent?.socketed[0]?.location).toEqual({ kind: 'socketed', socket: 1 });
  });
});

describe('weapon-swap normalisation in the file', () => {
  const items = [
    { code: 'hax', mode: 1, body: 4, quality: 2 },
    { code: 'xlm', mode: 1, body: 11, quality: 2 },
  ];

  it('active weapon 0: body 4 is set I and body 11 is set II', () => {
    const { gear } = parseCharacter(buildSave({ player: items }), testData);
    expect(gear.weaponSets[0].rightHand?.code).toBe('hax');
    expect(gear.weaponSets[1].rightHand?.code).toBe('xlm');
  });

  it('active weapon 1: body 4 is set II and body 11 is set I, raw body kept', () => {
    const { gear } = parseCharacter(buildSave({ activeWeapon: 1, player: items }), testData);
    expect(gear.weaponSets[0].rightHand?.code).toBe('xlm');
    expect(gear.weaponSets[0].rightHand?.location).toMatchObject({ weaponSet: 1, rawBody: 11 });
    expect(gear.weaponSets[1].rightHand?.code).toBe('hax');
    expect(gear.weaponSets[1].rightHand?.location).toMatchObject({ weaponSet: 2, rawBody: 4 });
  });

  it('the mercenary keeps body 4 as its weapon, whatever the player has active', () => {
    const { mercGear } = parseCharacter(buildSave({ activeWeapon: 1, merc: [{ code: 'hax', mode: 1, body: 4, quality: 2 }] }), testData);
    expect(mercGear.weaponSets[0].rightHand?.code).toBe('hax');
  });
});

const gearOnPlayer: TestItem[] = [
  { code: 'hax', mode: 1, body: 4, quality: 2 },
  { code: 'xlm', mode: 1, body: 3, quality: 2 },
];

function sectionStart(bytes: Uint8Array, name: string): number {
  const start = parseCharacter(bytes, testData).sections.find((section) => section.name === name)?.start;
  if (start === undefined) throw new Error(`no section ${name}`);
  return start;
}

describe('a failure in a never-seen part after the player items', () => {
  const mercGear: TestItem[] = [{ code: 'xlm', mode: 1, body: 3, quality: 2 }];

  it('a bound demon keeps the player and merc gear and names the block', () => {
    const character = parseCharacter(
      buildSave({ player: gearOnPlayer, mercSeed: 42, merc: mercGear, demonFlag: 1, trailing: [9, 9, 9] }),
      testData
    );
    expect(character.incomplete).toMatchObject({ section: 'bound-demon', unverified: 'bound-demon' });
    expect(character.gear.weaponSets[0].rightHand?.code).toBe('hax');
    expect(character.gear.torso?.code).toBe('xlm');
    expect(character.mercGear.torso?.code).toBe('xlm');
    expect(character.items.golem).toBeNull();
    expect(character.summons).toEqual([]);
  });

  it('a corpse failure keeps the player gear, names the corpse and leaves the merc empty', () => {
    const bytes = buildSave({ player: gearOnPlayer, corpses: [{ items: [{ code: 'hax', quality: 2 }] }], merc: mercGear });
    bytes[sectionStart(bytes, 'corpses') + 4 + 12] = 0; // the corpse's own JM
    const character = parseCharacter(withChecksum(bytes), testData);
    expect(character.incomplete).toMatchObject({ section: 'corpses', unverified: 'corpse' });
    expect(character.gear.torso?.code).toBe('xlm');
    expect(character.items.corpses).toEqual([]);
    expect(character.items.merc).toEqual([]);
    expect(character.mercGear.torso).toBeNull();
  });

  it('a truncation inside a corpse counts as the corpse, not as a hard error', () => {
    const bytes = buildSave({ player: gearOnPlayer, corpses: [{ items: [] }] });
    const cut = bytes.slice(0, sectionStart(bytes, 'corpses') + 4 + 6);
    new DataView(cut.buffer).setUint32(8, cut.length, true);
    const character = parseCharacter(withChecksum(cut), testData);
    expect(character.incomplete).toMatchObject({ section: 'corpses', unverified: 'corpse' });
    expect(character.gear.torso?.code).toBe('xlm');
  });

  it('a golem failure keeps the merc gear and names the golem', () => {
    const bytes = buildSave({ player: gearOnPlayer, merc: mercGear, golem: { code: 'hax', quality: 2 } });
    const at = sectionStart(bytes, 'golem') + 3;
    bytes[at + 8] = 0xff;
    bytes[at + 9] = 0xff;
    const character = parseCharacter(withChecksum(bytes), testData);
    expect(character.incomplete).toMatchObject({ section: 'golem', unverified: 'golem' });
    expect(character.items.golem).toBeNull();
    expect(character.mercGear.torso?.code).toBe('xlm');
  });

  it('an ear in the merc list stops the walk, the player gear is kept', () => {
    const character = parseCharacter(
      buildSave({ player: gearOnPlayer, merc: [{ code: 'hax', quality: 2, extraFlags: ITEM_FLAG.ear }] }),
      testData
    );
    expect(character.incomplete).toMatchObject({ section: 'merc-items', unverified: 'ear' });
    expect(character.items.merc).toEqual([]);
    expect(character.gear.torso?.code).toBe('xlm');
  });

  it('a full parse has no incomplete marker', () => {
    expect(parseCharacter(buildSave({ player: gearOnPlayer }), testData).incomplete).toBeNull();
  });
});

describe('parseCharacter errors', () => {
  const clean = () => buildSave({ stats: [{ id: 0, value: 10 }] });

  it('rejects a file that is not a save', () => {
    const error = parseError(new Uint8Array([1, 2, 3, 4]));
    expect(error.reason).toBe('bad-magic');
    expect(error.details).toMatchObject({ section: 'header', byteOffset: 0 });
  });

  it('rejects another save format revision', () => {
    const bytes = clean();
    new DataView(bytes.buffer).setUint32(4, 0x69, true);
    expect(parseError(withChecksum(bytes)).reason).toBe('unsupported-version');
  });

  it('reports a checksum mismatch', () => {
    const bytes = clean();
    bytes[0x20] = (bytes[0x20] ?? 0) ^ 0xff;
    expect(parseError(bytes)).toMatchObject({ reason: 'checksum-mismatch', details: { section: 'header', byteOffset: 12 } });
  });

  it('reports a wrong declared size', () => {
    const bytes = clean();
    new DataView(bytes.buffer).setUint32(8, bytes.length + 1, true);
    expect(parseError(withChecksum(bytes)).reason).toBe('size-mismatch');
  });

  it('names the section that does not end on its boundary', () => {
    const bytes = clean();
    const at = indexOfMarker(bytes, 'if');
    bytes[at] = 0;
    const error = parseError(withChecksum(bytes));
    expect(error).toMatchObject({ reason: 'section-boundary', details: { section: 'attributes', byteOffset: at } });
  });

  it('names an unknown stat id with its bit offset', () => {
    const bytes = buildSave({ stats: [{ id: 300, value: 1 }] });
    const error = parseError(bytes);
    expect(error.reason).toBe('unknown-stat');
    expect(error.details.section).toBe('attributes');
    expect(error.message).toContain('stat 300');
    expect(error.details.bitOffset).toBeGreaterThan(0);
  });

  it('reports trailing bytes after the last section', () => {
    expect(parseError(buildSave({ trailing: [1, 2, 3] }))).toMatchObject({ reason: 'trailing-bytes' });
  });

  it('reports an unknown class', () => {
    expect(parseError(buildSave({ classId: 9 })).reason).toBe('unknown-class');
  });

  it('reports a skill count the game data does not expect', () => {
    expect(parseError(buildSave({ skills: [1, 2, 3] })).reason).toBe('skill-count-mismatch');
  });

  it('rejects an active weapon other than 0 or 1', () => {
    expect(parseError(buildSave({ activeWeapon: 2 })).reason).toBe('invalid-value');
  });

  it('wraps an item failure with the section and the item', () => {
    const bytes = buildSave({ player: [{ code: 'hax', quality: 2 }] });
    const at = indexOfMarker(bytes, 'JM') + 4;
    // Corrupt the code bits (starting at bit 32+11+15+3 of the item) so the item code is unknown
    bytes[at + 8] = 0xff;
    bytes[at + 9] = 0xff;
    const error = parseError(withChecksum(bytes));
    expect(error.reason).toBe('item');
    expect(error.details).toMatchObject({ section: 'player-items', item: 0, path: 'item 0' });
  });

  it('still throws on a failure after the player list that is not in a never-seen part', () => {
    const bytes = buildSave({ player: gearOnPlayer });
    const jf = sectionStart(bytes, 'merc-items');
    bytes[jf] = 0;
    const error = parseError(withChecksum(bytes));
    expect(error).toMatchObject({ reason: 'section-boundary', details: { section: 'corpses', unverified: null } });
  });

  it('names ears when an ear item fails or leaves its list off the boundary', () => {
    const error = parseError(buildSave({ player: [{ code: 'hax', quality: 2, extraFlags: ITEM_FLAG.ear }] }));
    expect(error.details.unverified).toBe('ear');
    expect(error.details.section).toBe('player-items');
  });

  it('reports a truncated file with the section it stopped in', () => {
    const bytes = buildSave();
    const truncated = bytes.slice(0, 0x1a0);
    const view = new DataView(truncated.buffer);
    view.setUint32(8, truncated.length, true);
    expect(parseError(withChecksum(truncated))).toMatchObject({ reason: 'truncated', details: { section: 'quests' } });
  });
});
