/**
 * Pure helpers of the Skills page: the view model (skills.json trees + skilldetails.json), the URL state, search,
 * the "Granted by" texts and the item page links. See docs/features/SKILLS.md.
 */
import type {
  SkillDetail,
  SkillDetailsBundle,
  SkillGrant,
  SkillGrantItem,
  SkillMercenary,
  SkillsBundle,
} from '@/features/game-data/engine/schema';
import { mercenaryHref } from '@/features/game-data/engine/mercenaryLinks';
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { normaliseItemName } from '@/core/utils/itemName';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { DEFAULT_CHAR_LEVEL, DEFAULT_SKILL_LEVEL, formatSynergyParam, parseLevelParam, parseSynergyParam } from './skillLevels';

export const SKILLS_ROUTE = 'skills';
/** `class` value of the item skills view */
export const ITEM_SKILLS = 'items';
export const SKILL_ROWS = 6;
export const SKILL_COLUMNS = 3;

export const SKILLS_URL_PARAMS = {
  CLASS: 'class',
  TAB: 'tab',
  SKILL: 'skill',
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  LEVEL: 'lvl',
  CHAR_LEVEL: 'clvl',
  SYNERGY: 'syn',
} as const;

export interface SkillsState {
  /** Class code or ITEM_SKILLS */
  readonly view: string;
  /** Skill tab (1..3) shown on narrow screens */
  readonly tab: number;
  /** Selected skill id, null when none */
  readonly skill: string | null;
  readonly search: string;
  /** The calculator's skill level (1..110, default 20) */
  readonly level: number;
  /** The calculator's character level (1..110, default 110) */
  readonly charLevel: number;
  /** Synergy hard points: 'max', or points per synergy of the selected skill in its listed order */
  readonly synergy: 'max' | readonly number[];
}

/** The calculator part of SkillsState at its defaults (omitted from the URL) */
export const DEFAULT_LEVEL_STATE = { level: DEFAULT_SKILL_LEVEL, charLevel: DEFAULT_CHAR_LEVEL, synergy: [] } as const satisfies Pick<
  SkillsState,
  'level' | 'charLevel' | 'synergy'
>;

export interface SkillCell {
  readonly detail: SkillDetail;
  readonly row: number;
  readonly col: number;
}

export interface SkillTabView {
  readonly page: number;
  readonly name: string;
  readonly cells: readonly SkillCell[];
}

export interface SkillClassView {
  readonly code: string;
  readonly name: string;
  readonly tabs: readonly SkillTabView[];
}

export interface SkillsView {
  readonly classes: readonly SkillClassView[];
  /** Described class-less skills an item grants, by name */
  readonly itemSkills: readonly SkillDetail[];
  readonly byId: ReadonlyMap<string, SkillDetail>;
  readonly items: readonly SkillGrantItem[];
  /** Class code → display name */
  readonly classNames: ReadonlyMap<string, string>;
}

/**
 * Joins the trees (layout) with the details. A tree skill without a detail row is left out (the bundles are generated
 * together, so this only happens with a stale cache).
 */
