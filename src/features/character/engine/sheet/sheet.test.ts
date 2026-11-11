import { describe, expect, it } from 'vitest';
import { computeCharacterSheet } from './sheet';
import { toStatsSnapshot } from './snapshot';
import {
  charmAt,
  equipped,
  exactPool,
  inventoryAt,
  item,
  setItemIds,
  sheetData as data,
  socketedIn,
  testCharacter,
  charSheetBundle,
} from './testSheet.mock';

const BARBARIAN = 4;
const AMAZON = 0;
const L = 256;

describe('computeCharacterSheet: attributes', () => {
  it('multiplies base + flat by the attribute %, then adds the per-level amount unmultiplied', () => {
    const character = testCharacter({
      level: 80,
      attributes: { strength: 100 },
      items: [
        item('cap', equipped('head'), [
          ['strength', 50],
          ['strengthpercent', 10],
          ['item_strength_perlevel', 8],
        ]),
      ],
    });
    const { strength } = computeCharacterSheet(character, data).attributes;
    // (100 + 50) × 1.1 = 165, + 8 × 80 / 8 = 80
    expect(strength.value).toBe(245);
    expect(strength.base).toBe(100);
    expect(strength.sources.map((source) => [source.kind, source.value])).toEqual([
      ['base', 100],
      ['item', 50],
      ['per-level', 80],
      ['percent', 15],
    ]);
  });
});

describe('computeCharacterSheet: life, mana, stamina', () => {
  it('multiplies gf + flat life by life %, adds vitality above base unmultiplied (Barbarian: 1 life per point)', () => {
    const character = testCharacter({
      attributes: { vitality: 100, maxhp: 500 * L },
      items: [
        item('cap', equipped('head'), [
          ['maxhp', 100],
          ['item_maxhp_percent', 20],
          ['vitality', 10],
        ]),
      ],
    });
    const { life } = computeCharacterSheet(character, data);
    expect(life.value).toBe(600 * 1.2 + 10);
    expect(life.sources.find((source) => source.kind === 'attribute')).toEqual({
      kind: 'attribute',
      label: 'Vitality above base',
      value: 10,
    });
  });

  it('truncates the % of the pool and the % of its per-level amount apart (op 11 names both)', () => {
    // level 9: 3 mana per 8 levels → 3 × 9 / 8 = 3.375 mana = 864; base 101 mana = 25856
    const character = testCharacter({
      level: 9,
      attributes: { maxmana: 101 * L },
      items: [
        item('cap', equipped('head'), [
          ['item_mana_perlevel', 3],
          ['item_maxmana_percent', 11],
        ]),
      ],
    });
    const { mana } = computeCharacterSheet(character, data);
    // trunc(25856 × 0.11) = 2844 (.16), trunc(864 × 0.11) = 95 (.04); one truncation of the sum would give the same here,
    // so check the parts: the % source is their sum
    expect(exactPool(mana)).toBe(25856 + 864 + 2844 + 95);
    const split = testCharacter({
      level: 9,
      attributes: { maxmana: 109 * L },
      items: [
        item('cap', equipped('head'), [
          ['item_mana_perlevel', 6],
          ['item_maxmana_percent', 71],
        ]),
      ],
    });
    // 27904 × 0.71 = 19811.84 → 19811; 6 × 256 × 9 / 8 = 1728 → 1226.88 → 1226; pooled would be 21038 (one more)
    expect(exactPool(computeCharacterSheet(split, data).mana)).toBe(27904 + 1728 + 19811 + 1226);
  });

  it('counts the Kill Ledger aura (row 852) maxhp term, which turns soft-vitality life into flat life', () => {
    const plain = testCharacter({
      attributes: { vitality: 100, maxhp: 500 * L },
      items: [
        item('cap', equipped('head'), [
          ['vitality', 100],
          ['item_maxhp_percent', 50],
        ]),
      ],
    });
    const ledger = testCharacter({
      attributes: { vitality: 100, maxhp: 500 * L },
      items: [
        item('cap', equipped('head'), [
          ['vitality', 100],
          ['item_maxhp_percent', 50],
        ]),
        item('cm1', charmAt(0, 0), [['item_aura', 852, 1]]),
      ],
    });
    const without = computeCharacterSheet(plain, data).life;
    const withAura = computeCharacterSheet(ledger, data).life;
    // clc2 = vitality above base = 100; 100 × 50 / 150 = 33 (integer) × 128 = 4224 (16.5 life), × 1.5
    expect(exactPool(withAura) - exactPool(without)).toBe(4224 + Math.trunc((4224 * 50) / 100));
    expect(withAura.sources.some((source) => source.kind === 'item-aura' && source.skill === 852)).toBe(true);
  });

  it('adds stamina from vitality above base with charstats StaminaPerVitality', () => {
    const character = testCharacter({
      attributes: { vitality: 50, maxstamina: 100 * L },
      items: [item('cap', equipped('head'), [['vitality', 20]])],
    });
    const per = charSheetBundle.classes[BARBARIAN]?.staminaPerVitality ?? 0;
    expect(computeCharacterSheet(character, data).stamina.value).toBe(100 + (20 * per) / 4);
  });
});

