/**
 * Skill names inside item property lines ("+3 to Fire Ball (Sorceress Only)", "Level 15 Fanaticism Aura When
 * Equipped", "10% Chance to Cast Level 5 Frost Nova on Striking", "Level 3 Teleport (20/20 Charges)"): which known
 * template a line matches, which skill it names and the level it gives. Only whole lines of these templates are read,
 * never skill names in other prose. See docs/features/SKILLS.md ("Skill peek on item lines").
 */
import type {
  ClassCode,
  SkillDetail,
  SkillDetailsBundle,
  SkillGrant,
  SkillGrantHow,
  SkillGrantItemKind,
} from '@/features/game-data/engine/schema';
import { normaliseItemName } from '@/core/utils/itemName';
import type { SkillRef, SkillRefKind } from './skillRefData';

export type { SkillRef, SkillRefKind } from './skillRefData';

// Copies of skills.ts / skillLevels.ts values (skillRefs.test.ts checks they match): importing those modules would
// pull the skill calculator into every item page's chunk, and the lines need none of it.
/** skills.ts SKILLS_ROUTE */
export const ROUTE = 'skills';
/** skills.ts SKILLS_URL_PARAMS.SKILL / .LEVEL */
export const SKILL_PARAM = 'skill';
export const LEVEL_PARAM = 'lvl';
/** skillLevels.ts DEFAULT_SKILL_LEVEL / MAX_LEVEL */
export const PAGE_DEFAULT_LEVEL = 20;
export const LEVEL_CAP = 110;

function clampLevel(level: number): number {
  return Math.min(LEVEL_CAP, Math.max(1, Math.trunc(level)));
}

export const CLASS_NAMES: Readonly<Record<ClassCode, string>> = {
  ama: 'Amazon',
  sor: 'Sorceress',
  nec: 'Necromancer',
  pal: 'Paladin',
  bar: 'Barbarian',
  dru: 'Druid',
  ass: 'Assassin',
  war: 'Warlock',
};

const CLASS_BY_NAME: ReadonlyMap<string, ClassCode> = new Map(
  Object.entries(CLASS_NAMES).map(([code, name]) => [name.toLowerCase(), code as ClassCode])
);

/** The chance-to-cast events as the item lines word them (lower case) → the property that grants them */
const EVENTS: Readonly<Partial<Record<string, SkillGrantHow>>> = {
  'on striking': 'hit-skill',
  'on melee attack': 'att-skill',
  'on attack': 'att-skill',
  'when struck': 'gethit-skill',
  'when you kill an enemy': 'kill-skill',
  'when you die': 'death-skill',
  'on casting a skill': 'cast-skill',
  'when taking damage': 'takedmg-skill',
  'when you level up': 'levelup-skill',
  'when you level-up': 'levelup-skill',
};

const PLUS_HOWS: ReadonlySet<SkillGrantHow> = new Set(['skill', 'oskill']);

/** A level or a rolled range: "15", "(10 to 20)" */
const LEVEL = String.raw`(\d+|\(\d+ to \d+\))`;
/** Footnote marks some HTM lines end with ("…on Striking***") */
const MARKS = String.raw`\**`;
const EVENT_PATTERN = Object.keys(EVENTS).join('|');

// `d`: group indices place the anchor on the name. Every pattern matches the whole line.
const CHANCE = new RegExp(String.raw`^(\d+)% chance to cast level (\d+) (.+?) (${EVENT_PATTERN})${MARKS}$`, 'id');
const AURA = new RegExp(String.raw`^level ${LEVEL} (.+?) aura when equipped${MARKS}$`, 'id');
const CHARGES = new RegExp(String.raw`^level (\d+) (.+?) \((\d+)/(\d+) charges\)${MARKS}$`, 'id');
const PLUS = new RegExp(String.raw`^\+${LEVEL} to (.+?)(?: \((?:all classes|([a-z]+) only)\))?${MARKS}$`, 'id');

/** Lines too long to be one of the templates are skipped without running the patterns */
const MAX_LINE_LENGTH = 160;

export interface SkillRefIndex {
  /** Lower-case skill name → every skill with that name (several for "Amplify Damage", "Empowered Enchant", …) */
  readonly byName: ReadonlyMap<string, readonly SkillDetail[]>;
  readonly byId: ReadonlyMap<string, SkillDetail>;
  /** `<kind>:<normalised name>` → the SkillDetailsBundle.items indexes of that item */
  readonly items: ReadonlyMap<string, ReadonlySet<number>>;
  /** Names more than one skill carries (the peek shows the id suffix then) */
  readonly duplicates: ReadonlySet<string>;
}

/** The item a line belongs to, when the renderer knows it: picks between same-name skills by what the item grants */
export interface SkillRefItem {
  readonly kind: SkillGrantItemKind;
  readonly name: string;
}

export interface SkillRefSegment {
  readonly text: string;
  /** Set on the skill name of a matched line */
  readonly ref?: SkillRef;
}

