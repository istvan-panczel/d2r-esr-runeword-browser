/**
 * What-if entries on a real save (SpinToWin, the 2026-11-11 ground-truth pair): the sanity numbers the docs quote, and
 * the ground-truth sheet staying exact without entries. Skipped without the gitignored saves (personal files).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle } from '@/features/game-data/engine/schema';
import { createCharacterData } from '../../parser/characterData';
import { parseCharacter } from '../../parser/parseCharacter';
import { changeText, whatIfChanges } from '../whatIfView';
import { computeCharacterSheet } from './sheet';
import { sheetData as data, unflaggedChanges } from './testSheet.mock';

const SAVE = resolve(__dirname, '../../../../../test-fixtures/character/ground-truth/spintowin-2026-11-11/SpinToWin.d2s');
const STASH = resolve(__dirname, '../../../../../public/game-data/stash.json');
const CONCENTRATION = 543;
const BATTLE_ORDERS = 570;
const BATTLE_COMMAND = 582;
const JAVAZON = resolve(__dirname, '../../../../../test-fixtures/character/ground-truth/javazon-2026-11-11/Javazon.d2s');

describe.skipIf(!existsSync(SAVE))('what if on SpinToWin (2026-11-11)', () => {
  const character = parseCharacter(
    new Uint8Array(readFileSync(SAVE)),
    createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle)
  );
  const plain = computeCharacterSheet(character, data);

  it('an empty or zero entry list is the ground-truth sheet', () => {
    expect(computeCharacterSheet(character, data, { whatIf: {} })).toEqual(plain);
    expect(computeCharacterSheet(character, data, { whatIf: { stats: [{ stat: 'strength', value: 0 }] } })).toEqual(plain);
    expect(plain.attributes.strength.value).toBe(986);
    expect(plain.life.value).toBe(6080);
  });

  it('a level 6 Concentration aura changes no number on the sheet: it adds damage only', () => {
    const sheet = computeCharacterSheet(character, data, { whatIf: { skills: [{ skillId: CONCENTRATION, level: 6 }] } });
    expect(whatIfChanges(plain, sheet)).toEqual({ numbers: [], skills: [] });
    expect(sheet.whatIf?.skills).toEqual([expect.objectContaining({ level: 6, unshown: ['+125% Enhanced Damage'] })]);
    expect(unflaggedChanges(plain, sheet)).toEqual([]);
  });

  it('+100 Strength: ×2.31 from the strength bonus, and the max resists that follow strength', () => {
    const sheet = computeCharacterSheet(character, data, { whatIf: { stats: [{ stat: 'strength', value: 100 }] } });
    expect(whatIfChanges(plain, sheet).numbers.map(changeText)).toEqual([
      'Strength 986 → 1,217 (+231)',
      'Fire resistance 79% → 80% (+1%)',
      'Max fire resistance 79% → 80% (+1%)',
      'Cold resistance 79% → 80% (+1%)',
      'Max cold resistance 79% → 80% (+1%)',
      'Lightning resistance 79% → 80% (+1%)',
      'Max lightning resistance 79% → 80% (+1%)',
      'Poison resistance 79% → 80% (+1%)',
      'Max poison resistance 79% → 80% (+1%)',
      'Max magic resistance 79% → 80% (+1%)',
    ]);
    expect(unflaggedChanges(plain, sheet)).toEqual([]);
  });

  it('Battle Orders level 20 cast by someone else', () => {
    const sheet = computeCharacterSheet(character, data, { whatIf: { skills: [{ skillId: BATTLE_ORDERS, level: 20 }] } });
    expect(whatIfChanges(plain, sheet).numbers.map(changeText)).toEqual([
      'Life 6,080 → 8,363 (+2,283)',
      'Mana 791 → 1,397 (+606)',
      'Stamina 884 → 1,679 (+795)',
      'Replenish life 2,459 → 3,159 (+700)',
    ]);
  });
});

describe.skipIf(!existsSync(JAVAZON))('what if on Javazon with buffs cast on weapon set II (2026-11-11)', () => {
  const character = parseCharacter(
    new Uint8Array(readFileSync(JAVAZON)),
    createCharacterData(JSON.parse(readFileSync(STASH, 'utf-8')) as StashBundle)
  );
  const buffs = [{ skillId: BATTLE_ORDERS }, { skillId: BATTLE_COMMAND }];
  const buffed = computeCharacterSheet(character, data, { buffs });
  const casts = (sheet: typeof buffed) => sheet.buffs.map((buff) => [buff.name, buff.level, buff.castSet]);

  it('a what-if stat on top changes What changes by its own effect only; the swap casts stay', () => {
    expect(buffed.life.value).toBe(2893);
    const sheet = computeCharacterSheet(character, data, { buffs, whatIf: { stats: [{ stat: 'dexterity', value: 50 }] } });
    expect(casts(sheet)).toEqual(casts(buffed));
    const keys = whatIfChanges(buffed, sheet).numbers.map((entry) => entry.key);
    expect(keys).toContain('dexterity');
    expect(keys).not.toContain('life');
    expect(keys).not.toContain('mana');
  });

  it('+1 to all skills as a what-if stat leaves them: oskills of another class get no +all skills', () => {
    // Battle Orders 25 and Battle Command 20 come from Call to Arms on set II as oskills of a Barbarian skill
    expect(casts(buffed)).toEqual([
      ['Battle Orders', 25, 2],
      ['Battle Command', 20, 2],
    ]);
    const sheet = computeCharacterSheet(character, data, { buffs, whatIf: { stats: [{ stat: 'item_allskills', value: 1 }] } });
    expect(casts(sheet)).toEqual(casts(buffed));
    // Her own skills rise (life 2,893 → 2,897 through them), the swap casts do not
    expect(whatIfChanges(buffed, sheet).numbers.find((entry) => entry.key === 'sk')).toMatchObject({ deltaText: '+1' });
  });
});