describe('computeCharacterSheet: which items count', () => {
  it('counts only the active weapon set', () => {
    const character = testCharacter({
      items: [
        item('hax', equipped('rightHand', 1), [['item_fastercastrate', 10]]),
        item('hax', equipped('rightHand', 2), [['item_fastercastrate', 20]]),
      ],
    });
    expect(computeCharacterSheet(character, data).speed.cast.value).toBe(10);
    expect(computeCharacterSheet({ ...character, activeWeapon: 1 }, data).speed.cast.value).toBe(20);
  });

  it('counts charms in the Charm Inventory only, and one charm per dedup group', () => {
    const character = testCharacter({
      items: [
        item('cm1', charmAt(0, 0), [['item_magicbonus', 5]]),
        item('cm1', inventoryAt(0, 0), [['item_magicbonus', 7]]),
        item('c11', charmAt(1, 0), [['item_magicbonus', 11]]),
        item('c12', charmAt(2, 0), [['item_magicbonus', 13]]),
      ],
    });
    const sheet = computeCharacterSheet(character, data);
    expect(sheet.find.magic.value).toBe(5 + 11);
    expect(sheet.warnings.some((warning) => warning.includes('c12') && warning.includes('inactive'))).toBe(true);
  });

  it('gives a socket filler its column for the host (runes in a helm: helm column) and a jewel its own stats', () => {
    const rune = item('r01', socketedIn);
    const jewel = item('jew', socketedIn, [['item_fastercastrate', 7]]);
    const character = testCharacter({ items: [item('cap', equipped('head'), [], { defense: 10 }, [rune, jewel])] });
    const sheet = computeCharacterSheet(character, data);
    // r01 helm column: +30 defense (armorclass); the jewel: 7 FCR
    expect(sheet.speed.cast.value).toBe(7);
    expect(sheet.defense.sources.find((source) => source.kind === 'item' && source.label === 'head')?.value).toBe(30);
  });

  it('adds sets.txt partial and full bonuses by pieces worn', () => {
    const [sign, wand, flesh] = setItemIds("Arcanna's Tricks-Sor");
    const piece = (code: string, slot: Parameters<typeof equipped>[0], setId: number | undefined) =>
      item(code, equipped(slot, slot === 'rightHand' ? 1 : null), [], { quality: 'set', setId: setId ?? null });
    const two = testCharacter({ classId: 1, items: [piece('amu', 'neck', sign), piece('wnd', 'rightHand', wand)] });
    const three = testCharacter({
      classId: 1,
      items: [piece('amu', 'neck', sign), piece('wnd', 'rightHand', wand), piece('lea', 'torso', flesh)],
    });
    // 2 pieces: +10% life and mana; 3 (full): + 2 sorceress skills, 10 all attributes …
    expect(computeCharacterSheet(two, data).attributes.strength.value).toBe(0);
    const full = computeCharacterSheet(three, data);
    expect(full.attributes.strength.value).toBe(10);
    expect(full.skills.cls.value).toBe(2);
    expect(full.life.sources.some((source) => source.kind === 'set')).toBe(true);
  });

  it('raises socketed runes by Runic Insight: pooled per stat, split back over the hosts', () => {
    const rune = (code: string) => item(code, socketedIn);
    const helm = item('cap', equipped('head'), [], { defense: 100 }, [rune('r01'), rune('r01')]);
    const body = item('lea', equipped('torso'), [], { defense: 100 }, [rune('r01')]);
    const without = computeCharacterSheet(testCharacter({ items: [helm, body] }), data);
    const learned = computeCharacterSheet(testCharacter({ attributes: { archaeology_3: 1 }, items: [helm, body] }), data);
    // r01 helm column: +30 defense each, 90 in all; 5% pooled = 4 (4.5 toward zero), split: helm 3 (of 60), body 1 (of 30)
    const runic = learned.defense.sources.filter((source) => source.kind === 'runic').reduce((sum, source) => sum + source.value, 0);
    expect(runic).toBe(Math.trunc((90 * 5) / 100));
    expect(learned.defense.value - without.defense.value).toBe(runic);
  });

  it('keeps the off-hand weapon’s own attack stats off the sheet when dual wielding', () => {
    const character = testCharacter({
      level: 102,
      attributes: { dexterity: 100 },
      items: [
        item('hax', equipped('rightHand', 1), [
          ['item_fasterattackrate', 20],
          ['tohit', 100],
        ]),
        item('hax', equipped('leftHand', 1), [
          ['item_fasterattackrate', 100],
          ['item_deadlystrike', 25],
          ['item_tohit_perlevel', 42],
        ]),
        item('cm1', charmAt(0, 0), [['item_tohit_perlevel', 26]]),
      ],
      handSkills: { right: 0 },
    });
    const sheet = computeCharacterSheet(character, data);
    expect(sheet.speed.attack.value).toBe(20);
    expect(sheet.offense.deadlyStrike.value).toBe(0);
    expect(sheet.offense.offHand).toMatchObject({ attackSpeed: 100, deadlyStrike: 25 });
    const factor = charSheetBundle.classes[BARBARIAN]?.toHitFactor ?? 0;
    const main = (100 - 7) * 5 + factor + 100 + Math.floor((26 * 102) / 8);
    // the off-hand line pools the per-level to-hit of every list: (26 + 42) × 102 / 8 = 867, not 331 + 535
    const off = (100 - 7) * 5 + factor + 100 + Math.floor((68 * 102) / 8);
    expect(sheet.attackRating.hands[0]).toMatchObject({ mainHand: main, offHand: off });
  });
});

