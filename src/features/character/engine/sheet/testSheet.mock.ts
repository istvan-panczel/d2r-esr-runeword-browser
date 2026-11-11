/**
 * Test helpers for the computed sheet: the committed charsheet.json + itemtext.json, and synthetic characters built on
 * the parser's synthetic save (parser/testCharacter.ts) with the attributes, skills and items a test needs.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { CharSheetBundle, ItemTextBundle } from '@/features/game-data/engine/schema';
import { makeItem } from '@/features/stash/testing/stashMocks.mock';
import type { StashItem, StashStat } from '@/features/stash/parser/types';
import { equippedGear } from '../../parser/location';
import { parseCharacter } from '../../parser/parseCharacter';
import { buildSave, testData } from '../../parser/testCharacter';
import type { CharacterFile, CharacterItem, EquipSlot, ItemLocation } from '../../parser/types';
import { createSheetData, type SheetData } from './sheetData';
import type { CharacterSheet, SheetValue } from './types';

const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../../../../public/game-data', file), 'utf-8')) as T;

export const charSheetBundle = read<CharSheetBundle>('charsheet.json');
export const itemTextBundle = read<ItemTextBundle>('itemtext.json');
export const sheetData: SheetData = createSheetData(charSheetBundle, itemTextBundle);

export function statId(name: string): number {
  const id = sheetData.statId(name);
  if (id === undefined) throw new Error(`no stat ${name}`);
  return id;
}

/** [stat name, value] or [stat name, param, value] */
export type StatSpec = [string, number] | [string, number, number];

export function stats(specs: readonly StatSpec[]): StashStat[] {
  return specs.map((spec) =>
    spec.length === 2 ? { id: statId(spec[0]), param: 0, value: spec[1] } : { id: statId(spec[0]), param: spec[1], value: spec[2] }
  );
}

export function item(
  code: string,
  location: ItemLocation,
  specs: readonly StatSpec[] = [],
  fields: Partial<StashItem> = {},
  socketed: CharacterItem[] = []
): CharacterItem {
  return { ...makeItem(code, { stats: stats(specs), ...fields }), location, socketed } as CharacterItem;
}

export const equipped = (slot: EquipSlot, weaponSet: 1 | 2 | null = null): ItemLocation => ({
  kind: 'equipped',
  slot,
  weaponSet,
  rawBody: 0,
});
export const charmAt = (x: number, y: number): ItemLocation => ({ kind: 'charm', x, y });
export const inventoryAt = (x: number, y: number): ItemLocation => ({ kind: 'inventory', x, y });
export const socketedIn: ItemLocation = { kind: 'socketed', socket: 0 };

export interface CharacterSpec {
  classId?: number;
  level?: number;
  /** gf values by stat name, as the save stores them (life / mana / stamina × 256) */
  attributes?: Record<string, number>;
  /** Hard points by skills.txt row */
  skills?: Record<number, number>;
  items?: CharacterItem[];
  activeWeapon?: 0 | 1;
  difficulty?: 0 | 1 | 2;
  /** Anya's scroll read per difficulty */
  scrolls?: [boolean, boolean, boolean];
  handSkills?: { left?: number; right?: number };
  mercenary?: CharacterFile['mercenary'];
}

/** A parsed synthetic save with the spec's state put on it */
export function testCharacter(spec: CharacterSpec = {}): CharacterFile {
  const parsed = parseCharacter(buildSave({ level: spec.level ?? 50 }), testData);
  const items = spec.items ?? [];
  const binding = (skillId: number | undefined) => ({ skillId: skillId ?? null, leftHand: false, raw: 0 });
  const quests = parsed.quests;
  return {
    ...parsed,
    classId: spec.classId ?? 4,
    className: 'Test',
    level: spec.level ?? 50,
    activeWeapon: spec.activeWeapon ?? 0,
    attributes: Object.entries({ level: spec.level ?? 50, ...spec.attributes }).map(([name, raw]) => ({
      id: statId(name),
      raw,
      value: raw,
    })),
    skills: Object.entries(spec.skills ?? {}).map(([skillId, points]) => ({ skillId: Number(skillId), points })),
    handSkills: {
      left: binding(spec.handSkills?.left),
      right: binding(spec.handSkills?.right),
      swapLeft: binding(undefined),
      swapRight: binding(undefined),
    },
    items: { ...parsed.items, player: items },
    gear: equippedGear(items),
    progress: { ...parsed.progress, difficulty: spec.difficulty ?? 0 },
    quests:
      quests === null
        ? null
        : {
            difficulties: [0, 1, 2].map((d) => ({ ...quests.difficulties[d], resistScroll: spec.scrolls?.[d] ?? false })) as NonNullable<
              CharacterFile['quests']
            >['difficulties'],
          },
    mercenary: spec.mercenary ?? null,
  };
}

/** A fixed-point pool's exact value (sources before the final floor), × 256 */
export const exactPool = (value: SheetValue): number => Math.round(value.sources.reduce((sum, source) => sum + source.value, 0) * 256);

/** The set item ids of a sets.txt set */
export function setItemIds(key: string): number[] {
  const index = charSheetBundle.sets.findIndex((set) => set.key === key);
  return charSheetBundle.setItems.flatMap((set, id) => (set === index ? [id] : []));
}

/** Every numeric leaf of a sheet by path (array entries keyed by skill id and hand when they have one) */
function leaves(value: unknown, path: string, out: Map<string, { value: number; statuses: string[] }>, statuses: string[] = []): void {
  if (typeof value === 'number') {
    out.set(path, { value, statuses });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((entry: unknown, i) => {
      const record = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
      const key = typeof record.skillId === 'number' ? `${String(record.skillId)}${typeof record.hand === 'string' ? record.hand : ''}` : i;
      leaves(entry, `${path}[${String(key)}]`, out, statuses);
    });
    return;
  }
  const record = value as Record<string, unknown>;
  const own = typeof record.status === 'string' ? [...statuses, record.status] : statuses;
  for (const [key, entry] of Object.entries(record))
    if (!['facts', 'buffs', 'whatIf', 'warnings', 'status'].includes(key)) leaves(entry, `${path}.${key}`, out, own);
}

const IDENTITY = new Set(['.v', '.classId', '.level', '.difficulty', '.weaponSet']);

/**
 * The numbers of a buffed sheet that break the structural rule: one outside any object with a status (a field the rule
 * cannot see), or one that differs from the unbuffed sheet under a status other than `unverified`. Empty when sound.
 */
export function unflaggedChanges(plain: CharacterSheet, buffed: CharacterSheet): string[] {
  const before = new Map<string, { value: number; statuses: string[] }>();
  const after = new Map<string, { value: number; statuses: string[] }>();
  leaves(plain, '', before);
  leaves(buffed, '', after);
  const problems: string[] = [];
  for (const [path, leaf] of after) {
    if (IDENTITY.has(path)) continue;
    if (leaf.statuses.length === 0) problems.push(`${path}: no status`);
    else if (before.get(path)?.value !== leaf.value && leaf.statuses.at(-1) !== 'unverified')
      problems.push(`${path}: ${String(before.get(path)?.value)} → ${String(leaf.value)} still ${String(leaf.statuses.at(-1))}`);
  }
  return problems;
}
