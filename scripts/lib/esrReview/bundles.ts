/**
 * Entry-level diff of the game-data bundles (public/game-data/*.json), HEAD → working tree: each bundle section is
 * compared by a key per entry, never by lines (several bundles pretty-print objects over many lines). The spec below is
 * also the review's coverage list: a bundle file or section it does not name is reported by the self-check.
 */
import { capLines, info, ok, type Check } from './report.ts';

type Entry = Readonly<Record<string, unknown>>;

export type SectionSpec =
  /** An array of objects compared by `key`; `label` names an entry in the output (default: the key) */
  | { kind: 'list'; key: (entry: Entry, index: number) => string; label?: (entry: Entry) => string }
  /** An array of scalars, compared as a multiset of values (positions are the id-shift check's job) */
  | { kind: 'values' }
  /** An object keyed by code or name; each property compared whole */
  | { kind: 'map' }
  /** One value compared whole */
  | { kind: 'value' };

const str = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);
const field = (entry: Entry, ...path: string[]): string => {
  let value: unknown = entry;
  for (const part of path) value = typeof value === 'object' && value !== null ? (value as Entry)[part] : undefined;
  return value === undefined || value === null ? '' : str(value);
};
const codes = (value: unknown): string =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'object' && item !== null ? field(item as Entry, 'code') : str(item))).join('+')
    : '';
const named = (key: string) => (entry: Entry) => `${field(entry, key)} (${field(entry, 'name')})`;
const list = (key: (entry: Entry, index: number) => string, label?: (entry: Entry) => string): SectionSpec => ({
  kind: 'list',
  key,
  label,
});
const byField = (name: string, label?: (entry: Entry) => string): SectionSpec => list((entry) => field(entry, name), label);
const VALUES: SectionSpec = { kind: 'values' };
const MAP: SectionSpec = { kind: 'map' };
const VALUE: SectionSpec = { kind: 'value' };

/**
 * Every bundle file and section the review knows. `null` marks a file another check covers (manifest.json: the
 * versions and manifest checks). Keep in sync with src/features/game-data/build/generateBundles.ts.
 */
