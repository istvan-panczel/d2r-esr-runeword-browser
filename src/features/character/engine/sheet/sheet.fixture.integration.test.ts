/**
 * The computed sheet against the in-game character screen: three ground-truth pairs (screenshots transcribed in
 * test-fixtures/character/ground-truth/<name>-2026-11-11/GROUND-TRUTH.md, the save written seconds later), and a
 * sanity run over every real save. Skipped without the gitignored saves (personal files, never committed).
 *
 * The prototype left two residues, both explained and fixed here: SpinToWin's mana read 792 (game 791) because the %
 * was taken once of the pool plus its per-level amount instead of apart (op 11 names both), and the off-hand attack
 * rating read 68,964 (game 68,978) because the off-hand's per-level to-hit was floored on its own instead of pooled with
 * the character's other per-level to-hit (331 + 535 = 866, pooled 68 × 102 / 8 = 867: one point × 1400% = 14).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle } from '@/features/game-data/engine/schema';
import { createCharacterData } from '../../parser/characterData';
import { parseCharacter } from '../../parser/parseCharacter';
import type { CharacterFile } from '../../parser/types';
import { listAvailableBuffs } from './buffs';
import { computeCharacterSheet } from './sheet';
import { exactPool, sheetData as data, unflaggedChanges } from './testSheet.mock';
import type { CharacterSheet } from './types';

const FIXTURES = resolve(__dirname, '../../../../../test-fixtures/character');
const GROUND_TRUTH = resolve(FIXTURES, 'ground-truth');
const STASH = resolve(__dirname, '../../../../../public/game-data/stash.json');
const PAIRS = { Javazon: 'javazon-2026-11-11', SpinToWin: 'spintowin-2026-11-11', Soso: 'soso-2026-11-11' } as const;
type Pair = keyof typeof PAIRS;

const present = existsSync(resolve(GROUND_TRUTH, PAIRS.SpinToWin, 'SpinToWin.d2s'));

describe.skipIf(!present)('computed sheet vs in-game ground truth (2026-11-11)', () => {
  const characterData = createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle);
  const load = (name: Pair): CharacterFile =>
    parseCharacter(new Uint8Array(readFileSync(resolve(GROUND_TRUTH, PAIRS[name], `${name}.d2s`))), characterData);
  const sheets = new Map<Pair, { character: CharacterFile; sheet: CharacterSheet }>(
    (Object.keys(PAIRS) as Pair[]).map((name) => {
      const character = load(name);
      return [name, { character, sheet: computeCharacterSheet(character, data) }];
    })
  );
  const get = (name: Pair) => {
    const entry = sheets.get(name);
    if (entry === undefined) throw new Error(name);
    return entry;
  };
  const screen = (sheet: CharacterSheet) => ({
    str: sheet.attributes.strength.value,
    dex: sheet.attributes.dexterity.value,
    vit: sheet.attributes.vitality.value,
    ene: sheet.attributes.energy.value,
    def: sheet.defense.value,
    stamina: sheet.stamina.value,
    life: sheet.life.value,
    mana: sheet.mana.value,
    fire: sheet.resists.fire.value,
    lightning: sheet.resists.lightning.value,
    cold: sheet.resists.cold.value,
    poison: sheet.resists.poison.value,
    magic: sheet.resists.magic.value,
    physical: sheet.resists.physical.value,
  });
  const advanced = (sheet: CharacterSheet) => ({
    manaRegen: sheet.regen.mana.value,
    dr: sheet.damageReduction.value,
    mdr: sheet.magicDamageReduction.value,
    lifeLeech: sheet.leech.life.value,
    manaLeech: sheet.leech.mana.value,
    baseRunWalk: sheet.speed.baseRunWalk.value,
    baseAttack: sheet.speed.baseAttack.value,
    replenish: sheet.regen.life.value,
    gold: sheet.find.gold.value,
    magic: sheet.find.magic.value,
    ias: sheet.speed.attack.value,
    frw: sheet.speed.run.value,
    fhr: sheet.speed.hitRecovery.value,
    fbr: sheet.speed.block.value,
    fcr: sheet.speed.cast.value,
    targetDefense: sheet.offense.targetDefense.value,
    allSkills: sheet.skills.all.value,
    crushingBlow: sheet.offense.crushingBlow.value,
    deadlyStrike: sheet.offense.deadlyStrike.value,
    dodge: sheet.defenseChances.dodge.value,
    avoid: sheet.defenseChances.avoid.value,
    evade: sheet.defenseChances.evade.value,
  });

  it('Javazon (Hell, act 3): every number of the character screen and advanced stats', () => {
    const { sheet } = get('Javazon');
    expect(screen(sheet)).toEqual({
      str: 210,
      dex: 282,
      vit: 316,
      ene: 15,
      def: 2430,
      stamina: 813,
      life: 1550,
      mana: 234,
      fire: 80,
      lightning: 75,
      cold: 75,
      poison: 45,
      magic: 0,
      physical: 13,
    });
    expect(advanced(sheet)).toEqual({
      manaRegen: 116,
      dr: 0,
      mdr: 0,
      lifeLeech: 44,
      manaLeech: 17,
      baseRunWalk: 91,
      baseAttack: 80,
      replenish: 642,
      gold: 337,
      magic: 40,
      ias: 79,
      frw: 99,
      fhr: 43,
      fbr: 8,
      fcr: 18,
      targetDefense: 3,
      allSkills: 8,
      crushingBlow: 44,
      deadlyStrike: 24,
      dodge: 20,
      avoid: 20,
      evade: 20,
    });
    expect(sheet.resists.fire.cap).toBe(80);
    expect([sheet.absorb.fire.value, sheet.absorb.lightning.value, sheet.absorb.cold.value]).toEqual([13, 13, 13]);
    expect(sheet.attackRating.percent.value).toBe(98);
    expect(sheet.facts).toMatchObject({
      saveDifficulty: 2,
      act: 3,
      level: 80,
      experience: 712_940_883,
      experienceNext: 729_975_651,
      statPoints: 10,
    });
  });

  it('SpinToWin (Hell, act 5, dual wield): every number, including both attack rating lines', () => {
    const { sheet } = get('SpinToWin');
    expect(screen(sheet)).toEqual({
      str: 986,
      dex: 746,
      vit: 493,
      ene: 118,
      def: 73276,
      stamina: 884,
      life: 6080,
      mana: 791,
      fire: 79,
      lightning: 79,
      cold: 79,
      poison: 79,
      magic: 38,
      physical: 50,
    });
    expect(advanced(sheet)).toEqual({
      manaRegen: 91,
      dr: 84,
      mdr: 60,
      lifeLeech: 158,
      manaLeech: 20,
      baseRunWalk: 138,
      baseAttack: 123,
      replenish: 2459,
      gold: 302,
      magic: 417,
      ias: 205,
      frw: 85,
      fhr: 10,
      fbr: 10,
      fcr: 100,
      targetDefense: 28,
      allSkills: 10,
      crushingBlow: 82,
      deadlyStrike: 100,
      dodge: 0,
      avoid: 0,
      evade: 0,
    });
    expect(
      [sheet.resists.fire, sheet.resists.cold, sheet.resists.lightning, sheet.resists.poison, sheet.resists.magic].map((r) => r.cap)
    ).toEqual([79, 79, 79, 79, 79]);
    expect(
      [sheet.absorb.firePercent, sheet.absorb.lightningPercent, sheet.absorb.magicPercent, sheet.absorb.coldPercent].map((v) => v.value)
    ).toEqual([2, 2, 2, 2]);
    expect(sheet.attackRating.percent.value).toBe(505);
    const frenzy = sheet.attackRating.hands.find((hand) => hand.name === 'Frenzy');
    const whirlwind = sheet.attackRating.hands.find((hand) => hand.name === 'Whirlwind');
    expect(frenzy).toMatchObject({ mainHand: 61474, offHand: 68978 });
    // The screen shows one line for Whirlwind (skills.txt weapsel 2): the main hand's
    expect(whirlwind).toMatchObject({ mainHand: 61474, offHand: null });
    expect(sheet.facts).toMatchObject({
      saveDifficulty: 2,
      act: 5,
      level: 102,
      experience: 2_052_018_460,
      experienceNext: 2_177_941_209,
      statPoints: 0,
    });
    expect(sheet.facts.relicsLearned).toBe(1);
    // Advanced Stats list "Ignore Target's Defense"; Javazon's and Soso's do not
    expect(sheet.offense.ignoreTargetDefense.value).toBeGreaterThan(0);
    expect(get('Javazon').sheet.offense.ignoreTargetDefense.value).toBe(0);
    expect(get('Soso').sheet.offense.ignoreTargetDefense.value).toBe(0);
  });

  it('Soso (Normal, act 1): every number', () => {
    const { sheet } = get('Soso');
    expect(screen(sheet)).toEqual({
      str: 75,
      dex: 50,
      vit: 30,
      ene: 71,
      def: 130,
      stamina: 121,
      life: 220,
      mana: 304,
      fire: 54,
      lightning: 49,
      cold: 34,
      poison: 71,
      magic: 0,
      physical: 10,
    });
    expect(advanced(sheet)).toMatchObject({
      manaRegen: 138,
      dr: 2,
      mdr: 12,
      baseRunWalk: 100,
      baseAttack: 110,
      replenish: 100,
      magic: 50,
      ias: 15,
      frw: 45,
      fcr: 49,
      allSkills: 1,
      crushingBlow: 25,
      fhr: 0,
      fbr: 0,
      gold: 0,
    });
    expect(sheet.facts).toMatchObject({
      saveDifficulty: 0,
      act: 1,
      level: 18,
      experience: 416_729,
      experienceNext: 515_911,
      gold: 2276,
      statPoints: 10,
    });
  });

  it.each(Object.keys(PAIRS) as Pair[])('%s: the saved current life / mana / stamina never exceed the computed maximum', (name) => {
    const { character, sheet } = get(name);
    const current = (stat: string) => character.attributes.find((attribute) => attribute.id === data.statId(stat))?.raw ?? 0;
    expect(exactPool(sheet.life)).toBeGreaterThanOrEqual(current('hitpoints'));
    expect(exactPool(sheet.mana)).toBeGreaterThanOrEqual(current('mana'));
    expect(exactPool(sheet.stamina)).toBe(current('stamina'));
    // Full at save time: within one point of the maximum
    expect(exactPool(sheet.life) - current('hitpoints')).toBeLessThan(256);
    expect(exactPool(sheet.mana) - current('mana')).toBeLessThan(256);
  });

  it('flags nothing on the ground-truth saves', () => {
    for (const { sheet } of sheets.values()) expect(sheet.warnings).toEqual([]);
  });
});

const saves = existsSync(FIXTURES)
  ? [
      ...readdirSync(FIXTURES).filter((file) => file.endsWith('.d2s')),
      ...(existsSync(GROUND_TRUTH)
        ? readdirSync(GROUND_TRUTH).flatMap((dir) =>
            existsSync(resolve(GROUND_TRUTH, dir)) && !dir.startsWith('_')
              ? readdirSync(resolve(GROUND_TRUTH, dir))
                  .filter((file) => file.endsWith('.d2s'))
                  .map((file) => `ground-truth/${dir}/${file}`)
              : []
          )
        : []),
    ]
  : [];

describe.skipIf(saves.length === 0)('computed sheet: every real save', () => {
  const characterData = createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle);

  it.each(saves)('%s computes without NaN or negative pools', (save) => {
    const character = parseCharacter(new Uint8Array(readFileSync(resolve(FIXTURES, save))), characterData);
    for (const difficulty of [0, 1, 2] as const) {
      const sheet = computeCharacterSheet(character, data, { difficulty });
      const numbers = JSON.stringify(sheet, (_, value: unknown) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`non-finite number in ${save}`);
        return value;
      });
      expect(numbers.length).toBeGreaterThan(0);
      expect(sheet.life.value).toBeGreaterThan(0);
      expect(sheet.mana.value).toBeGreaterThanOrEqual(0);
      expect(sheet.stamina.value).toBeGreaterThan(0);
      // The quest words agree with the header's progression byte (5 per completed difficulty)
      expect(sheet.facts.completedDifficulties).toBe(Math.floor(character.progress.progression / 5));
    }
  });
});

const DUDU = resolve(FIXTURES, 'Dudu.d2s');

describe.skipIf(!existsSync(DUDU))('computed sheet: a buff cross-check (no buffed ground truth yet)', () => {
  it('Dudu was saved shapeshifted: with Werewolf (+12% life) the maximum life is exactly the saved current life', () => {
    const characterData = createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle);
    const character = parseCharacter(new Uint8Array(readFileSync(DUDU)), characterData);
    const current = character.attributes.find((attribute) => attribute.id === data.statId('hitpoints'))?.raw ?? 0;
    const plain = computeCharacterSheet(character, data);
    expect(exactPool(plain.life)).toBeLessThan(current);
    const wolf = computeCharacterSheet(character, data, { buffs: [{ skillId: 595 }] });
    expect(exactPool(wolf.life)).toBe(current);
    expect(wolf.life.status).toBe('unverified');
  });
});

const REVIEW = ['PhysMagicBowazo', 'EleBowazon', 'Dudu', 'ZealoProcadin'] as const;

describe.skipIf(!REVIEW.every((name) => existsSync(resolve(FIXTURES, `${name}.d2s`))))(
  'computed sheet: review findings on real saves',
  () => {
    const characterData = createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle);
    const load = (name: (typeof REVIEW)[number]) =>
      parseCharacter(new Uint8Array(readFileSync(resolve(FIXTURES, `${name}.d2s`))), characterData);

    it('PhysMagicBowazo (bow + magic quiver): the quiver’s 29 IAS counts, no off-hand line', () => {
      const sheet = computeCharacterSheet(load('PhysMagicBowazo'), data);
      expect(sheet.speed.attack.value).toBe(88);
      expect(sheet.offense.offHand).toBeNull();
      expect(sheet.attackRating.hands.map((hand) => [hand.name, hand.mainHand, hand.offHand])).toEqual([
        ['Strafe', 3669, null],
        ['Multiple Shot', 1417, null],
      ]);
    });

    it('EleBowazon (bow + magic quiver): the quiver’s +39 attack rating counts, no off-hand line', () => {
      const sheet = computeCharacterSheet(load('EleBowazon'), data);
      expect(sheet.attackRating.base.sources).toContainEqual(expect.objectContaining({ kind: 'item', label: 'left hand', value: 39 }));
      expect(sheet.attackRating.base.value).toBe(2456);
      expect(sheet.attackRating.hands.map((hand) => [hand.name, hand.mainHand, hand.offHand])).toEqual([
        ['Magic Arrow', 3039, null],
        ['Exploding Arrow', 5078, null],
      ]);
    });

    it('Dudu: a skill it does not have is refused even with a level; the forms are one group', () => {
      const character = load('Dudu');
      const plain = computeCharacterSheet(character, data);
      const buffed = computeCharacterSheet(character, data, { buffs: [{ skillId: 625, level: 10 }] });
      expect(buffed.defense.value).toBe(plain.defense.value);
      expect(buffed.buffs).toEqual([]);
      expect(buffed.warnings.some((warning) => warning.includes('Call of the Wild') && warning.includes('does not have it'))).toBe(true);
      const groups = listAvailableBuffs(character, data).filter((buff) => buff.exclusiveGroup === 'shapeshift');
      expect(groups.map((buff) => buff.skillId).sort()).toEqual([595, 596]);
    });

    it('ZealoProcadin (Hell): Salvation raises the fire cap, flagged; one own aura counts', () => {
      const character = load('ZealoProcadin');
      const plain = computeCharacterSheet(character, data, { difficulty: 2 });
      const salvation = computeCharacterSheet(character, data, { difficulty: 2, buffs: [{ skillId: 557 }] });
      expect(salvation.resists.fire.cap).toBeGreaterThan(plain.resists.fire.cap);
      expect(salvation.resists.fire.status).toBe('unverified');
      expect(unflaggedChanges(plain, salvation)).toEqual([]);
      const auras = listAvailableBuffs(character, data).filter((buff) => buff.exclusiveGroup === 'aura');
      expect(auras.length).toBeGreaterThan(1);
      const all = computeCharacterSheet(character, data, { difficulty: 2, buffs: auras.map((buff) => ({ skillId: buff.skillId })) });
      expect(all.buffs).toHaveLength(1);
    });
  }
);

describe.skipIf(!present)('computed sheet: every listed buff on the ground-truth saves is flagged structurally', () => {
  const characterData = createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle);
  it.each(Object.keys(PAIRS) as Pair[])('%s', (name) => {
    const character = parseCharacter(new Uint8Array(readFileSync(resolve(GROUND_TRUTH, PAIRS[name], `${name}.d2s`))), characterData);
    const plain = computeCharacterSheet(character, data);
    const buffs = listAvailableBuffs(character, data).map((buff) => ({ skillId: buff.skillId, level: buff.level }));
    const buffed = computeCharacterSheet(character, data, { buffs });
    expect(unflaggedChanges(plain, buffed)).toEqual([]);
    expect(new Set(buffs.map((buff) => buff.skillId)).size).toBe(buffs.length);
  });
});

/** Every real save, the swap and owner-check copies included */
const allSaves = existsSync(FIXTURES)
  ? [
      ...saves,
      ...['swap', 'owner-check-2026-11-11/all-current'].flatMap((dir) =>
        existsSync(resolve(FIXTURES, dir))
          ? readdirSync(resolve(FIXTURES, dir))
              .filter((file) => file.endsWith('.d2s'))
              .map((file) => `${dir}/${file}`)
          : []
      ),
    ]
  : [];

