import type { TerrorZoneGroup } from '@/features/game-data/engine/schema';

/** Row / card emphasis of a watched zone group (warning token: brown-orange in light, yellow in dark) */
export const WATCHED_ROW_CLASS = 'border-warning/70 bg-warning/10';
/** The current slot's emphasis */
export const CURRENT_ROW_CLASS = 'border-primary/60 bg-accent/50';

/** The names the game's terror zone display lists for a group, comma-separated. */
export function zoneTitle(zone: TerrorZoneGroup): string {
  return zone.labels.length > 0 ? zone.labels.join(', ') : zone.id;
}
