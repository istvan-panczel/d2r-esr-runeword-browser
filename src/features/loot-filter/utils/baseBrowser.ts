import { BASE_TIER_LABELS } from '@/features/game-data/constants/bases';
import type { BaseItem, BasesBundle, ItemTypeInfo, TypesBundle } from '@/features/game-data/engine/schema';
import { FAMILY_TIERS, baseStatLine, buildBaseFamilies, familyHead } from '@/features/game-data/utils/baseFamilies';
import { formatSocketCaps } from '@/features/game-data/utils/format';
import {
  displayCodes,
  type BaseTier,
  type BrowserColumn,
  type BrowserGroup,
  type BrowserItem,
  type BrowserModel,
  type BrowserType,
} from './browserModel';

/**
 * The Bases tab of the item browser: type groups → types → family rows (normal / exceptional / elite) or a plain list.
 * The families themselves come from game-data (`utils/baseFamilies.ts`, shared with the Bases page families view).
 */

const tierColumn = (tier: BaseTier): BrowserColumn => ({ key: tier, label: BASE_TIER_LABELS[tier], tier });

/** One column per tier; the column key is the tier (`allCodes(groups, 'elite')`). */
const TIER_COLUMN: Readonly<Record<BaseTier, BrowserColumn>> = {
  normal: tierColumn('normal'),
  exceptional: tierColumn('exceptional'),
  elite: tierColumn('elite'),
  mythical: tierColumn('mythical'),
};

/** The grid columns of a tiered type, in `FAMILY_TIERS` order. */
export const BASE_COLUMNS: readonly BrowserColumn[] = FAMILY_TIERS.map((tier) => TIER_COLUMN[tier]);

const DEFAULT_THRESHOLDS: ItemTypeInfo['thresholds'] = [25, 40];

function toBrowserItem(base: BaseItem, typeByCode: ReadonlyMap<string, ItemTypeInfo>): BrowserItem {
  const type = typeByCode.get(base.type);
  return {
    code: base.code,
    name: base.name,
    column: TIER_COLUMN[base.tier],
    stats: baseStatLine(base),
    sockets: formatSocketCaps(base.socketCaps, type?.thresholds ?? DEFAULT_THRESHOLDS),
    search: [base.name, base.code, type?.name ?? '', base.type].join(' ').toLowerCase(),
  };
}

const byQlvl = (a: { qlvl: number; name: string }, b: { qlvl: number; name: string }) => a.qlvl - b.qlvl || a.name.localeCompare(b.name);

/** The family model (`buildBaseFamilies`) as browser types: a type with exceptional or elite bases is a grid, else a list. */
export function buildBaseBrowserModel(bases: readonly BaseItem[], types: readonly ItemTypeInfo[]): BrowserModel {
  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const toItem = (base: BaseItem) => toBrowserItem(base, typeByCode);

  const codes: string[] = [];
  const groups = buildBaseFamilies(bases, types).map((group): BrowserGroup => ({
    label: group.label,
    types: group.types.map((type): BrowserType => {
      const tiered = type.rows.some((row) => row.cells.exceptional !== null || row.cells.elite !== null);
      const browserType: BrowserType = tiered
        ? {
            ...emptyType(type.code, type.name),
            layout: 'grid',
            columns: BASE_COLUMNS,
            rows: type.rows.map((row) => ({
              key: row.key,
              cells: FAMILY_TIERS.map((tier) => row.cells[tier] && toItem(row.cells[tier])),
            })),
            extras: type.mythical.map(toItem),
            extrasColumn: TIER_COLUMN.mythical,
          }
        : {
            ...emptyType(type.code, type.name),
            layout: 'list',
            items: [...type.rows.map(familyHead), ...type.mythical].sort(byQlvl).map(toItem),
          };
      codes.push(...displayCodes(browserType));
      return browserType;
    }),
  }));
  return { groups, codes };
}

function emptyType(code: string, name: string): BrowserType {
  return { code, name, layout: 'list', columns: [], rows: [], extras: [], extrasColumn: null, items: [] };
}

// One model per loaded bundle pair (the bundles are cached for the page's lifetime).
let cached: { bases: BasesBundle; types: TypesBundle; model: BrowserModel } | null = null;

export function getBaseBrowserModel(bases: BasesBundle, types: TypesBundle): BrowserModel {
  if (cached?.bases !== bases || cached.types !== types) {
    cached = { bases, types, model: buildBaseBrowserModel(bases.bases, types.types) };
  }
  return cached.model;
}
