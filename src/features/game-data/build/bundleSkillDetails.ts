/**
 * skilldetails.json: the Skills page's details of every class skill and of every described item skill an item grants.
 *
 * - Skills: skills.txt rows with a class `charclass` and a skilldesc row on page 1..3 (the skills.json trees), plus
 *   class-less rows with a skilldesc row that some unique, set item or runes.txt recipe grants ("item skills").
 * - Text: skilldesc `str name` / `str long` through the strings (`str short` is identical in ESR and not stored).
 *   `lines`: descline1..6 / dsc2line1..5 whose values are constants or skill params (`par8`); any line that needs
 *   a calc formula, a second text (`textb`) or an unresolved string is left out (the calculator evaluates those). In
 *   tooltip order: the dsc2 block bottom-up, then the desc block bottom-up (as engine/skillCalc `tooltipOrder`).
 *   `synergies`: dsc3 lines after the `Sksyn` header whose textb is a skill name (and the old 63 / 67 / 25 layouts,
 *   texta = the skill name); `comboBonuses`: the "If both A and B have 20 levels:" texts; other dsc3 texts are `notes`.
 * - Mana: (mana | lvlmana) × 2^manashift / 256, the cost at level 1 and per extra level.
 * - Icon: `<first two letters of the class code>-<IconCel>` (the class sheet hd/global/ui/spells/<class>/<xx>skillicon),
 *   `gen-<IconCel>` for item skills (the shared hd/global/ui/spells/submenu/skillicon sheet, where Attack, Kick, Throw
 *   and Unsummon live). scripts/generate-skill-icons.ts crops the cels.
 * - grantedBy: the visible skill properties (GRANT_PROPERTIES) of uniqueitems prop1..12, setitems prop1..9 and
 *   aprop1..5 a/b (partial), runes.txt T1Code1..7. Hidden variants (`oskill-hidden`, …), random skills
 *   (`skill-rand`, `oskill-rand`) and property groups are not followed.
 * See docs/features/SKILLS.md.
 */
import type {
  ClassCode,
  SkillComboBonus,
  SkillDetail,
  SkillDetailsBundle,
  SkillGrant,
  SkillGrantHow,
  SkillGrantItem,
  SkillGrantItemKind,
  SkillSynergy,
} from '../engine/schema.ts';
import { resolveName } from './itemNames.ts';
import { readMods, type PropertyMod, type RuneRecipeRow } from './model.ts';
import { sprintf, type SprintfArg } from '../engine/stats/sprintf.ts';
import type { TsvRow, TsvTable } from './tsv.ts';
import { bottomUp } from '../engine/skillCalc/text.ts';

export { bottomUp };

export const GRANT_PROPERTIES: readonly SkillGrantHow[] = [
  'oskill',
  'skill',
  'aura',
  'charged',
  'hit-skill',
  'att-skill',
  'gethit-skill',
  'kill-skill',
  'death-skill',
  'levelup-skill',
  'cast-skill',
  'takedmg-skill',
];
const EVENT_PROPERTIES = new Set<SkillGrantHow>([
  'hit-skill',
  'att-skill',
  'gethit-skill',
  'kill-skill',
  'death-skill',
  'levelup-skill',
  'cast-skill',
  'takedmg-skill',
]);
const ITEM_KIND_ORDER: readonly SkillGrantItemKind[] = ['unique', 'set', 'runeword', 'gemword'];

/** skills.txt EType → label (unknown codes are kept as written) */
export const ELEMENT_LABELS: Readonly<Record<string, string>> = {
  fire: 'Fire',
  ltng: 'Lightning',
  cold: 'Cold',
  pois: 'Poison',
  mag: 'Magic',
  phys: 'Physical',
  stun: 'Stun',
  burn: 'Fire (burning)',
  frze: 'Freeze',
  life: 'Life drain',
  mana: 'Mana drain',
  stam: 'Stamina drain',
  div: 'Holy',
};

const SYNERGY_HEADER = 'Sksyn';
const DESC_LINES = 6;
const DSC2_LINES = 5;
const DSC3_LINES = 7;
const PAGES = [1, 2, 3];

/** One item whose properties may grant skills */
export interface GrantSource {
  kind: SkillGrantItemKind;
  name: string;
  mods: readonly PropertyMod[];
  /** Set items: partial bonuses (aprop*) */
  partialMods?: readonly PropertyMod[];
}