export const BUNDLE_SPECS: Readonly<Record<string, Readonly<Record<string, SectionSpec>> | null>> = {
  'manifest.json': null,
  'affixes.json': {
    affixes: list(
      (entry) => `${field(entry, 'kind')}:${field(entry, 'id')}`,
      (entry) => `${field(entry, 'kind')}${field(entry, 'id')} ${field(entry, 'name')}`
    ),
    stats: byField('id', named('id')),
  },
  // map bosses: a changed reward chance, table or shard count means the campaign map panels and the bosses note read differently
  'areas.json': { areas: byField('id', named('id')), mapBosses: byField('id', named('id')) },
  'bases.json': {
    bases: byField('code', named('code')),
    automods: byField('id', named('id')),
    superior: VALUE,
    // qualityitems.txt rows by row number: a changed weight or stat shows as a changed row
    superiorRows: byField('row', (entry) => `row ${field(entry, 'row')} (${field(entry, 'text')})`),
    superiorPools: byField('label'),
  },
  'crafting.json': {
    forgings: list(
      (entry) => `${field(entry, 'kind')}:${field(entry, 'key')}`,
      (entry) => `${field(entry, 'kind')}:${field(entry, 'key')} (${field(entry, 'label')})`
    ),
    stacking: list((entry) => `${field(entry, 'kind')}:${field(entry, 'material', 'code')}:${field(entry, 'switchItem', 'code')}`),
  },
  'cube.json': {
    sections: byField('id'),
    families: byField('id'),
    groups: list((entry) => `${field(entry, 'family')}: ${field(entry, 'label')}`),
    rows: list((entry) => `${field(entry, 'family')}: ${codes(entry.inputs)} → ${field(entry, 'output')}`),
    recipes: list((entry) => `${field(entry, 'family')}: ${field(entry, 'description')}`),
    hidden: MAP,
    // cell text → icon token (i:/t:/u:/s:); a removed key or a changed token changes a cell's picture (icons.cube checks they resolve)
    icons: MAP,
  },
  // elixirs: a changed formula, drop chance or perk fact means the Elixirs page (and the guide's elixirs note) read differently
  'elixirs.json': {
    maxLevel: VALUE,
    elixirs: byField('code', named('code')),
    perks: byField('key', (entry) => `${field(entry, 'key')} (${field(entry, 'title')})`),
    drops: VALUE,
    recipes: byField('id', (entry) => `${field(entry, 'id')} (${field(entry, 'description')})`),
    otherUtilityPotions: VALUES,
  },
  'enhance.json': {
    corruption: VALUE,
    corruptionSlots: byField('slot'),
    corruptionOutcomes: list((entry) => `${field(entry, 'slot')}:${field(entry, 'roll')}`),
    anointment: VALUE,
    anointmentSlots: byField('slot'),
    anointmentOutcomes: list(
      (entry) => `${field(entry, 'pool')}:${field(entry, 'roll')}`,
      (entry) => `${field(entry, 'pool')}:${field(entry, 'roll')} ${field(entry, 'label')}`
    ),
    // jewel sanctification (Lucion's Relic): each roll is one equally likely outcome; builds do not store it
    sanctification: VALUE,
    sanctificationOutcomes: list(
      (entry) => `roll ${field(entry, 'roll')}`,
      (entry) => `roll ${field(entry, 'roll')} (${Array.isArray(entry.lines) ? entry.lines.map(str).join(' / ') : ''})`
    ),
    sanctificationBonuses: byField('line', (entry) => `${field(entry, 'line')} (${field(entry, 'outcomes')} outcomes)`),
    vessel: VALUE,
    vesselTiers: byField('tier'),
    vesselRecipes: list((entry) => `tier ${field(entry, 'tier')}: ${codes(entry.materials)}`),
    vesselTransforms: list((entry) => `${codes(entry.materials)} → ${field(entry, 'output', 'code')}`),
    standardOfHeroes: VALUE,
    standardOfHeroesOutcomes: list((entry) => field(entry, 'charm', 'code')),
  },
  // items: every other item by code (cube, materials, enhance, loot filter browser); types: type ingredients' art
  'icons.json': {
    esrVersion: VALUE,
    esrTag: VALUE,
    vanilla: VALUE,
    bases: MAP,
    uniques: MAP,
    sets: MAP,
    misc: MAP,
    quest: MAP,
    items: MAP,
    types: MAP,
  },
  'itemtext.json': {
    stats: list((entry, index) => `${String(index)} ${field(entry, 'stat')}`),
    strings: MAP,
    skills: byField('id', named('id')),
    classes: byField('name'),
    monsters: VALUES,
    monTypes: VALUES,
    magicPrefixes: VALUES,
    magicSuffixes: VALUES,
    autoAffixes: VALUES,
    rareNames: VALUES,
    lowQuality: VALUES,
    superior: VALUE,
    setBonusPieces: MAP,
    bases: MAP,
    socketables: MAP,
    levels: MAP,
  },
  'lootfilter.json': {
    items: byField('code', named('code')),
    stats: byField('id', named('id')),
    areas: byField('id', named('id')),
    sounds: VALUES,
    uniques: byField('id', named('id')),
    sets: byField('id', named('id')),
    skills: byField('id', named('id')),
    skillNames: MAP,
    knownLayers: byField('stat'),
  },
  // weapon masteries: a changed effect text or skill list means the Bases panel and the skill cards read differently
  'masteries.json': {
    token: VALUE,
    names: MAP,
    skillNames: MAP,
    anyWeaponPerk: VALUE,
    masteries: byField('property', (entry) => `${field(entry, 'property')} (${field(entry, 'label')})`),
    baseNames: MAP,
    noRunewords: VALUE,
    noMasteryBases: byField('code'),
    pageRules: VALUE,
    // a changed difference means the card's "official page reads differently" note reads differently
    pageDiffs: byField('subject'),
  },
  'materials.json': { groups: byField('code'), families: byField('id'), items: byField('code', named('code')) },
  // modifiers: a changed fact (difficultylevels.txt, a plugin config value) means the explanation text needs a re-check
  // mercenaries: a changed skill list, level, stat band or Gold changes the cards and the comparison table
  'mercenaries.json': {
    hirelings: byField('slug', (entry) => `${field(entry, 'slug')} (${field(entry, 'name')})`),
  },
  'modifiers.json': {
    kinds: byField('key', (entry) => `${field(entry, 'key')} (${field(entry, 'title')})`),
    stats: byField('id', (entry) => `${field(entry, 'id')} (${field(entry, 'stat')})`),
    facts: byField('key'),
  },
  'runewords.json': { runewords: byField('key', named('key')) },
  'sets.json': { sets: byField('id') },
  'skilldetails.json': {
    items: list((entry) => `${field(entry, 'kind')}:${field(entry, 'name')}`),
    skills: list((entry) => `${field(entry, 'cls') || 'item'}/${field(entry, 'id')}`),
  },
  // the skill-level calculator: line definitions per skill, the rows / missiles its formulas read, the shared texts
  'skillcalc.json': {
    skills: byField('id'),
    rows: byField('id'),
    missiles: byField('id'),
    texts: VALUES,
  },
  'skills.json': { maxLevel: VALUE, classes: byField('code') },
  // specialisations: a changed perk text, plugin setting, cube / drop link or page difference changes the perk cards
  'specializations.json': {
    rules: VALUE,
    trees: byField('slug', (entry) => `${field(entry, 'slug')} (${field(entry, 'name')})`),
    pageDiffs: byField('subject'),
  },
  'sources.json': { items: list((entry) => `${field(entry, 'item')}:${field(entry, 'name')} (${field(entry, 'code')})`) },
  'stash.json': {
    grid: VALUE,
    stats: list((_entry, index) => `stat ${String(index)}`),
    items: list((entry) => (Array.isArray(entry) ? str(entry[0]) : field(entry, 'code'))),
    coupons: byField('code', named('code')),
    couponTiers: byField('type'),
    gemwords: VALUES,
  },
  'stashnames.json': {
    bases: byField('code', named('code')),
    uniques: byField('id', named('id')),
    setItems: byField('id', named('id')),
    sets: byField('id'),
    runewords: byField('id', (entry) => `${field(entry, 'id')} (${field(entry, 'key')})`),
  },
  // config (seed, start, durations) and the zone order drive every slot of the schedule: any change there moves all of them
  'terrorzones.json': {
    esrVersion: VALUE,
    config: VALUE,
    boosts: list((entry) => `${field(entry, 'version')}:${field(entry, 'difficulty')}`),
    zones: list((entry, index) => `${String(index)}:${field(entry, 'id')}`),
  },
  'tiers.json': { codes: MAP },
  'types.json': { types: byField('code', named('code')), classes: byField('code') },
};

