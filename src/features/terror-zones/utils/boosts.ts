import type { TerrorZoneBoost, TerrorZoneGameVersion } from '@/features/game-data/engine/schema';

export const GAME_VERSION_LABELS: Readonly<Record<TerrorZoneGameVersion, string>> = {
  expansion: 'Lord of Destruction',
  rotw: 'Reign of the Warlock',
};

export const DIFFICULTY_LABELS = ['Normal', 'Nightmare', 'Hell'] as const;

/** One game version's boost, when it is the same in every difficulty (level boost and XP; the caps differ). */
export interface VersionBoost {
  readonly version: TerrorZoneGameVersion;
  readonly levelBoost: number;
  readonly xpPercent: number;
  /** Monster level caps per difficulty (`bound_incl_max`), in difficulty order */
  readonly caps: readonly number[];
}

/**
 * The compact boost line's data: per game version (file order), its level boost and XP bonus when every difficulty
 * shares them; a version whose difficulties differ is left out (the page's table shows it).
 */
export function summariseBoosts(boosts: readonly TerrorZoneBoost[]): VersionBoost[] {
  const versions = [...new Set(boosts.map((boost) => boost.version))];
  return versions.flatMap((version) => {
    const rows = boosts.filter((boost) => boost.version === version).sort((a, b) => a.difficulty - b.difficulty);
    const first = rows.at(0);
    if (first === undefined) return [];
    const uniform = rows.every((row) => row.levelBoost === first.levelBoost && row.xpPercent === first.xpPercent);
    return uniform ? [{ version, levelBoost: first.levelBoost, xpPercent: first.xpPercent, caps: rows.map((row) => row.maxLevel) }] : [];
  });
}

/** "+4 monster levels (capped at 45 / 71 / 96), +50% XP" */
export function formatVersionBoost(boost: VersionBoost): string {
  return `+${String(boost.levelBoost)} monster levels (capped at ${boost.caps.join(' / ')}), +${String(boost.xpPercent)}% XP`;
}

export const GAME_VERSION_SHORT_LABELS: Readonly<Record<TerrorZoneGameVersion, string>> = {
  expansion: 'LoD',
  rotw: 'RotW',
};

/** The widget's boost lines, one per game version: "LoD: +4 monster levels, +50% XP" (no label with one version) */
export function formatBoostLines(boosts: readonly VersionBoost[]): string[] {
  return boosts.map((boost) => {
    const text = `+${String(boost.levelBoost)} monster levels, +${String(boost.xpPercent)}% XP`;
    return boosts.length > 1 ? `${GAME_VERSION_SHORT_LABELS[boost.version]}: ${text}` : text;
  });
}

/** The monster level caps per difficulty when every version has the same ones; [] when they differ */
export function sameCaps(boosts: readonly VersionBoost[]): readonly number[] {
  const first = boosts.at(0);
  if (first === undefined) return [];
  return boosts.every((boost) => boost.caps.join() === first.caps.join()) ? first.caps : [];
}