export interface SkillDetailsInput {
  skills: TsvTable;
  skilldesc: TsvTable;
  classes: readonly { code: string }[];
  strings: ReadonlyMap<string, string>;
  items: readonly GrantSource[];
}

export interface SkillDetailsBuildResult {
  bundle: SkillDetailsBundle;
  /** Grants of a skill without a skilldesc row (procs, internal skills): not listed */
  undescribedGrants: number;
  warnings: string[];
}

interface SkillRowInfo {
  row: TsvRow;
  id: string;
  cls: string;
}

/** Skill name prop param → skills.txt row: exact name, then case-insensitive, then a numeric row id. */
function createSkillResolver(rows: readonly SkillRowInfo[]) {
  const byName = new Map<string, SkillRowInfo>();
  const byLower = new Map<string, SkillRowInfo>();
  for (const info of rows) {
    if (!byName.has(info.id)) byName.set(info.id, info);
    const lower = info.id.toLowerCase();
    if (!byLower.has(lower)) byLower.set(lower, info);
  }
  return (param: string): SkillRowInfo | undefined =>
    byName.get(param) ?? byLower.get(param.toLowerCase()) ?? (/^\d+$/.test(param) ? rows[Number(param)] : undefined);
}

/**
 * A calc that is a constant or uses only skill params: integers, `parN`, + - * / and parentheses. Anything else
 * (`clc4`, `ln12`, `usmc`, skill references) → null.
 */
