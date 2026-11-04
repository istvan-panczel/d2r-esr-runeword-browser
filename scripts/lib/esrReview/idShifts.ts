/**
 * Id → name maps of the id spaces players store: loot filters (unique, set, stat, area, skill and sound row ids) and
 * stash files (unique / set item row ids, runeword string ids, affix and name table indexes, stat save widths). A
 * shift (the same id names something else, or is gone) silently retargets saved filters and old stash files.
 */
import { capLines, finding, ok, type Check } from './report.ts';

type Doc = Readonly<Record<string, unknown>>;

export interface IdSpace {
  /** `<file> <section>` */
  label: string;
  /** id → name */
  map: Map<string, string>;
}

export interface IdShift {
  id: string;
  before: string;
  /** null: the id is gone */
  after: string | null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));
const section = (doc: Doc | null, name: string): unknown[] => {
  const value = doc?.[name];
  return Array.isArray(value) ? (value as unknown[]) : [];
};

/** `{ id, <nameField> }` rows → id → name. */
function byId(doc: Doc | null, name: string, nameField = 'name'): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of section(doc, name)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Doc;
    map.set(text(row.id), text(row[nameField]));
  }
  return map;
}

/** Scalar arrays (or arrays of rows) addressed by position → index → value. */
function byIndex(doc: Doc | null, name: string, pick: (entry: unknown) => unknown = (entry) => entry): Map<string, string> {
  return new Map(section(doc, name).map((entry, index) => [String(index), text(pick(entry))]));
}

/** The id spaces of one side (HEAD or working tree); a missing bundle gives empty maps. */
export function idSpaces(bundles: {
  lootfilter: Doc | null;
  stashnames: Doc | null;
  itemtext: Doc | null;
  stash: Doc | null;
}): { file: string; spaces: IdSpace[] }[] {
  const { lootfilter, stashnames, itemtext, stash } = bundles;
  const statName = (entry: unknown) => (typeof entry === 'object' && entry !== null ? (entry as Doc).stat : entry);
  return [
    {
      file: 'lootfilter.json',
      spaces: [
        { label: 'lootfilter.json uniques', map: byId(lootfilter, 'uniques') },
        { label: 'lootfilter.json sets', map: byId(lootfilter, 'sets') },
        { label: 'lootfilter.json stats', map: byId(lootfilter, 'stats') },
        { label: 'lootfilter.json areas', map: byId(lootfilter, 'areas') },
        { label: 'lootfilter.json skills', map: byId(lootfilter, 'skills') },
        { label: 'lootfilter.json sounds', map: byIndex(lootfilter, 'sounds') },
      ],
    },
    {
      file: 'stashnames.json',
      spaces: [
        { label: 'stashnames.json uniques', map: byId(stashnames, 'uniques') },
        { label: 'stashnames.json setItems', map: byId(stashnames, 'setItems') },
        { label: 'stashnames.json runewords', map: byId(stashnames, 'runewords', 'key') },
      ],
    },
    {
      file: 'itemtext.json',
      spaces: [
        { label: 'itemtext.json stats', map: byIndex(itemtext, 'stats', statName) },
        { label: 'itemtext.json skills', map: byId(itemtext, 'skills') },
        ...['magicPrefixes', 'magicSuffixes', 'autoAffixes', 'rareNames', 'monsters', 'monTypes', 'lowQuality'].map((name) => ({
          label: `itemtext.json ${name}`,
          map: byIndex(itemtext, name),
        })),
      ],
    },
    { file: 'stash.json', spaces: [{ label: 'stash.json stats (save bits, save add, has param)', map: byIndex(stash, 'stats') }] },
  ];
}

/** Ids whose name changed or that disappeared (new ids at the end are not shifts). */
export function findShifts(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): IdShift[] {
  const shifts: IdShift[] = [];
  for (const [id, name] of before) {
    const now = after.get(id);
    if (now !== name) shifts.push({ id, before: name, after: now ?? null });
  }
  return shifts;
}

const WHY: Readonly<Record<string, string>> = {
  'lootfilter.json':
    "players' saved and shared loot filters store these ids, so their rules now match other items, stats, areas, skills or sounds",
  'stashnames.json': 'old stash uploads are re-parsed with the new names, so stored unique, set and runeword ids show as other items',
  'itemtext.json': 'stash item text resolves affixes, rare names and monsters by index, so old stash files read with other names',
  'stash.json': 'the stash parser reads each saved stat with these widths, so a stash written by the old version misparses',
};

/** One check per file: ok, or a finding listing every shift (capped). */
export function idShiftChecks(before: ReturnType<typeof idSpaces>, after: ReturnType<typeof idSpaces>): Check[] {
  return before.map(({ file, spaces }, index) => {
    const id = `ids.${file.replace(/\.json$/, '')}`;
    const title = `Id shifts: ${file}`;
    const nowSpaces = after[index].spaces;
    const lines: string[] = [];
    const sizes: string[] = [];
    let total = 0;
    spaces.forEach((space, i) => {
      const shifts = findShifts(space.map, nowSpaces[i].map);
      total += shifts.length;
      const label = space.label.replace(`${file} `, '');
      sizes.push(
        `${label} ${String(space.map.size)}${space.map.size === nowSpaces[i].map.size ? '' : ` → ${String(nowSpaces[i].map.size)}`}`
      );
      for (const shift of shifts) {
        lines.push(
          `${label} ${shift.id}: ${JSON.stringify(shift.before)} → ${shift.after === null ? '(gone)' : JSON.stringify(shift.after)}`
        );
      }
    });
    if (total === 0) return ok(id, title, `No id names something else (${sizes.join(', ')}).`);
    return finding(
      id,
      title,
      `${String(total)} ids changed meaning (${sizes.join(', ')})`,
      WHY[file] ?? 'stored ids point at other rows',
      capLines(lines)
    );
  });
}
