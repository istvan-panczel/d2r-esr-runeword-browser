/**
 * mercenaries.json: the Mercenaries table of ESR's skill information page (docs/skill_information.htm) joined to
 * hireling.txt.
 *
 * - The page gives the variants: one row per hireling and type (Desert Mercenary: per type and difficulty), and the
 *   display names. hireling.txt gives the numbers. Only Version 100 rows count (Version 0 is the classic game's copy).
 * - Join: file Hireling (`FILE_HIRELING`) + `HireDesc` (`HIRE_DESC`, the page's type label) + Difficulty when the page's
 *   row names one. `*SubType` is not usable (every Barbarian row says "1hs").
 * - A row is one level band; a page row that covers all three difficulties merges the difficulties' rows by level, since
 *   the file repeats the same band with another Gold. Anything else that differs at the same level is a warning.
 * - Skill names go through createNameResolver (class skills first). The page's list is compared with the file's by
 *   resolved id: a difference is a warning.
 * See docs/features/MERCENARIES.md.
 */
import type {
  MercenariesBundle,
  MercenaryBand,
  MercenaryHireling,
  MercenarySkill,
  MercenaryVariant,
  SkillDetail,
} from '../engine/schema.ts';
import { MERCENARY_DIFFICULTIES, mercenarySlug, parseMercenarySubtype, type MercenaryDifficulty } from '../engine/mercenaryLinks.ts';
import { createNameResolver, type MercenaryRow } from './skillInfoPage.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

/** The ESR rows of hireling.txt */
const VERSION = 100;
const SKILL_SLOTS = [1, 2, 3, 4, 5, 6];

/** The page's type label → hireling.txt `HireDesc` */
const HIRE_DESC: Readonly<Partial<Record<string, string>>> = {
  Elemental: 'farw',
  Physical: 'carw',
  Comb: 'comb',
  Def: 'def',
  Off: 'off',
  Fire: 'fire',
  Cold: 'cold',
  Lightning: 'ltng',
  Defensive: 'def',
  Offensive: 'off',
};

/** The page's hireling name → hireling.txt's, where they differ */
const FILE_HIRELING: Readonly<Partial<Record<string, string>>> = { 'Eastern Sorcerer': 'Eastern Sorceror' };

/**
 * Dexterity that looks like a typo, by `<hireling> <subtype>` and level: the Desert Offensive Nightmare rows read 98 / 97
 * where its siblings read 97 / 158 (ESR 3.3.02). The bundle keeps the value and flags it; a warning fires once the file
 * no longer has it.
 */
const SUSPECT_DEXTERITY: Readonly<Partial<Record<string, Readonly<Record<number, number>>>>> = {
  'Desert Mercenary Off - Nightmare': { 50: 98, 85: 97 },
};

export interface MercenariesInput {
  hireling: TsvTable;
  /** The Mercenaries table of the skill information page */
  page: readonly MercenaryRow[];
  /** skilldetails.json skills */
  skills: readonly SkillDetail[];
}

export interface MercenariesResult {
  bundle: MercenariesBundle;
  counts: Record<string, number>;
  warnings: string[];
}

const difficultyOf = (row: TsvRow): MercenaryDifficulty | undefined => MERCENARY_DIFFICULTIES[row.num('Difficulty') - 1];

function readBand(row: TsvRow): MercenaryBand {
  return {
    level: row.num('Level'),
    life: row.num('HP'),
    defense: row.num('Defense'),
    strength: row.num('Str'),
    dexterity: row.num('Dex'),
    attackRating: row.num('AR'),
    damage: [row.num('Dmg-Min'), row.num('Dmg-Max')],
    resists: {
      fire: row.num('ResistFire'),
      cold: row.num('ResistCold'),
      lightning: row.num('ResistLightning'),
      poison: row.num('ResistPoison'),
    },
  };
}

/** The filled skill slots: name and level, in slot order */
function readSkillSlots(row: TsvRow): { name: string; level: number }[] {
  return SKILL_SLOTS.flatMap((slot) => {
    const name = row.str(`Skill${String(slot)}`);
    return name === '' ? [] : [{ name, level: row.num(`Level${String(slot)}`) }];
  });
}

