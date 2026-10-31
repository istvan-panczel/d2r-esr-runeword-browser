/**
 * The bundled starting point: Sully's QoL filter (v0.6.7), the filter the ESR launcher pulls live from
 * github.com/Thisisnotsully/QoL-Filter since ESR 3.2.22 (`LootFilters/sources.json`). The copy in `public/loot-filters/`
 * is his `Sullys-QoL-Filter.json` verbatim (v0.6.2 fixed the `9pm` typo and the trailing comma we had patched in
 * v0.6.1, v0.6.3 adds a 500k+ gold stack rule, v0.6.7 a +1 all skills base highlight and "except +all skills" hide rules; strict JSON apart from the `//` comments). Up to ESR 3.2.21
 * the mod shipped an earlier conversion of the same filter as `LootFilters/esr-default-filter.json`.
 */
export const TEMPLATE_NAME = "Sully's QoL Filter";
export const TEMPLATE_CREDIT =
  "Sully's QoL filter v0.6.7, the filter the ESR launcher ships live from github.com/Thisisnotsully/QoL-Filter; icons and sounds by Sully";
export const TEMPLATE_FILE = 'sullys-qol-filter.json';

/** A file under `public/loot-filters/` (the template, bundled sounds and icons). */
export function lootFilterAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}loot-filters/${path}`;
}

/** Fetches the bundled template's file text. */
export async function fetchTemplateText(): Promise<string> {
  const response = await fetch(lootFilterAssetUrl(TEMPLATE_FILE));
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.text();
}