export interface SectionDiff {
  section: string;
  added: string[];
  removed: string[];
  changed: string[];
  /** Entries before / after (null for a missing section) */
  before: number | null;
  after: number | null;
}

export interface BundleDiff {
  file: string;
  sections: SectionDiff[];
  /** Sections of the documents that BUNDLE_SPECS does not name (diffed with a fallback spec) */
  unknownSections: string[];
}

const isRecord = (value: unknown): value is Entry => typeof value === 'object' && value !== null && !Array.isArray(value);

function sizeOf(value: unknown): number | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.length;
  return isRecord(value) ? Object.keys(value).length : 1;
}

/** A spec for a section BUNDLE_SPECS does not know: id / code / key / name when the entries have one. */
export function fallbackSpec(value: unknown): SectionSpec {
  if (isRecord(value)) return MAP;
  if (!Array.isArray(value)) return VALUE;
  const first: unknown = value.find((entry) => entry !== null);
  if (!isRecord(first)) return VALUES;
  const keyField = ['id', 'code', 'key', 'name'].find((name) => name in first);
  return keyField === undefined ? list((_entry, index) => String(index)) : byField(keyField);
}

/** Entries keyed for comparison; a repeated key gets `#2`, `#3` … in order. */
function keyed(value: unknown, spec: Extract<SectionSpec, { kind: 'list' }>): Map<string, { label: string; json: string; raw: unknown }> {
  const result = new Map<string, { label: string; json: string; raw: unknown }>();
  const seen = new Map<string, number>();
  const entries: unknown[] = Array.isArray(value) ? value : [];
  entries.forEach((raw, index) => {
    const entry: Entry = isRecord(raw) ? raw : Array.isArray(raw) ? (raw as unknown as Entry) : { value: raw };
    const base = spec.key(entry, index);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const label = spec.label?.(entry) ?? base;
    result.set(n === 1 ? base : `${base}#${String(n)}`, {
      label: n === 1 ? label : `${label} #${String(n)}`,
      json: JSON.stringify(raw),
      raw,
    });
  });
  return result;
}