export function buildSkillsView(trees: SkillsBundle, details: SkillDetailsBundle): SkillsView {
  const byId = new Map(details.skills.map((skill) => [skill.id, skill]));
  const classes = trees.classes.map((cls): SkillClassView => ({
    code: cls.code,
    name: cls.name,
    tabs: cls.tabs.map((tab) => ({
      page: tab.page,
      name: tab.name,
      cells: tab.skills.flatMap((skill) => {
        const detail = byId.get(skill.id);
        return detail === undefined ? [] : [{ detail, row: skill.row, col: skill.col }];
      }),
    })),
  }));
  const itemSkills = details.skills
    .filter((skill) => skill.cls === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'));
  return { classes, itemSkills, byId, items: details.items, classNames: new Map(trees.classes.map((cls) => [cls.code, cls.name])) };
}

export function readSkillsState(params: URLSearchParams, view: SkillsView): SkillsState {
  const skillParam = params.get(SKILLS_URL_PARAMS.SKILL);
  const skill = skillParam !== null && view.byId.has(skillParam) ? skillParam : null;
  const detail = skill === null ? undefined : view.byId.get(skill);
  const classParam = params.get(SKILLS_URL_PARAMS.CLASS);
  const known = classParam === ITEM_SKILLS || view.classes.some((cls) => cls.code === classParam);
  // A skill link without a class opens the skill's own class (or the item skills)
  const fallback = detail === undefined ? (view.classes[0]?.code ?? ITEM_SKILLS) : (detail.cls ?? ITEM_SKILLS);
  const tabParam = Number(params.get(SKILLS_URL_PARAMS.TAB));
  const tab = Number.isInteger(tabParam) && tabParam >= 1 && tabParam <= 3 ? tabParam : (detail?.page ?? 1);
  return {
    view: known && classParam !== null ? classParam : fallback,
    tab,
    skill,
    search: params.get(SKILLS_URL_PARAMS.SEARCH) ?? '',
    level: parseLevelParam(params.get(SKILLS_URL_PARAMS.LEVEL), DEFAULT_SKILL_LEVEL),
    charLevel: parseLevelParam(params.get(SKILLS_URL_PARAMS.CHAR_LEVEL), DEFAULT_CHAR_LEVEL),
    synergy: parseSynergyParam(params.get(SKILLS_URL_PARAMS.SYNERGY)),
  };
}

export function encodeSkillsState(state: SkillsState): URLSearchParams {
  const params = new URLSearchParams();
  params.set(SKILLS_URL_PARAMS.CLASS, state.view);
  if (state.tab !== 1) params.set(SKILLS_URL_PARAMS.TAB, String(state.tab));
  if (state.skill !== null) params.set(SKILLS_URL_PARAMS.SKILL, state.skill);
  if (state.search !== '') params.set(SKILLS_URL_PARAMS.SEARCH, state.search);
  if (state.level !== DEFAULT_SKILL_LEVEL) params.set(SKILLS_URL_PARAMS.LEVEL, String(state.level));
  if (state.charLevel !== DEFAULT_CHAR_LEVEL) params.set(SKILLS_URL_PARAMS.CHAR_LEVEL, String(state.charLevel));
  const synergy = formatSynergyParam(state.synergy);
  if (synergy !== null) params.set(SKILLS_URL_PARAMS.SYNERGY, synergy);
  return params;
}

/** The page focused on one skill (class and tab follow from the skill) */
export function skillPageUrl(detail: Pick<SkillDetail, 'id' | 'cls' | 'page'>): string {
  const params = encodeSkillsState({
    view: detail.cls ?? ITEM_SKILLS,
    tab: detail.page ?? 1,
    skill: detail.id,
    search: '',
    ...DEFAULT_LEVEL_STATE,
  });
  return `/${SKILLS_ROUTE}?${params.toString()}`;
}

/** Name search over every class skill and item skill (every word or "quoted phrase" must occur, case-insensitive) */
export function searchSkills(view: SkillsView, search: string): SkillDetail[] {
  const words = parseSearchTerms(search).map(normaliseItemName);
  if (words.length === 0) return [];
  const all = [...view.classes.flatMap((cls) => cls.tabs.flatMap((tab) => tab.cells.map((cell) => cell.detail))), ...view.itemSkills];
  return all.filter((skill) => {
    const name = normaliseItemName(skill.name);
    return words.every((word) => name.includes(word));
  });
}

/** How a tile is drawn against the selection: the skill itself, one of its prerequisites, or a skill it unlocks */
export type SkillTileMark = 'selected' | 'prerequisite' | 'dependent' | null;

/**
 * The tile marks of a selection: the selected skill, its prerequisite chain (amber in the UI) and the skills it unlocks
 * directly (sky blue); every tile is unmarked while nothing is selected.
 */
export function selectionMarks(view: SkillsView, selected: string | null): (id: string) => SkillTileMark {
  if (selected === null) return () => null;
  const chain = prerequisiteChain(view, selected);
  return (id) => {
    if (id === selected) return 'selected';
    if (chain.has(id)) return 'prerequisite';
    if (view.byId.get(id)?.reqSkills?.includes(selected) === true) return 'dependent';
    return null;
  };
}

/** The prerequisites of a skill, transitively (the in-game arrows), as ids */
export function prerequisiteChain(view: SkillsView, id: string): Set<string> {
  const chain = new Set<string>();
  const visit = (skillId: string) => {
    for (const req of view.byId.get(skillId)?.reqSkills ?? []) {
      if (chain.has(req)) continue;
      chain.add(req);
      visit(req);
    }
  };
  visit(id);
  return chain;
}

/** The skills whose prerequisites include this one (directly) */
export function dependents(view: SkillsView, id: string): SkillDetail[] {
  const cls = view.byId.get(id)?.cls ?? null;
  if (cls === null) return [];
  const tree = view.classes.find((entry) => entry.code === cls);
  return (tree?.tabs.flatMap((tab) => tab.cells.map((cell) => cell.detail)) ?? []).filter(
    (skill) => skill.reqSkills?.includes(id) === true
  );
}

export function formatMana(mana: readonly [number, number]): string {
  const [base, perLevel] = mana;
  if (perLevel === 0) return String(base);
  return `${String(base)} (${perLevel > 0 ? '+' : ''}${String(perLevel)} per level)`;
}

function levelText(level: SkillGrant['level']): string {
  return typeof level === 'number' ? String(level) : `${String(level[0])}-${String(level[1])}`;
}

const EVENT_TEXT: Readonly<Partial<Record<SkillGrant['how'], string>>> = {
  'hit-skill': 'on striking',
  'att-skill': 'on attack',
  'gethit-skill': 'when struck',
  'kill-skill': 'when you kill an enemy',
  'death-skill': 'when you die',
  'levelup-skill': 'when you level up',
  'cast-skill': 'when you cast a skill',
  'takedmg-skill': 'when you take damage',
};

/** How the item grants the skill, in the words of the item tooltips */
export function grantText(grant: SkillGrant): string {
  const level = levelText(grant.level);
  const levels = grant.level === 1 ? 'level' : 'levels';
  const partial = grant.partial === true ? ' (partial set bonus)' : '';
  switch (grant.how) {
    case 'oskill':
      return `+${level} ${levels} (any class)${partial}`;
    case 'skill':
      return `+${level} ${levels} (class only)${partial}`;
    case 'aura':
      return `Level ${level} aura when equipped${partial}`;
    case 'charged':
      return `Level ${level}, ${String(grant.charges ?? 0)} charges${partial}`;
    default:
      return `${String(grant.chance ?? 0)}% chance to cast level ${level} ${EVENT_TEXT[grant.how] ?? ''}${partial}`.replace(/\s+$/, '');
  }
}

/** Groups of the "Granted by" list, in display order */
export const GRANT_GROUPS = [
  { key: 'use', label: 'Usable skill', hows: ['oskill'] },
  { key: 'levels', label: '+Skill levels', hows: ['skill'] },
  { key: 'aura', label: 'Aura when equipped', hows: ['aura'] },
  { key: 'charges', label: 'Charges', hows: ['charged'] },
  {
    key: 'chance',
    label: 'Chance to cast',
    hows: ['hit-skill', 'att-skill', 'gethit-skill', 'kill-skill', 'death-skill', 'levelup-skill', 'cast-skill', 'takedmg-skill'],
  },
] as const satisfies readonly { key: string; label: string; hows: readonly SkillGrant['how'][] }[];

export const ITEM_KIND_LABELS: Readonly<Record<SkillGrantItem['kind'], string>> = {
  unique: 'Unique',
  set: 'Set item',
  runeword: 'Runeword',
  gemword: 'Gemword',
};

/**
 * The page of an item, focused on its name (`?name=`). Uniques the HTM mythicals list knows open the Mythicals page
 * (`mythicals` holds normalised names; empty while the HTM data loads, then the Uniques page is used).
 */
export function itemPageUrl(item: SkillGrantItem, mythicals: ReadonlySet<string>): string {
  const query = new URLSearchParams({ [FILTER_URL_PARAM_KEYS.NAME]: item.name }).toString();
  switch (item.kind) {
    case 'unique':
      return `${mythicals.has(normaliseItemName(item.name)) ? '/mythicals' : '/uniques'}?${query}`;
    case 'set':
      return `/game-data/sets?${query}`;
    case 'runeword':
      return `/runewords?${query}`;
    case 'gemword':
      return `/gemwords?${query}`;
  }
}

/** Tab name with the class ("Fire (Sorceress)") or "Item skill" */
export function skillContext(view: SkillsView, detail: SkillDetail): string {
  if (detail.cls === null) return 'Item skill';
  const cls = view.classes.find((entry) => entry.code === detail.cls);
  const tab = cls?.tabs.find((entry) => entry.page === detail.page);
  return [cls?.name, tab === undefined ? undefined : `${tab.name} tab`].filter((part) => part !== undefined).join(' · ');
}

/** Stable React keys for text lists that may repeat a line: the text, plus `#n` from its second occurrence on */
export function keyed<T>(values: readonly T[], keyOf: (value: T) => string): { key: string; value: T }[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const base = keyOf(value);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: count === 0 ? base : `${base}#${String(count)}`, value };
  });
}