function itemKey(kind: SkillGrantItemKind, name: string): string {
  return `${kind}:${normaliseItemName(name)}`;
}

export function buildSkillRefIndex(bundle: SkillDetailsBundle): SkillRefIndex {
  const byName = new Map<string, SkillDetail[]>();
  for (const skill of bundle.skills) {
    const key = skill.name.toLowerCase();
    const list = byName.get(key);
    if (list === undefined) byName.set(key, [skill]);
    else list.push(skill);
  }
  const items = new Map<string, Set<number>>();
  bundle.items.forEach((item, i) => {
    const key = itemKey(item.kind, item.name);
    const set = items.get(key);
    if (set === undefined) items.set(key, new Set([i]));
    else set.add(i);
  });
  return {
    byName,
    byId: new Map(bundle.skills.map((skill) => [skill.id, skill])),
    items,
    duplicates: new Set([...byName.values()].filter((list) => list.length > 1).flatMap((list) => list.map((skill) => skill.name))),
  };
}

function parseLevel(text: string): [number, number] {
  const range = /^\((\d+) to (\d+)\)$/.exec(text);
  if (range === null) return [Number(text), Number(text)];
  return [Number(range[1]), Number(range[2])];
}

function grantLevelRange(grant: SkillGrant): readonly [number, number] {
  return typeof grant.level === 'number' ? [grant.level, grant.level] : grant.level;
}

interface Template {
  readonly kind: SkillRefKind;
  /** The name's position in the line */
  readonly start: number;
  readonly end: number;
  readonly name: string;
  readonly level: [number, number];
  readonly hows: ReadonlySet<SkillGrantHow>;
  readonly chance?: number;
  readonly charges?: number;
  readonly event?: string;
  /** plus: the class of "(Sorceress Only)"; undefined for "(All Classes)" or no class */
  readonly classHint?: ClassCode | null;
}

function nameAt(match: RegExpExecArray, group: number): { name: string; start: number; end: number } | null {
  // Every pattern has the `d` flag; a group that did not take part has no position
  const position: [number, number] | undefined = match.indices?.[group];
  if (position === undefined) return null;
  return { name: match[group], start: position[0], end: position[1] };
}

/** An optional group's text: undefined when it did not take part (the array type does not say so) */
function optionalGroup(match: RegExpExecArray, group: number): string | undefined {
  return match.indices?.[group] === undefined ? undefined : match[group];
}

/** The template a line matches, or null */
function matchTemplate(line: string): Template | null {
  const chance = CHANCE.exec(line);
  if (chance !== null) {
    const name = nameAt(chance, 3);
    const event = chance[4].toLowerCase();
    const how = EVENTS[event];
    if (name === null || how === undefined) return null;
    const level = Number(chance[2]);
    return { kind: 'chance', ...name, level: [level, level], hows: new Set([how]), chance: Number(chance[1]), event };
  }
  const aura = AURA.exec(line);
  if (aura !== null) {
    const name = nameAt(aura, 2);
    return name === null ? null : { kind: 'aura', ...name, level: parseLevel(aura[1]), hows: new Set(['aura']) };
  }
  const charges = CHARGES.exec(line);
  if (charges !== null) {
    const name = nameAt(charges, 2);
    const level = Number(charges[1]);
    return name === null
      ? null
      : { kind: 'charges', ...name, level: [level, level], hows: new Set(['charged']), charges: Number(charges[4]) };
  }
  const plus = PLUS.exec(line);
  if (plus !== null) {
    const name = nameAt(plus, 2);
    const hint = optionalGroup(plus, 3)?.toLowerCase();
    // "(Class Specific Only)" and other non-class words make the hint unknown: no link
    const classHint = hint === undefined ? undefined : (CLASS_BY_NAME.get(hint) ?? null);
    return name === null ? null : { kind: 'plus', ...name, level: parseLevel(plus[1]), hows: PLUS_HOWS, classHint };
  }
  return null;
}

/** Does a grant fit the line: the same property; for levels, chance and charges lines also the same numbers */
function grantFits(grant: SkillGrant, template: Template): boolean {
  if (!template.hows.has(grant.how)) return false;
  // "+N to X (All Classes)" lines sum an item's oskill and skill levels, so the level tells nothing
  if (template.kind === 'plus') return true;
  const [min, max] = grantLevelRange(grant);
  if (min !== template.level[0] || max !== template.level[1]) return false;
  if (template.chance !== undefined && grant.chance !== template.chance) return false;
  return true;
}

/**
 * The skill a template names. The name must equal a skill's name (case-insensitive). Same-name skills: a "(Class
 * Only)" hint keeps that class's skill; then the one skill the line's item grants that way; then the one skill any
 * item grants that way at that level (and chance). Anything still ambiguous resolves to null (no link).
 */