/** ` [rows, reqLvl]`: the top-level fields of two objects that differ (empty for other shapes). */
export function changedFields(before: unknown, after: unknown): string {
  if (!isRecord(before) || !isRecord(after)) return '';
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (name) => JSON.stringify(before[name]) !== JSON.stringify(after[name])
  );
  return fields.length === 0 ? '' : ` [${fields.slice(0, 6).join(', ')}${fields.length > 6 ? ', …' : ''}]`;
}

const shown = (value: unknown) => (value === undefined ? '—' : str(value));

function multiset(value: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of Array.isArray(value) ? (value as unknown[]) : []) {
    const key = str(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Added / removed / changed entries of one section (labels). */
export function diffSection(section: string, before: unknown, after: unknown, spec: SectionSpec): SectionDiff {
  const result: SectionDiff = { section, added: [], removed: [], changed: [], before: sizeOf(before), after: sizeOf(after) };
  switch (spec.kind) {
    case 'value':
      if (JSON.stringify(before) !== JSON.stringify(after))
        result.changed.push(`${section}: ${shown(before)} → ${shown(after)}`.slice(0, 200));
      break;
    case 'values': {
      const a = multiset(before);
      const b = multiset(after);
      for (const [value, n] of b) for (let i = a.get(value) ?? 0; i < n; i++) result.added.push(JSON.stringify(value));
      for (const [value, n] of a) for (let i = b.get(value) ?? 0; i < n; i++) result.removed.push(JSON.stringify(value));
      break;
    }
    case 'map': {
      const a = isRecord(before) ? before : {};
      const b = isRecord(after) ? after : {};
      for (const key of Object.keys(b)) {
        if (!Object.hasOwn(a, key)) result.added.push(key);
        else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) result.changed.push(`${key}${changedFields(a[key], b[key])}`);
      }
      for (const key of Object.keys(a)) if (!Object.hasOwn(b, key)) result.removed.push(key);
      break;
    }
    case 'list': {
      const a = keyed(before, spec);
      const b = keyed(after, spec);
      for (const [key, entry] of b) {
        const old = a.get(key);
        if (old === undefined) result.added.push(entry.label);
        else if (old.json !== entry.json) result.changed.push(`${entry.label}${changedFields(old.raw, entry.raw)}`);
      }
      for (const [key, entry] of a) if (!b.has(key)) result.removed.push(entry.label);
      break;
    }
  }
  return result;
}

/** Diff of one bundle file; `before` / `after` are the parsed documents (null when the file is missing). */
export function diffBundle(file: string, before: unknown, after: unknown): BundleDiff {
  const specs = BUNDLE_SPECS[file] ?? {};
  const a = isRecord(before) ? before : {};
  const b = isRecord(after) ? after : {};
  const names = [...new Set([...Object.keys(specs), ...Object.keys(a), ...Object.keys(b)])];
  const unknownSections = names.filter((name) => !Object.hasOwn(specs, name));
  const sections = names.map((name) =>
    diffSection(name, a[name], b[name], Object.hasOwn(specs, name) ? specs[name] : fallbackSpec(b[name] ?? a[name]))
  );
  return { file, sections, unknownSections };
}

const changedSections = (diff: BundleDiff) =>
  diff.sections.filter((section) => section.added.length + section.removed.length + section.changed.length > 0);

/** One check per bundle file: ok when nothing changed, info listing the changed entries by name. */
export function bundleCheck(diff: BundleDiff, limit = 40): Check {
  const id = `bundle.${diff.file.replace(/\.json$/, '')}`;
  const title = `Bundle entries: ${diff.file}`;
  const sections = changedSections(diff);
  if (sections.length === 0) return ok(id, title, 'No entry changed.');
  const lines: string[] = [];
  for (const section of sections) {
    const size =
      section.before === section.after ? String(section.after ?? 0) : `${String(section.before ?? '—')} → ${String(section.after ?? '—')}`;
    lines.push(
      `${section.section} (${size}): +${String(section.added.length)} -${String(section.removed.length)} ~${String(section.changed.length)}`
    );
  }
  const entries = sections.flatMap((section) => [
    ...section.added.map((label) => `+ ${section.section}: ${label}`),
    ...section.removed.map((label) => `- ${section.section}: ${label}`),
    ...section.changed.map((label) => `~ ${section.section}: ${label}`),
  ]);
  const summary = sections.map((section) => section.section).join(', ');
  return info(id, title, `Changed sections: ${summary}.`, [...lines, ...capLines(entries, limit)]);
}
