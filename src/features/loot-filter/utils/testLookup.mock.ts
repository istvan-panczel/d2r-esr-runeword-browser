import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { buildLookup } from './lookup';

const type = (code: string, name: string, parents: string[] = []): TypesBundle['types'][number] => ({
  code,
  name,
  parents,
  ancestors: [code, ...parents],
  sockets: [0, 0, 0],
  thresholds: [25, 40],
  cls: null,
  ui: null,
  rwCats: [],
  magic: false,
  rare: false,
  normal: false,
  bodyLoc: null,
});

export const TEST_DATA: LootFilterDataBundle = {
  items: [
    { code: 'r33', name: 'Zod Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
    { code: 'r32', name: 'Cham Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
    { code: 'r31', name: 'Jah Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
    { code: 'hax', name: 'Hand Axe', kind: 'weapon', type: 'axe', spawnable: true, drops: true },
    { code: 'xyz', name: 'Shadow Axe', kind: 'weapon', type: 'axe', spawnable: false, drops: false },
  ],
  stats: [
    { id: 0, name: 'strength' },
    { id: 194, name: 'item_numsockets' },
    { id: 300, name: '' },
    { id: 83, name: 'item_addclassskills' },
    { id: 107, name: 'item_singleskill' },
    { id: 188, name: 'item_addskill_tab' },
    { id: 198, name: 'item_skillonhit' },
    { id: 204, name: 'item_charged_skill' },
  ],
  areas: [
    { id: 1, name: 'Rogue Encampment', act: 0 },
    { id: 40, name: 'Lut Gholein', act: 1 },
    { id: 2, name: 'Blood Moor', act: 0 },
  ],
  sounds: [''],
  uniques: [
    { id: 0, name: 'The Gnasher', code: 'hax', reqLvl: 1 },
    { id: 5, name: 'Harlequin Crest', code: 'uap', reqLvl: 1 },
  ],
  sets: [{ id: 5, name: "Civerb's Ward", code: 'lrg', reqLvl: 1 }],
  skills: [
    { id: 36, name: 'Fire Bolt', cls: 'sor' },
    { id: 47, name: 'Fire Ball', cls: 'sor' },
    { id: 124, name: 'Chain Lightning' },
    { id: 166, name: 'Chain Lightning', cls: 'sor' },
    { id: 258, name: 'Tiger Strike', cls: 'ass' },
    { id: 472, name: 'Orb of Winter', cls: 'sor' },
    { id: 500, name: 'Nova Proc' },
  ],
  knownLayers: [
    { stat: 107, layers: [47, 258] },
    // Orb of Winter lvl 13 and 25 (472 << 6 = 30208), Fire Bolt lvl 3 (36 << 6 = 2304)
    { stat: 198, layers: [2307, 30221, 30233] },
  ],
};

export const TEST_TYPES: TypesBundle = {
  types: [type('rune', 'Rune', ['misc']), type('axe', 'Axe', ['weap']), type('weap', 'Weapon'), type('misc', 'Miscellaneous')],
  classes: [
    { code: 'ama', name: 'Amazon', tabs: ['Bow and Crossbow Skills', 'Passive and Magic Skills', 'Javelin and Spear Skills'] },
    { code: 'sor', name: 'Sorceress', tabs: ['Fire Skills', 'Lightning Skills', 'Cold Skills'] },
    { code: 'ass', name: 'Assassin', tabs: ['Traps', 'Shadow Disciplines', 'Martial Arts'] },
  ],
};

export const TEST_LOOKUP = buildLookup(TEST_DATA, TEST_TYPES);