export function buildMercenariesBundle({ hireling, page, skills }: MercenariesInput): MercenariesResult {
  const warnings: string[] = [];
  const resolveAll = createNameResolver(skills);
  const resolve = (name: string): SkillDetail | undefined => resolveAll(name, true).at(0);
  const rows = hireling.rows.filter((row) => row.num('Version') === VERSION);
  if (rows.length === 0) warnings.push(`mercenaries: hireling.txt has no Version ${String(VERSION)} rows`);
  const used = new Set<TsvRow>();
  const hirelings: MercenaryHireling[] = [];

  for (const entry of page) {
    const { label, name: typeName, difficulty } = parseMercenarySubtype(entry.subtype);
    const where = `${entry.hireling} ${entry.subtype}`;
    const hireDesc = HIRE_DESC[label];
    if (hireDesc === undefined) {
      warnings.push(`mercenaries: ${where}: unknown type label "${label}" on the skill information page`);
      continue;
    }
    const fileName = FILE_HIRELING[entry.hireling] ?? entry.hireling;
    const matched = rows
      .filter((row) => {
        return (
          row.str('Hireling') === fileName && row.str('HireDesc') === hireDesc && (difficulty === null || difficultyOf(row) === difficulty)
        );
      })
      .sort((a, b) => a.num('Level') - b.num('Level') || a.num('Difficulty') - b.num('Difficulty'));
    const first = matched.at(0);
    if (first === undefined) {
      warnings.push(`mercenaries: ${where}: no hireling.txt row (Hireling "${fileName}", HireDesc "${hireDesc}")`);
      continue;
    }
    for (const row of matched) used.add(row);

    const variant = buildVariant(entry.subtype, difficulty, where, matched, resolve, warnings);
    comparePage(entry, variant, resolve, warnings);

    let group = hirelings.find((known) => known.name === entry.hireling);
    if (group === undefined) {
      group = { slug: mercenarySlug(entry.hireling), name: entry.hireling, act: first.num('Act'), types: [] };
      hirelings.push(group);
    }
    const typeSlug = mercenarySlug(typeName);
    let type = group.types.find((known) => known.slug === typeSlug);
    if (type === undefined) {
      type = { slug: typeSlug, name: typeName, variants: [] };
      group.types.push(type);
    }
    type.variants.push(variant);
  }

  for (const row of rows) {
    if (used.has(row)) continue;
    warnings.push(
      `mercenaries: hireling.txt line ${String(row.line)} (${row.str('Hireling')}, ${row.str('HireDesc')}, difficulty ${row.str('Difficulty')}) is on no row of the skill information page`
    );
  }
  checkSuspects(hirelings, warnings);

  const variants = hirelings.flatMap((group) => group.types.flatMap((type) => type.variants));
  return {
    bundle: { hirelings },
    counts: {
      mercenaryHirelings: hirelings.length,
      mercenaryTypes: hirelings.reduce((sum, group) => sum + group.types.length, 0),
      mercenaryVariants: variants.length,
      mercenaryBands: variants.reduce((sum, variant) => sum + variant.bands.length, 0),
      mercenarySkills: new Set(variants.flatMap((variant) => variant.skills.map((skill) => skill.id))).size,
    },
    warnings,
  };
}