function resolveSkill(template: Template, index: SkillRefIndex, item: SkillRefItem | undefined): SkillDetail | null {
  let candidates = index.byName.get(template.name.toLowerCase()) ?? [];
  if (template.classHint === null) return null;
  if (template.classHint !== undefined) {
    const hint = template.classHint;
    candidates = candidates.filter((skill) => skill.cls === hint);
  }
  if (candidates.length <= 1) return candidates.at(0) ?? null;
  const itemIds = item === undefined ? undefined : index.items.get(itemKey(item.kind, item.name));
  if (itemIds !== undefined) {
    const granted = candidates.filter((skill) => skill.grantedBy?.some((grant) => itemIds.has(grant.item) && template.hows.has(grant.how)));
    if (granted.length === 1) return granted[0] ?? null;
    if (granted.length > 1) return null;
  }
  const fitting = candidates.filter((skill) => skill.grantedBy?.some((grant) => grantFits(grant, template)) === true);
  return fitting.length === 1 ? (fitting[0] ?? null) : null;
}

/**
 * A line split around the skill name it names, or null when it is not a skill property line (or the skill cannot be
 * told apart): ["10% Chance to Cast Level 5 ", { "Frost Nova", ref }, " on Striking"]. `item` is the line's item.
 */
export function findSkillRefs(line: string, index: SkillRefIndex, item?: SkillRefItem): SkillRefSegment[] | null {
  if (line.length > MAX_LINE_LENGTH) return null;
  const first = line.charAt(0);
  if (first !== '+' && first !== 'L' && first !== 'l' && !(first >= '0' && first <= '9')) return null;
  const template = matchTemplate(line);
  if (template === null) return null;
  const skill = resolveSkill(template, index, item);
  if (skill === null) return null;
  const ref: SkillRef = {
    id: skill.id,
    kind: template.kind,
    level: template.level,
    ...(template.chance === undefined ? {} : { chance: template.chance }),
    ...(template.charges === undefined ? {} : { charges: template.charges }),
    ...(template.event === undefined ? {} : { event: template.event }),
  };
  const segments: SkillRefSegment[] = [];
  if (template.start > 0) segments.push({ text: line.slice(0, template.start) });
  segments.push({ text: line.slice(template.start, template.end), ref });
  if (template.end < line.length) segments.push({ text: line.slice(template.end) });
  return segments;
}

function levelText([min, max]: readonly [number, number]): string {
  return min === max ? String(min) : `${String(min)}-${String(max)}`;
}

/** What the line gives, in the peek's words: "Level 15 aura when equipped", "+3 skill levels", … */
export function skillRefText(ref: SkillRef): string {
  const level = levelText(ref.level);
  switch (ref.kind) {
    case 'plus':
      return `+${level} skill ${ref.level[1] === 1 ? 'level' : 'levels'}`;
    case 'aura':
      return `Level ${level} aura when equipped`;
    case 'charges':
      return `Level ${level}, ${String(ref.charges ?? 0)} charges`;
    case 'chance':
      return `${String(ref.chance ?? 0)}% chance to cast level ${level} ${ref.event ?? ''}`.trimEnd();
  }
}

export interface SkillRefLevel {
  /** The level the peek evaluates the skill at */
  readonly level: number;
  /** What that level is ("At level 20 (the roll's maximum)") */
  readonly label: string;
  /** The Skills page's `lvl`; null keeps the page default */
  readonly urlLevel: number | null;
}

/**
 * The level the peek shows values at: the item's level (a range's maximum). A +levels line adds to the character's
 * own points, so a class skill is shown at the Skills page default (20) and says so; an item skill (no hard points,
 * no class) at the +levels this item alone gives.
 */
export function skillRefLevel(ref: SkillRef, skill: Pick<SkillDetail, 'cls'>): SkillRefLevel {
  const max = clampLevel(ref.level[1]);
  const ranged = ref.level[0] !== ref.level[1];
  if (ref.kind !== 'plus') {
    return { level: max, label: `At level ${String(max)}${ranged ? ' (the roll’s maximum)' : ''}`, urlLevel: max };
  }
  if (skill.cls === null) {
    return { level: max, label: `At level ${String(max)} (this item alone${ranged ? ', its maximum roll' : ''})`, urlLevel: max };
  }
  return {
    level: PAGE_DEFAULT_LEVEL,
    label: `At level ${String(PAGE_DEFAULT_LEVEL)} for reference (the +levels add to your own points)`,
    urlLevel: null,
  };
}

/** The Skills page focused on the skill (`?skill=<id>`, the page opens its class and tab) at a level */
export function skillRefUrl(skill: Pick<SkillDetail, 'id'>, level: number | null): string {
  const params = new URLSearchParams({ [SKILL_PARAM]: skill.id });
  if (level !== null && level !== PAGE_DEFAULT_LEVEL) params.set(LEVEL_PARAM, String(level));
  return `/${ROUTE}?${params.toString()}`;
}
