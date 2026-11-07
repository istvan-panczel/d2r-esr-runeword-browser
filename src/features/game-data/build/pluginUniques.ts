/**
 * Reads the uniques named by the D2RLoader plugin config `celestialrayone.boss-set-unique-drop.toml`
 * (`unique = "Hellfire Torch"` lines of `[[boss_set_unique_drop.rule]]` blocks). A tiny regex instead of a TOML parser:
 * the file is hand-written by the mod author in one fixed shape.
 */
export function readBossSetUniqueDrops(toml: string | null): Set<string> {
  if (toml === null || /^\s*enabled\s*=\s*false\b/m.test(toml)) return new Set();
  const uniques = new Set<string>();
  for (const match of toml.matchAll(/^\s*unique\s*=\s*(["'])(.*?)\1/gm)) {
    const name = match[2];
    if (name !== '') uniques.add(name);
  }
  return uniques;
}

export interface BossSetRule {
  /** monstats.txt hcIdx values (the 0-based data row) */
  readonly monsters: readonly number[];
  /** uniqueitems.txt `index` */
  readonly unique: string;
}

/**
 * The `[[boss_set_unique_drop.rule]]` blocks: the monsters of each set (`monsters = [976, 977, 978]`, on one line or
 * several, `#` comments allowed) and the unique the last of them drops. A block without a monster list or a unique
 * is skipped; nothing when the plugin is disabled or missing.
 */
export function readBossSetRules(toml: string | null): BossSetRule[] {
  if (toml === null || /^\s*enabled\s*=\s*false\b/m.test(toml)) return [];
  const withoutComments = toml.replace(/#[^\n]*/g, '');
  return withoutComments
    .split(/^\s*\[\[boss_set_unique_drop\.rule\]\]\s*$/m)
    .slice(1)
    .flatMap((block) => {
      const list = /^\s*monsters\s*=\s*\[([^\]]*)\]/m.exec(block)?.[1];
      const unique = /^\s*unique\s*=\s*(["'])(.*?)\1/m.exec(block)?.[2];
      if (list === undefined || unique === undefined || unique === '') return [];
      const monsters = [
        ...new Set(
          list
            .split(/[\s,]+/)
            .filter((value) => value !== '')
            .map(Number)
        ),
      ];
      return monsters.every((id) => Number.isInteger(id)) ? [{ monsters, unique }] : [];
    });
}