/**
 * The long description as paragraphs: `str long` breaks lines by hand, so a line that starts in lower case continues
 * the sentence above ("…unleash a devastating" / "flurry of arrows…").
 */
export function descriptionParagraphs(lines: readonly string[]): string[] {
  const paragraphs: string[] = [];
  for (const line of lines) {
    const last = paragraphs.length - 1;
    if (last >= 0 && /^[a-z]/.test(line)) paragraphs[last] = `${paragraphs[last] ?? ''} ${line}`;
    else paragraphs.push(line);
  }
  return paragraphs;
}

/** Abbreviations whose full stop does not end a sentence */
const ABBREVIATIONS = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|approx)$/i;

/**
 * The first sentence of a text: up to the first `.`, `!` or `?` outside parentheses that is followed by a space and a
 * capital letter (not after "e.g." and the like); the whole text when there is no such stop.
 */
export function firstSentence(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (char === '.' || char === '!' || char === '?') && /^\s+[A-Z]/.test(text.slice(i + 1))) {
      if (char === '.' && ABBREVIATIONS.test(text.slice(0, i))) continue;
      return text.slice(0, i + 1);
    }
  }
  return text;
}

export interface MercenaryGroup {
  hireling: string;
  /** The hireling on the Mercenaries page */
  href: string;
  subtypes: { label: string; href: string }[];
}