describe('computeCharacterSheet: skills, passives, auras', () => {
  it('adds +all, +class, +tab and +single skills to skills with hard points, oskills to any skill', () => {
    const character = testCharacter({
      skills: { 570: 1, 574: 0 },
      items: [
        item('cap', equipped('head'), [
          ['item_allskills', 2],
          ['item_addclassskills', BARBARIAN, 1],
          ['item_nonclassskill', 582, 3],
          ['item_nonclassskill', 479, 1],
        ]),
      ],
    });
    const levels = computeCharacterSheet(character, data).skills.levels;
    expect(levels.find((skill) => skill.skillId === 570)).toMatchObject({ hard: 1, level: 4, bonus: { all: 2, cls: 1 } });
    expect(levels.find((skill) => skill.skillId === 574)).toBeUndefined();
    expect(levels.find((skill) => skill.skillId === 582)).toMatchObject({ hard: 0, level: 3, bonus: { oskill: 3 } });
    expect(levels.find((skill) => skill.skillId === 479)).toMatchObject({ level: 1 });
  });

  it('gives a passive with a passivestate its stats, and one without none (Wisdom of Athulua)', () => {
    const dodge = computeCharacterSheet(testCharacter({ classId: AMAZON, skills: { 431: 10 } }), data);
    expect(dodge.defenseChances.dodge.value).toBeGreaterThan(0);
    expect(dodge.defenseChances.dodge.sources[0]).toMatchObject({ kind: 'passive', skill: 431 });
    const wisdom = computeCharacterSheet(testCharacter({ classId: AMAZON, attributes: { dexterity: 300 }, skills: { 436: 20 } }), data);
    expect(wisdom.speed.run.value).toBe(0);
  });

  it('lets an item aura reach its wearer, but not an enemy-only one (Conviction, aurafilter 0x8000)', () => {
    const fanaticism = computeCharacterSheet(
      testCharacter({ items: [item('hax', equipped('rightHand', 1), [['item_aura', 554, 20]])] }),
      data
    );
    expect(fanaticism.speed.baseAttack.value).toBeGreaterThan(100);
    const conviction = computeCharacterSheet(
      testCharacter({
        items: [
          item('hax', equipped('rightHand', 1), [
            ['item_aura', 555, 30],
            ['fireresist', 40],
          ]),
        ],
      }),
      data
    );
    expect(conviction.resists.fire.value).toBe(40);
    expect(conviction.defense.sources.every((source) => source.kind !== 'item-aura')).toBe(true);
  });
});

