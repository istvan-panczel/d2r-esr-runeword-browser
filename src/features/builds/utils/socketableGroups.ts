import type { SocketableBonusGroup, SocketableBonusGroupType } from '@/core/db';
import { normalizeName, siteTypeLabel } from '@/features/game-data/engine/matchRunewords';
import type { BaseItem } from '@/features/game-data/engine/schema';
import { slotGroup, typeSlots, type PickerSlot } from './slotFit';

/** How well a base fits one item type of a group label: its own name (the Mythical Arcane Staff), one of its types, or not. */
type TypeFit = 'name' | 'type' | null;

const FIT_RANK: Readonly<Record<'name' | 'type', number>> = { name: 2, type: 1 };

/**
 * Types whose name collides with another's carry a " (code)" suffix in the types bundle and are skipped: the mercenary
 * type "Helm (merc)" is an ancestor of belts and gloves too, and would otherwise read as "Helm".
 */
const isCollidingTypeName = (code: string, typeNames: ReadonlyMap<string, string>): boolean =>
  / \([^)]*\)$/.test(typeNames.get(code) ?? '');

function namesType(name: string, base: Pick<BaseItem, 'name' | 'ancestors'>, typeNames: ReadonlyMap<string, string>): TypeFit {
  const key = normalizeName(name);
  if (normalizeName(base.name) === key) return 'name';
  return base.ancestors.some((code) => !isCollidingTypeName(code, typeNames) && siteTypeLabel(code, typeNames) === key) ? 'type' : null;
}

/** A label item type fits the base unless one of its own exceptions does ("Weapon (except Staff)" and a staff). */
function typeFit(
  type: SocketableBonusGroupType,
  base: Pick<BaseItem, 'name' | 'ancestors'>,
  typeNames: ReadonlyMap<string, string>
): TypeFit {
  const fit = namesType(type.name, base, typeNames);
  if (fit === null) return null;
  return type.except.some((excluded) => namesType(excluded, base, typeNames) !== null) ? null : fit;
}

function groupRank(
  group: SocketableBonusGroup,
  base: Pick<BaseItem, 'name' | 'ancestors'>,
  typeNames: ReadonlyMap<string, string>
): number {
  return Math.max(
    0,
    ...group.itemTypes.map((type) => {
      const fit = typeFit(type, base, typeNames);
      return fit === null ? 0 : FIT_RANK[fit];
    })
  );
}

/**
 * The groups of the page's socketable bonuses that apply to a base: the best-fitting labels, where naming the base
 * itself beats naming one of its types. The Mythical Arcane Staff is a staff, so Boar's "Staff / Wand / Orb" fits it,
 * but "Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff" names it and wins.
 */
export function socketableGroupsForBase(
  groups: readonly SocketableBonusGroup[],
  base: Pick<BaseItem, 'name' | 'ancestors'>,
  typeNames: ReadonlyMap<string, string>
): number[] {
  const ranks = groups.map((group) => groupRank(group, base, typeNames));
  const best = Math.max(0, ...ranks);
  return best === 0 ? [] : ranks.flatMap((rank, index) => (rank === best ? [index] : []));
}

/** The groups with an item type that belongs in the slot (`typeSlots`; an unknown type fits everywhere). */
export function socketableGroupsForSlot(groups: readonly SocketableBonusGroup[], slot: PickerSlot): number[] {
  const group = slotGroup(slot);
  return groups.flatMap((entry, index) =>
    entry.itemTypes.some((type) => {
      const slots = typeSlots(type.name);
      return slots === undefined || slots.includes(group);
    })
      ? [index]
      : []
  );
}

export interface SocketableGroupContext {
  readonly slot: PickerSlot;
  /** The author's chosen runeword base, resolved in bases.json */
  readonly base?: Pick<BaseItem, 'name' | 'ancestors'>;
  readonly typeNames?: ReadonlyMap<string, string>;
}

/**
 * The socketable bonus groups a build item shows: those of its chosen base, else those that belong in its slot (Stone
 * in a helmet slot: "Helm / Boots"), else all. Returns undefined (show all) for fewer than two groups, e.g. the one
 * unlabelled group or old cached rows without groups.
 */
export function socketableGroupsFor(
  groups: readonly SocketableBonusGroup[] | undefined,
  context: SocketableGroupContext
): number[] | undefined {
  if (groups === undefined || groups.length < 2) return undefined;
  const { slot, base, typeNames } = context;
  if (base !== undefined && typeNames !== undefined) {
    const forBase = socketableGroupsForBase(groups, base, typeNames);
    if (forBase.length > 0) return forBase;
  }
  const forSlot = socketableGroupsForSlot(groups, slot);
  return forSlot.length > 0 && forSlot.length < groups.length ? forSlot : undefined;
}