/**
 * A skill's mercenaries grouped by hireling, in page order: "Desert Mercenary" → "Comb – Normal", "Def – Normal"
 * (the page's " - " shown as an en dash), each with its link to the Mercenaries page.
 */
export function mercenaryGroups(mercenaries: readonly SkillMercenary[]): MercenaryGroup[] {
  const groups: MercenaryGroup[] = [];
  for (const { hireling, subtype } of mercenaries) {
    let group = groups.find((entry) => entry.hireling === hireling);
    if (group === undefined) {
      group = { hireling, href: mercenaryHref(hireling), subtypes: [] };
      groups.push(group);
    }
    if (subtype !== '') group.subtypes.push({ label: subtype.replace(/ - /g, ' – '), href: mercenaryHref(hireling, subtype) });
  }
  return groups;
}

/**
 * What tells same-name skills apart ("Empowered Enchant" × 6): the skills.txt id without the shared name
 * ("Cold", "Proc"), or the whole id; null when the name is unique in the list or equals the id.
 */
export function disambiguation(skill: Pick<SkillDetail, 'id' | 'name'>, duplicateNames: ReadonlySet<string>): string | null {
  if (!duplicateNames.has(skill.name) || skill.id === skill.name) return null;
  const rest = skill.id.startsWith(`${skill.name} `) ? skill.id.slice(skill.name.length + 1) : skill.id;
  return rest === '' ? null : rest;
}

/** Names that more than one of the skills carries */
export function duplicateNames(skills: readonly Pick<SkillDetail, 'name'>[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.name)) duplicates.add(skill.name);
    seen.add(skill.name);
  }
  return duplicates;
}