describe.skipIf(allSaves.length === 0)('computed sheet: buffs cast on the other weapon set (INFERRED, no in-game check yet)', () => {
  const characterData = createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle);
  const load = (save: string) => parseCharacter(new Uint8Array(readFileSync(resolve(FIXTURES, save))), characterData);
  /** The character with its other weapon set's items in the inventory (not counted; item indices kept) */
  const stowed = (character: CharacterFile): CharacterFile => {
    const inHand = character.activeWeapon === 1 ? 2 : 1;
    return {
      ...character,
      items: {
        ...character.items,
        player: character.items.player.map((entry) =>
          entry.location.kind === 'equipped' && entry.location.weaponSet !== null && entry.location.weaponSet !== inHand
            ? { ...entry, location: { kind: 'inventory', x: 0, y: 0 } }
            : entry
        ),
      },
    };
  };

  it.each(allSaves)('%s: the other set changes only the casts it gives higher (else bit for bit)', (save) => {
    const character = load(save);
    const available = listAvailableBuffs(character, data);
    const alone = listAvailableBuffs(stowed(character), data);
    const buffs = available.map((buff) =>
      buff.kind === 'proc' ? { skillId: buff.skillId, level: buff.level } : { skillId: buff.skillId }
    );
    const swapped = available.filter((buff) => buff.castSet !== undefined);
    if (swapped.length === 0) {
      expect(available).toEqual(alone);
      expect(computeCharacterSheet(character, data, { buffs })).toEqual(computeCharacterSheet(stowed(character), data, { buffs }));
      return;
    }
    // A cast on the other set: listed higher there than the set in hand alone gives it (or only there), on the other set
    const inHand = character.activeWeapon === 1 ? 2 : 1;
    for (const buff of swapped) {
      expect(buff.castSet).toBe(inHand === 1 ? 2 : 1);
      expect(buff.level).toBeGreaterThan(alone.find((entry) => entry.skillId === buff.skillId)?.level ?? 0);
    }
    // Every other buff is listed as the set in hand alone lists it
    for (const buff of available.filter((entry) => entry.castSet === undefined))
      expect(alone).toContainEqual(expect.objectContaining({ skillId: buff.skillId, kind: buff.kind, level: buff.level }));
    expect(alone.every((buff) => buff.castSet === undefined)).toBe(true);
    // Counted with every buff on: each cast on the other set at least at its listed level, labelled with that set
    const sheet = computeCharacterSheet(character, data, { buffs });
    for (const buff of swapped) {
      const applied = sheet.buffs.find((entry) => entry.skillId === buff.skillId);
      if (applied?.castSet === undefined) continue; // a group choice or an item aura of the skill counted instead
      expect(applied.level).toBeGreaterThanOrEqual(buff.level);
    }
    expect(sheet.buffs.some((entry) => entry.castSet !== undefined)).toBe(true);
  });

  it.skipIf(!present)('Javazon: Call to Arms on set II gives Battle Orders 25 and Battle Command 20 (the set in hand has neither)', () => {
    const character = load(`ground-truth/${PAIRS.Javazon}/Javazon.d2s`);
    const swapped = listAvailableBuffs(character, data)
      .filter((buff) => buff.castSet !== undefined)
      .map((buff) => [buff.name, buff.level, buff.castSet]);
    expect(swapped).toEqual([
      ['Battle Command', 20, 2],
      ['Battle Orders', 25, 2],
      ['Eagle Eye', 12, 2],
    ]);
    const plain = computeCharacterSheet(character, data);
    const sheet = computeCharacterSheet(character, data, { buffs: [{ skillId: 570 }, { skillId: 582 }] });
    expect(sheet.buffs.map((buff) => [buff.name, buff.level, buff.castSet])).toEqual([
      ['Battle Orders', 25, 2],
      ['Battle Command', 20, 2],
    ]);
    // Battle Command’s +3 skills (skill-based vitality and the Kill Ledger aura add a little), Battle Orders’ 107% life, mana and stamina: the predictions
    // for the in-game check
    expect(sheet.skills.all.value).toBe(plain.skills.all.value + 3);
    expect([plain.life.value, plain.mana.value, plain.stamina.value]).toEqual([1550, 234, 813]);
    expect([sheet.life.value, sheet.mana.value, sheet.stamina.value]).toEqual([2893, 462, 1578]);
    expect(sheet.life.status).toBe('unverified');
    expect(unflaggedChanges(plain, sheet)).toEqual([]);
  });
});