export function evalSimpleCalc(calc: string, params: (n: number) => number): number | null {
  const text = calc.replace(/^"|"$/g, '').trim();
  if (text === '' || !/^[\d\s+\-*/()par]+$/.test(text)) return null;
  const tokens = text.match(/par\d+|\d+|[+\-*/()]/g);
  if (tokens === null || tokens.join('') !== text.replace(/\s+/g, '')) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const primary = (): number | null => {
    const token = tokens.at(pos++);
    if (token === undefined) return null;
    if (token === '(') {
      const value = sum();
      if (tokens[pos++] !== ')') return null;
      return value;
    }
    if (token === '-') {
      const value = primary();
      return value === null ? null : -value;
    }
    if (token.startsWith('par')) return params(Number(token.slice(3)));
    return /^\d+$/.test(token) ? Number(token) : null;
  };
  const product = (): number | null => {
    let value = primary();
    while (value !== null && (peek() === '*' || peek() === '/')) {
      const op = tokens[pos++];
      const right = primary();
      if (right === null || (op === '/' && right === 0)) return null;
      value = op === '*' ? value * right : Math.trunc(value / right);
    }
    return value;
  };
  const sum = (): number | null => {
    let value = product();
    while (value !== null && (peek() === '+' || peek() === '-')) {
      const op = tokens[pos++];
      const right = product();
      if (right === null) return null;
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  return pos === tokens.length ? value : null;
}

const PLACEHOLDER = /%(\+d|d|i|s|[0-9])/g;

function placeholderCount(format: string): number {
  return (format.match(PLACEHOLDER) ?? []).length;
}

/** Rounds a mana value to 1/1000 (manashift gives fractions like 0.625) */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildSkillDetailsBundle(input: SkillDetailsInput): SkillDetailsBuildResult {
  const warnings: string[] = [];
  const { strings } = input;
  const descs = new Map<string, TsvRow>();
  for (const row of input.skilldesc.rows) {
    const id = row.str('skilldesc');
    if (id !== '' && !descs.has(id)) descs.set(id, row);
  }
  const classCodes = input.classes.map((cls) => cls.code);
  const rows: SkillRowInfo[] = input.skills.rows.map((row) => ({ row, id: row.str('skill'), cls: row.str('charclass') }));
  const resolveSkill = createSkillResolver(rows);

  // --- grants --------------------------------------------------------------------------------------------------------
  const itemKeys = new Map<string, SkillGrantItem>();
  const grantsBySkill = new Map<string, { item: SkillGrantItem; grant: Omit<SkillGrant, 'item'> }[]>();
  const grantKeys = new Set<string>();
  const unknownSkills = new Set<string>();
  let undescribedGrants = 0;
  const addGrant = (source: GrantSource, mod: PropertyMod, partial: boolean) => {
    const how = GRANT_PROPERTIES.find((code) => code === mod.code);
    if (how === undefined || mod.param === null) return;
    const skill = resolveSkill(mod.param);
    if (skill === undefined) {
      unknownSkills.add(`${mod.code} "${mod.param}" (${source.name})`);
      return;
    }
    const isClassSkill = classCodes.includes(skill.cls);
    if (!isClassSkill && !descs.has(skill.row.str('skilldesc'))) {
      undescribedGrants++;
      return;
    }
    const itemKey = `${source.kind}\t${source.name}`;
    let item = itemKeys.get(itemKey);
    if (item === undefined) {
      item = { kind: source.kind, name: source.name };
      itemKeys.set(itemKey, item);
    }
    const grant: Omit<SkillGrant, 'item'> = { how, level: mod.min === mod.max ? mod.min : [mod.min, mod.max] };
    if (how === 'charged') {
      grant.charges = mod.min;
      grant.level = mod.max;
    } else if (EVENT_PROPERTIES.has(how)) {
      grant.chance = mod.min;
      grant.level = mod.max;
    }
    if (partial) grant.partial = true;
    const key = [skill.id, itemKey, JSON.stringify(grant)].join('\t');
    if (grantKeys.has(key)) return;
    grantKeys.add(key);
    grantsBySkill.set(skill.id, [...(grantsBySkill.get(skill.id) ?? []), { item, grant }]);
  };
  for (const source of input.items) {
    for (const mod of source.mods) addGrant(source, mod, false);
    for (const mod of source.partialMods ?? []) addGrant(source, mod, true);
  }
  for (const entry of [...unknownSkills].sort()) warnings.push(`skilldetails: unknown skill in ${entry}`);

  const items = [...itemKeys.values()].sort(
    (a, b) => ITEM_KIND_ORDER.indexOf(a.kind) - ITEM_KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, 'en')
  );
  const itemIndex = new Map(items.map((item, i) => [item, i]));

  // --- skills --------------------------------------------------------------------------------------------------------
  const nameOf = (key: string, fallback: string, what: string): string => {
    if (key !== '' && !strings.has(key)) warnings.push(`skilldetails: ${what} string "${key}" not in the strings`);
    return resolveName(strings, key, fallback);
  };
  // Display name → skill ids, for the synergy links (filled before the synergies are read)
  const idsByName = new Map<string, SkillRowInfo[]>();

  interface Pending {
    info: SkillRowInfo;
    desc: TsvRow;
    detail: SkillDetail;
    order: number[];
  }
  const pending: Pending[] = [];
  for (const info of rows) {
    if (info.id === '') continue;
    const desc = descs.get(info.row.str('skilldesc'));
    const classIndex = classCodes.indexOf(info.cls);
    if (desc === undefined) continue;
    if (classIndex === -1) {
      if (info.cls !== '' || !grantsBySkill.has(info.id)) continue;
    } else if (!PAGES.includes(desc.num('SkillPage'))) continue;
    if (pending.some((entry) => entry.info.id === info.id)) {
      warnings.push(`skilldetails: duplicate skills.txt id "${info.id}" (first row kept)`);
      continue;
    }
    const name = nameOf(desc.str('str name'), info.id, `skill "${info.id}" name`);
    const detail = readDetail(info, desc, name, classIndex === -1 ? null : (info.cls as ClassCode), strings, warnings);
    const order =
      classIndex === -1 ? [classCodes.length] : [classIndex, desc.num('SkillPage'), desc.num('SkillRow'), desc.num('SkillColumn')];
    pending.push({ info, desc, detail, order });
    idsByName.set(name.toLowerCase(), [...(idsByName.get(name.toLowerCase()) ?? []), info]);
  }

  for (const entry of pending) {
    const { synergies, comboBonuses, notes } = readSynergies(entry.desc, entry.info, strings, idsByName, warnings);
    if (synergies.length > 0) entry.detail.synergies = synergies;
    if (comboBonuses.length > 0) entry.detail.comboBonuses = comboBonuses;
    if (notes.length > 0) entry.detail.notes = notes;
    const grants = (grantsBySkill.get(entry.info.id) ?? [])
      .map(({ item, grant }): SkillGrant => ({ item: itemIndex.get(item) ?? -1, ...grant }))
      .sort(
        (a, b) =>
          a.item - b.item ||
          GRANT_PROPERTIES.indexOf(a.how) - GRANT_PROPERTIES.indexOf(b.how) ||
          JSON.stringify(a).localeCompare(JSON.stringify(b))
      );
    if (grants.length > 0) entry.detail.grantedBy = grants;
  }

  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  const skills = pending
    .sort((a, b) => compare(a.order, b.order) || a.detail.name.localeCompare(b.detail.name, 'en') || a.info.id.localeCompare(b.info.id))
    .map((entry) => entry.detail);

  return { bundle: { items, skills }, undescribedGrants, warnings };
}

function readDetail(
  info: SkillRowInfo,
  desc: TsvRow,
  name: string,
  cls: ClassCode | null,
  strings: ReadonlyMap<string, string>,
  warnings: string[]
): SkillDetail {
  const { row } = info;
  const detail: SkillDetail = {
    id: info.id,
    name,
    cls,
    page: cls === null ? null : desc.num('SkillPage'),
    reqLevel: row.num('reqlevel'),
    maxLevel: row.num('maxlvl'),
    description: [],
  };
  const reqSkills = [row.str('reqskill1'), row.str('reqskill2'), row.str('reqskill3')].filter((req) => req !== '');
  if (reqSkills.length > 0) detail.reqSkills = reqSkills;
  if (row.str('aura') === '1') detail.type = 'aura';
  else if (row.str('passive') === '1') detail.type = 'passive';
  const element = row.str('EType');
  if (element !== '') detail.element = ELEMENT_LABELS[element] ?? element;
  const shift = 2 ** row.num('manashift') / 256;
  const mana = round(row.num('mana') * shift);
  const perLevel = round(row.num('lvlmana') * shift);
  if (mana !== 0 || perLevel !== 0) detail.mana = [mana, perLevel];

  const longKey = desc.str('str long');
  const long = strings.get(longKey);
  if (longKey !== '' && long === undefined)
    warnings.push(`skilldetails: skill "${info.id}" description string "${longKey}" not in the strings`);
  const lines = (long ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  // Stub descriptions repeat the name (ESR's Lightning Flash: str long = the name key)
  detail.description = lines.length === 1 && lines[0] === name ? [] : lines;

  const params = (n: number) => (row.has(`Param${String(n)}`) ? row.num(`Param${String(n)}`) : 0);
  const readLine = (prefix: string, i: number, into: string[]) => {
    const n = String(i);
    const textKey = desc.str(`${prefix}texta${n}`);
    if (textKey === '' || desc.str(`${prefix}textb${n}`) !== '') return;
    const format = strings.get(textKey);
    if (format === undefined) return;
    const calcs = [desc.str(`${prefix}calca${n}`), desc.str(`${prefix}calcb${n}`)].filter((calc) => calc !== '');
    const needed = placeholderCount(format);
    if (needed > calcs.length) return;
    const args: SprintfArg[] = [];
    for (const calc of calcs.slice(0, needed)) {
      const value = evalSimpleCalc(calc, params);
      if (value === null) return;
      args.push(value);
    }
    const line = bottomUp(sprintf(format, args));
    // A label whose value is a formula line of its own ("Attack Rating:") says nothing alone
    if (line !== '' && !line.endsWith(':')) into.push(line);
  };
  const descBlock: string[] = [];
  const dsc2Block: string[] = [];
  for (let i = 1; i <= DESC_LINES; i++) if (desc.has(`desctexta${String(i)}`)) readLine('desc', i, descBlock);
  for (let i = 1; i <= DSC2_LINES; i++) if (desc.has(`dsc2texta${String(i)}`)) readLine('dsc2', i, dsc2Block);
  // Tooltip order, as the calculator shows them: the game adds the desc and dsc2 lines bottom-up and draws the dsc2
  // block above the desc block (engine/skillCalc tooltipOrder)
  const fixed = [...dsc2Block.reverse(), ...descBlock.reverse()];
  if (fixed.length > 0) detail.lines = fixed;

  const cel = desc.str('IconCel');
  if (cel !== '' && /^\d+$/.test(cel)) detail.icon = `${cls === null ? 'gen' : cls.slice(0, 2)}-${cel}`;
  return detail;
}

/** A combo bonus's condition line: "If both A and B have 20 levels:", "If All Elemental Armors have 20 levels:" */
const COMBO_CONDITION = /^(If (?:both )?(.+?) (?:have|has) (\d+) levels?):$/;
/**
 * Group names of a combo condition → the skills its formula reads. Fanatic Swing: `(skill('Fire Armor'.blvl)+
 * skill('Shiver Armor'.blvl)+skill('Shock Armor'.blvl))==60`. "Any Finishing Move" (Blade Nova) is left as written:
 * its formula does not match the text (`(Dragon Tail==20)+(Iaigiri==20)+(Dragon Talon==20)*(Blade Nova==20)>0`).
 */
const COMBO_GROUPS: Readonly<Record<string, readonly string[]>> = {
  'All Elemental Armors': ['Fire Armor', 'Shiver Armor', 'Shock Armor'],
};

/** A combo bonus before its skill names are resolved */
export interface ComboBonusText {
  condition: string;
  names: string[];
  level: number;
  text: string[];
}

/**
 * Splits a dsc3 text (in reading order) into its combo bonuses (a condition line and the lines under it, up to the next
 * condition) and the lines before the first condition. "If both A and B" names two skills; any other wording names one
 * group as written ("All Elemental Armors").
 */
export function splitComboBonuses(text: string): { combos: ComboBonusText[]; rest: string[] } {
  const combos: ComboBonusText[] = [];
  const rest: string[] = [];
  for (const line of text.split('\n').map((entry) => entry.trim())) {
    if (line === '') continue;
    const match = COMBO_CONDITION.exec(line);
    if (match !== null) {
      const [, condition, names, level] = match;
      const pair = condition.startsWith('If both ');
      combos.push({ condition, names: pair ? names.split(' and ') : [names], level: Number(level), text: [] });
      continue;
    }
    const current = combos.at(-1);
    if (current === undefined) rest.push(line);
    else current.text.push(line);
  }
  return { combos, rest };
}

/** "+15% All Damage per Level": a type 63 / 67 synergy value (`?` when the calc is a formula) */
function plusValue(value: number | null): string {
  return value === null ? '+?' : sprintf('%+d', [value]);
}

function readSynergies(
  desc: TsvRow,
  info: SkillRowInfo,
  strings: ReadonlyMap<string, string>,
  idsByName: ReadonlyMap<string, SkillRowInfo[]>,
  warnings: string[]
): { synergies: SkillSynergy[]; comboBonuses: SkillComboBonus[]; notes: string[] } {
  const synergies: SkillSynergy[] = [];
  const comboBonuses: SkillComboBonus[] = [];
  const notes: string[] = [];
  const params = (n: number) => (info.row.has(`Param${String(n)}`) ? info.row.num(`Param${String(n)}`) : 0);
  const findId = (name: string) => {
    const matches = idsByName.get(name.toLowerCase()) ?? [];
    return (matches.find((match) => match.cls === info.cls) ?? matches.at(0))?.id;
  };
  // Combo conditions name class skills: an item skill's copy of the tooltip (Maelstrom Cascade Proc) links the class skill
  const findComboId = (name: string) => {
    const matches = idsByName.get(name.toLowerCase()) ?? [];
    return (
      matches.find((match) => match.cls === info.cls && match.cls !== '') ??
      matches.find((match) => match.cls !== '') ??
      matches.at(0)
    )?.id;
  };
  const synergy = (name: string, text: string | undefined): SkillSynergy => {
    const entry: SkillSynergy = { name };
    const id = findId(name);
    if (id !== undefined && id !== name) entry.id = id;
    if (text !== undefined && text !== '') entry.text = text;
    return entry;
  };
  for (let i = 1; i <= DSC3_LINES; i++) {
    const n = String(i);
    if (!desc.has(`dsc3texta${n}`)) break;
    const textKey = desc.str(`dsc3texta${n}`);
    if (textKey === '' || textKey === SYNERGY_HEADER) continue;
    // Line function 0 / blank: the game shows nothing (ESR's Skeleton Mastery keeps an orphan "Magi, Skeleton King")
    const type = desc.has(`dsc3line${n}`) ? Number(desc.str(`dsc3line${n}`)) : null;
    if (type === 0) continue;
    const format = strings.get(textKey);
    if (format === undefined) {
      warnings.push(`skilldetails: skill "${info.id}" dsc3 string "${textKey}" not in the strings`);
      continue;
    }
    const nameKey = desc.str(`dsc3textb${n}`);
    const textB = nameKey === '' ? undefined : strings.get(nameKey);
    // The old synergy layouts: texta is the skill name, textb the bonus ("Fists of Fire: +15% All Damage per Level",
    // "Lycanthropy: +1 Second per Level", "Inner Sight" + ": +0.20 Seconds per Level")
    if (type === 63 || type === 67 || type === 25) {
      const value = evalSimpleCalc(desc.str(`dsc3calca${n}`), params);
      const bonus = (textB ?? '').trim();
      const text =
        type === 25 ? bonus.replace(/^:\s*/, '') : `${plusValue(value)}${type === 63 ? '%' : ''}${bonus === '' ? '' : ` ${bonus}`}`;
      synergies.push(synergy(format.trim(), text));
      continue;
    }
    if (textB !== undefined && format.includes('%s')) {
      const entry = synergy(textB.trim(), undefined);
      const calcs = [desc.str(`dsc3calca${n}`), desc.str(`dsc3calcb${n}`)];
      const values = calcs.map((calc) => (calc === '' ? null : evalSimpleCalc(calc, params)));
      let next = 0;
      const text = format
        .replace(/^%s:\s*/, '')
        .replace(PLACEHOLDER, (token) => {
          if (token === '%s') return entry.name;
          const value = values.at(next++);
          if (value === null || value === undefined) return token === '%+d' ? '+?' : '?';
          return sprintf(token, [value]);
        })
        .replace(/%%/g, '%')
        .trim();
      if (text !== '') entry.text = text;
      synergies.push(entry);
      continue;
    }
    // A bare skill name (line 18 lists without a bonus) is a synergy too
    const plain = format.trim();
    const id = findId(plain);
    if (id !== undefined && nameKey === '') {
      synergies.push(id === plain ? { name: plain } : { name: plain, id });
      continue;
    }
    if (placeholderCount(plain) > 0) continue;
    const reading = bottomUp(plain.replace(/%%/g, '%'));
    // A one-line "Skill: bonus" text is a synergy written out (Dance of Death's "Spearstorm: +0.5% Chance to Deal …")
    const written = /^([^:\n]+): (.+)$/.exec(reading);
    if (written !== null && findId(written[1]) !== undefined) {
      synergies.push(synergy(written[1], written[2]));
      continue;
    }
    const { combos, rest } = splitComboBonuses(reading);
    if (rest.length > 0) notes.push(rest.join('\n'));
    for (const combo of combos) {
      if (combo.text.length === 0) warnings.push(`skilldetails: skill "${info.id}" combo bonus "${combo.condition}" has no text`);
      comboBonuses.push({
        condition: combo.condition,
        skills: combo.names.flatMap((name) =>
          (COMBO_GROUPS[name] ?? [name]).map((skill) => {
            const comboId = findComboId(skill);
            return comboId === undefined ? { name: skill } : { name: skill, id: comboId };
          })
        ),
        level: combo.level,
        text: combo.text,
      });
    }
  }
  return { synergies, comboBonuses, notes };
}

/** The items that may grant skills: uniqueitems.txt (prop1..12), setitems.txt (prop1..9, aprop1..5 a/b), runes.txt. */
export function readGrantSources(input: {
  uniqueitems: TsvTable;
  setitems: TsvTable;
  runes: readonly RuneRecipeRow[];
  strings: ReadonlyMap<string, string>;
  /** misc.txt codes of runes: a runes.txt recipe with one is a runeword, other recipes are gemwords */
  isRune: (code: string) => boolean;
}): GrantSource[] {
  const sources: GrantSource[] = [];
  const disabled = (row: TsvRow) => row.has('disabled') && row.str('disabled') === '1';
  const own = { code: 'prop', param: 'par', min: 'min', max: 'max' } as const;
  const partial = { code: 'aprop', param: 'apar', min: 'amin', max: 'amax' } as const;
  for (const row of input.uniqueitems.rows) {
    const index = row.str('index');
    if (index === '' || disabled(row)) continue;
    const mods = readMods(row, 12, (i, part) => `${own[part]}${String(i)}`);
    sources.push({ kind: 'unique', name: resolveName(input.strings, index, index), mods });
  }
  for (const row of input.setitems.rows) {
    const index = row.str('index');
    if (index === '') continue;
    const mods = readMods(row, 9, (i, part) => `${own[part]}${String(i)}`);
    const partialMods = ['a', 'b'].flatMap((side) => readMods(row, 5, (i, part) => `${partial[part]}${String(i)}${side}`));
    sources.push({ kind: 'set', name: resolveName(input.strings, index, index), mods, partialMods });
  }
  for (const recipe of input.runes) {
    if (recipe.key === '') continue;
    const name = resolveName(input.strings, recipe.key, '');
    if (name === '') continue;
    sources.push({ kind: recipe.codes.some((code) => input.isRune(code)) ? 'runeword' : 'gemword', name, mods: recipe.mods });
  }
  return sources;
}