describe('computeCharacterSheet: resists', () => {
  it('adds the difficulty penalty (not to magic), Anya per difficulty read, and caps at 75 + max resist, at most 95', () => {
    const character = testCharacter({
      scrolls: [true, true, false],
      items: [
        item('cap', equipped('head'), [
          ['fireresist', 200],
          ['coldresist', 50],
          ['magicresist', 30],
          ['maxfireresist', 30],
          ['damageresist', 70],
        ]),
      ],
    });
    const hell = computeCharacterSheet(character, data, { difficulty: 2 });
    expect(hell.resists.fire).toMatchObject({ raw: 200 + 20 - 150, cap: 95, value: 70, penalty: -150 });
    expect(hell.resists.cold).toMatchObject({ raw: 50 + 20 - 150, cap: 75, value: -80 });
    expect(hell.resists.magic).toMatchObject({ raw: 30, value: 30, penalty: 0 });
    expect(hell.resists.physical).toMatchObject({ raw: 70, cap: 50, value: 50 });
    expect(hell.resists.fire.sources.map((source) => source.kind)).toEqual(['item', 'quest', 'difficulty']);
    const normal = computeCharacterSheet(character, data, { difficulty: 0 });
    expect(normal.resists.fire).toMatchObject({ raw: 220, value: 95 });
    expect(normal.facts.resistScrolls).toEqual([true, true, false]);
  });

  it('defaults to the difficulty the save is in', () => {
    expect(computeCharacterSheet(testCharacter({ difficulty: 1 }), data).difficulty).toBe(1);
  });
});

describe('computeCharacterSheet: defense, speeds, attack rating, block', () => {
  it('sums each armour piece with its own ED, flat defense, per-level defense, dexterity / 4, then the defense %', () => {
    const character = testCharacter({
      level: 80,
      attributes: { dexterity: 101 },
      items: [
        item(
          'cap',
          equipped('head'),
          [
            ['item_armor_percent', 50],
            ['armorclass', 20],
          ],
          { defense: 101 }
        ),
        item('cm1', charmAt(0, 0), [
          ['armorclass', 10],
          ['item_armor_perlevel', 4],
        ]),
      ],
      skills: {},
    });
    const sheet = computeCharacterSheet(character, data);
    // 151 + 20 + 10 + 4 × 80 / 8 + 101 / 4
    expect(sheet.defense.value).toBe(151 + 30 + 40 + 25);
    const shout = testCharacter({
      ...{ level: 80 },
      items: [item('cap', equipped('head'), [['skill_armor_percent', 100]], { defense: 100 })],
    });
    expect(computeCharacterSheet(shout, data).defense.value).toBe(200);
  });

  it('works out base attack speed and base run/walk from the weapon and armour speed columns', () => {
    const character = testCharacter({
      items: [
        item('lsd', equipped('rightHand', 1), [['attackrate', 5]]),
        item('kit', equipped('leftHand', 1), [['velocitypercent', 3]], { defense: 10 }),
      ],
    });
    const { speed } = computeCharacterSheet(character, data);
    expect(speed.baseAttack.value).toBe(100 + 10 + 5);
    expect(speed.baseRunWalk.value).toBe(100 - 5 + 3);
  });

  it('gives the hand skills their to-hit % on top of the attack rating %', () => {
    const character = testCharacter({
      level: 50,
      attributes: { dexterity: 57 },
      skills: { 574: 1 },
      items: [item('hax', equipped('rightHand', 1), [['item_tohit_percent', 50]])],
      handSkills: { left: 574, right: 0 },
    });
    const sheet = computeCharacterSheet(character, data);
    const factor = charSheetBundle.classes[BARBARIAN]?.toHitFactor ?? 0;
    const base = 50 * 5 + factor;
    const frenzy = sheet.attackRating.hands.find((hand) => hand.skillId === 574);
    expect(frenzy?.skillPercent).toBe(15);
    expect(frenzy?.mainHand).toBe(Math.floor((base * (100 + 50 + 15)) / 100));
    expect(sheet.attackRating.base.value).toBe(Math.floor((base * 150) / 100));
  });

  it("reads Ignore Target's Defense from the active items (0 without it)", () => {
    expect(computeCharacterSheet(testCharacter({}), data).offense.ignoreTargetDefense.value).toBe(0);
    const character = testCharacter({ items: [item('lsd', equipped('rightHand', 1), [['item_ignoretargetac', 1]])] });
    const { ignoreTargetDefense } = computeCharacterSheet(character, data).offense;
    expect(ignoreTargetDefense).toMatchObject({ value: 1, status: 'verified' });
    expect(ignoreTargetDefense.sources.map((source) => source.kind)).toEqual(['item']);
  });

  it('shows block only with a shield, flagged inferred', () => {
    expect(computeCharacterSheet(testCharacter({}), data).block).toBeNull();
    const shield = computeCharacterSheet(
      testCharacter({
        level: 10,
        attributes: { dexterity: 35 },
        items: [item('kit', equipped('leftHand', 1), [['toblock', 20]], { defense: 10 })],
      }),
      data
    );
    const factor = charSheetBundle.classes[BARBARIAN]?.blockFactor ?? 0;
    expect(shield.block).toMatchObject({ status: 'inferred', value: Math.floor(((1 + 20 + factor) * 20) / 20) });
  });
});