function buildVariant(
  subtype: string,
  difficulty: MercenaryDifficulty | null,
  where: string,
  rows: readonly TsvRow[],
  resolve: (name: string) => SkillDetail | undefined,
  warnings: string[]
): MercenaryVariant {
  const seen = new Map<number, string>();
  const bands: MercenaryBand[] = [];
  const slotRows: TsvRow[] = [];
  for (const row of rows) {
    const band = readBand(row);
    // Gold differs per difficulty by design, everything else at one level must agree
    const text = JSON.stringify({ band, skills: readSkillSlots(row) });
    const earlier = seen.get(band.level);
    if (earlier === undefined) {
      seen.set(band.level, text);
      bands.push(band);
      slotRows.push(row);
    } else if (earlier !== text) {
      warnings.push(`mercenaries: ${where}: level ${String(band.level)} differs between difficulties; showing the first`);
    }
  }

  const skills: MercenarySkill[] = [];
  const firstSlots = readSkillSlots(rows[0]);
  for (const [index, { name }] of firstSlots.entries()) {
    const detail = resolve(name);
    if (detail === undefined) {
      warnings.push(`mercenaries: ${where}: hireling.txt skill "${name}" matches no skill`);
      continue;
    }
    skills.push({
      id: detail.id,
      name: detail.name,
      cls: detail.cls,
      page: detail.page,
      ...(detail.icon === undefined ? {} : { icon: detail.icon }),
      ...(detail.type === undefined ? {} : { type: detail.type }),
      levels: slotRows.map((row) => readSkillSlots(row).at(index)?.level ?? 0),
    });
  }

  const suspects = SUSPECT_DEXTERITY[where];
  if (suspects !== undefined) {
    for (const band of bands) if (suspects[band.level] === band.dexterity) band.dexterityTypo = true;
  }

  return { subtype, difficulty, offers: buildOffers(rows, where, warnings), bands, skills };
}

function buildOffers(rows: readonly TsvRow[], where: string, warnings: string[]): MercenaryVariant['offers'] {
  return MERCENARY_DIFFICULTIES.flatMap((difficulty) => {
    const atDifficulty = rows.filter((row) => difficultyOf(row) === difficulty);
    const first = atDifficulty.at(0);
    if (first === undefined) return [];
    const gold = first.num('Gold');
    if (atDifficulty.some((row) => row.num('Gold') !== gold)) {
      warnings.push(`mercenaries: ${where}: Gold differs between the ${difficulty} level bands; showing the first`);
    }
    return [{ difficulty, gold, levels: atDifficulty.map((row) => row.num('Level')) }];
  });
}

/** Warns when the page's skill list and the file's differ (by resolved id, in any order) */
function comparePage(
  entry: MercenaryRow,
  variant: MercenaryVariant,
  resolve: (name: string) => SkillDetail | undefined,
  warnings: string[]
): void {
  const where = `${entry.hireling} ${entry.subtype}`;
  const fileIds = new Set(variant.skills.map((skill) => skill.id));
  const pageIds = new Set<string>();
  for (const name of entry.skills) {
    const detail = resolve(name);
    if (detail === undefined) warnings.push(`mercenaries: ${where}: skill information page skill "${name}" matches no skill`);
    else pageIds.add(detail.id);
  }
  const onlyPage = [...pageIds].filter((id) => !fileIds.has(id));
  const onlyFile = [...fileIds].filter((id) => !pageIds.has(id));
  if (onlyPage.length > 0 || onlyFile.length > 0) {
    warnings.push(`mercenaries: ${where}: only on the page: [${onlyPage.join(', ')}], only in hireling.txt: [${onlyFile.join(', ')}]`);
  }
}

/** Warns when a SUSPECT_DEXTERITY value is gone from the file, so a fixed typo drops its note and its entry */
function checkSuspects(hirelings: readonly MercenaryHireling[], warnings: string[]): void {
  const variants = hirelings.flatMap((group) =>
    group.types.flatMap((type) => type.variants.map((variant) => ({ key: `${group.name} ${variant.subtype}`, variant })))
  );
  for (const [key, levels] of Object.entries(SUSPECT_DEXTERITY)) {
    const variant = variants.find((entry) => entry.key === key)?.variant;
    if (variant === undefined) continue;
    for (const [level, value] of Object.entries(levels ?? {})) {
      const band = variant.bands.find((entry) => entry.level === Number(level));
      if (band?.dexterity !== value) {
        warnings.push(
          `mercenaries: ${key} level ${level}: the suspect dexterity ${String(value)} is gone from hireling.txt; drop it from SUSPECT_DEXTERITY`
        );
      }
    }
  }
}