describe('computeCharacterSheet: facts', () => {
  it('reads experience to next level, kills, points and the mercenary', () => {
    const character = testCharacter({
      level: 18,
      attributes: { experience: 416729, kill_base: 1013, respecpoints: 5, statpts: 10, archaeology_3: 1 },
      mercenary: { dead: true, flags: 0x10000, seed: 1, nameIndex: 0, typeId: 1, experience: 262296 },
    });
    const facts = computeCharacterSheet(character, data).facts;
    expect(facts).toMatchObject({ experienceNext: 515911, kills: 1013, respecPoints: 5, statPoints: 10 });
    expect(facts.specializations.find((tree) => tree.slug === 'archaeologist')?.ranks).toBe(1);
    // 65 × 15² × 16 = 234,000 ≤ 262,296 < 65 × 16² × 17 = 282,880
    expect(facts.mercenary).toMatchObject({ name: 'Rogue Scout', subtype: 'Physical', level: 15, dead: true });
  });

  it('reads the Kill Ledger and Ascendancy tiers from active items', () => {
    const character = testCharacter({
      items: [
        item('led', charmAt(0, 0), [
          ['kill_ledger_tier_1', 1],
          ['kill_ledger_tier_2', 1],
          ['kill_ledger_harbinger', 1],
        ]),
        item('ast', charmAt(1, 0), [
          ['ascendancy_tier_2', 1],
          ['ascendancy_tier_3', 1],
        ]),
      ],
    });
    expect(computeCharacterSheet(character, data).facts).toMatchObject({
      killLedgerTier: 2,
      killLedgerBosses: ['harbinger'],
      ascendancyTier: 3,
    });
  });
});

describe('toStatsSnapshot', () => {
  it('is flat, numeric and well under 1 KB', () => {
    const sheet = computeCharacterSheet(
      testCharacter({ attributes: { strength: 40 }, items: [item('kit', equipped('leftHand', 1), [], { defense: 10 })] }),
      data
    );
    const snapshot = toStatsSnapshot(sheet, { savedAt: 1_794_169_893, esrVersion: '3.3.03' });
    expect(snapshot).toMatchObject({ v: 1, difficulty: 0, savedAt: 1_794_169_893, esrVersion: '3.3.03', str: 40 });
    expect(typeof snapshot.blk).toBe('number');
    for (const [key, entry] of Object.entries(snapshot)) if (key !== 'esrVersion') expect(typeof entry).toBe('number');
    expect(JSON.stringify(snapshot).length).toBeLessThan(700);
  });
});
