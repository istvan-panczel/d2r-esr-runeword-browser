/**
 * ESR's official "Mercenary and Oskill Information" page (docs/skill_information.htm in the clone, the same file as
 * https://easternsunresurrected.com/skill_information.htm) → skilldetails.json `infoPage` and `mercenaries`.
 *
 * - Oskills table: one row per heading ("Fire/Cold/Lightning/Poison/Magic/Wind Surge") with a hand-written
 *   description. A heading names several skills: comma-separated parts, and slash groups whose last part carries the
 *   shared suffix (`expandSkillHeading`). Each name is resolved against the skilldetails.json skills (`createNameResolver`)
 *   and the description is attached to every skill it resolves to (same-name variants all get it).
 * - Mercenaries table: hireling, subtype ("Comb - Nightmare") and a comma-separated skill list; every resolved skill
 *   gets `{ hireling, subtype }`.
 * - Names that do not resolve become warnings, so an ESR update that renames a skill or adds an entry surfaces them.
 * See docs/features/SKILLS.md "ESR skill information page".
 */
import type { SkillDetail, SkillMercenary } from '../engine/schema.ts';
import { decodeHtmlEntities, stripHtmlTags } from '../../../lib/html.ts';

/** Path of the page inside the ESR clone */
export const SKILL_INFO_PAGE_FILE = 'docs/skill_information.htm';

export interface SkillInfoEntry {
  /** The Skill cell as written ("Fire/Cold/Lightning Damage Aura") */
  heading: string;
  /** The skill names the heading stands for (`expandSkillHeading`) */
  names: string[];
  /** The Description cell: paragraphs, tags stripped, whitespace normalised */
  text: string[];
}

export interface MercenaryRow {
  hireling: string;
  subtype: string;
  skills: string[];
}

export interface SkillInfoPage {
  oskills: SkillInfoEntry[];
  mercenaries: MercenaryRow[];
  /** Problems with the page itself (a table missing, a row with too few cells) */
  warnings: string[];
}

/**
 * Names the page uses for skills whose in-game name differs (lower-case page name → skilldetails name). A target that
 * stops resolving makes the name unmatched again (a warning), so these never hide a rename.
 */
const NAME_ALIASES: Readonly<Partial<Record<string, string>>> = {
  'axe throw': 'Thrown Axe',
  'fire spike nova': 'Fire Enhanced Spike Nova',
  'cold spike nova': 'Cold Enhanced Spike Nova',
  'lightning spike nova': 'Lightning Enhanced Spike Nova',
  'magic spike nova': 'Magic Enhanced Spike Nova',
  'non-elemental spike nova': 'Spike Nova',
  'trophy of skills': 'Trophy of All Skills',
  // Mercenaries table, Barbarian Offensive: hireling.txt lists Shout of the Ancients in that slot (ESR 3.2.24)
  "ancients' presence": 'Shout of the Ancients',
};

/** A cell's text: `<br>` / `<p>` break paragraphs, tags are stripped, entities decoded, whitespace collapsed. */
export function cellParagraphs(html: string): string[] {
  // Source line breaks are only wrapping: collapse them before the tags mark the paragraph breaks
  const marked = html.replace(/\s+/g, ' ').replace(/<br\s*\/?>|<\/p\s*>|<p(\s[^>]*)?>/gi, '\n');
  return decodeHtmlEntities(stripHtmlTags(marked).replace(/&nbsp;|&#160;/gi, ' '))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
}

const cellText = (html: string) => cellParagraphs(html).join(' ');

/**
 * The `<td>` cells of every `<tr>` of a table's HTML. Header rows (`<th>` only) and the title row (one `colspan`
 * cell) are left out.
 */
function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]))
    .filter((cells) => cells.length > 1);
}

/** The page's tables keyed by their title row (the first `<b>` text: "Mercenaries", "Oskills") */
function titledTables(html: string): Map<string, string[][]> {
  const tables = new Map<string, string[][]>();
  for (const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const body = match[1];
    const title = /<b>([\s\S]*?)<\/b>/i.exec(body)?.[1];
    if (title === undefined) continue;
    const key = cellText(title);
    if (!tables.has(key)) tables.set(key, tableRows(body));
  }
  return tables;
}

/**
 * The skill names of an Oskills heading. Parts are comma-separated; a part with slashes is a group whose last member
 * carries the shared suffix: "Fire/Cold Enhanced Axe" → Fire Enhanced Axe, Cold Enhanced Axe. The last member's
 * own prefix has as many words as the first member ("Blades of Ice/…/Fists of Fire Discharge" → suffix "Discharge"),
 * or one word when that would leave no suffix ("Dragon Fury/Execute Discharge").
 */
export function expandSkillHeading(heading: string): string[] {
  const names: string[] = [];
  for (const part of heading.split(',')) {
    const members = part
      .split('/')
      .map((member) => member.replace(/\s+/g, ' ').trim())
      .filter((member) => member !== '');
    const last = members.at(-1);
    if (last === undefined) continue;
    if (members.length === 1) {
      names.push(last);
      continue;
    }
    const lastWords = last.split(' ');
    const firstWords = (members[0] ?? '').split(' ').length;
    const prefixWords = lastWords.length > firstWords ? firstWords : 1;
    const suffix = lastWords.slice(prefixWords).join(' ');
    if (suffix === '') {
      names.push(...members);
      continue;
    }
    for (const member of members.slice(0, -1)) names.push(`${member} ${suffix}`);
    names.push(last);
  }
  return names;
}

/** Parses the page's Oskills and Mercenaries tables. */
export function parseSkillInfoPage(html: string): SkillInfoPage {
  const warnings: string[] = [];
  const tables = titledTables(html);

  const oskills: SkillInfoEntry[] = [];
  const oskillRows = tables.get('Oskills');
  if (oskillRows === undefined) warnings.push('skilldetails: skill_information.htm has no "Oskills" table');
  for (const cells of oskillRows ?? []) {
    const heading = cellText(cells[0] ?? '');
    const text = cellParagraphs(cells[1] ?? '');
    if (heading === '' || text.length === 0) {
      warnings.push(`skilldetails: skill_information.htm Oskills row "${heading}" has no skill or description`);
      continue;
    }
    oskills.push({ heading, names: expandSkillHeading(heading), text });
  }

  const mercenaries: MercenaryRow[] = [];
  const mercRows = tables.get('Mercenaries');
  if (mercRows === undefined) warnings.push('skilldetails: skill_information.htm has no "Mercenaries" table');
  for (const cells of mercRows ?? []) {
    const [hireling = '', subtype = '', skills = ''] = cells.map(cellText);
    if (hireling === '' || skills === '') {
      warnings.push(`skilldetails: skill_information.htm Mercenaries row "${hireling} ${subtype}" has no hireling or skills`);
      continue;
    }
    const names = skills
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name !== '');
    mercenaries.push({ hireling, subtype, skills: names });
  }
  return { oskills, mercenaries, warnings };
}

/**
 * Page name → skills: every skill with that display name (case-insensitive; same-name variants all match), else the
 * skill whose skills.txt id is the name, else the NAME_ALIASES target's name. `classFirst`: when the name matches a
 * class skill, only the class skills (a hireling's Conduit is the Sorceress skill, not the item skill "Conduit Proc").
 */
export function createNameResolver(skills: readonly SkillDetail[]): (name: string, classFirst?: boolean) => SkillDetail[] {
  const byName = new Map<string, SkillDetail[]>();
  const byId = new Map<string, SkillDetail>();
  for (const skill of skills) {
    const key = skill.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), skill]);
    const id = skill.id.toLowerCase();
    if (!byId.has(id)) byId.set(id, skill);
  }
  const direct = (name: string): SkillDetail[] => {
    const key = name.toLowerCase();
    const named = byName.get(key);
    if (named !== undefined) return named;
    const row = byId.get(key);
    return row === undefined ? [] : [row];
  };
  return (name, classFirst = false) => {
    const alias = NAME_ALIASES[name.toLowerCase()];
    const found = direct(name).length > 0 || alias === undefined ? direct(name) : direct(alias);
    const classSkills = classFirst ? found.filter((skill) => skill.cls !== null) : [];
    return classSkills.length > 0 ? classSkills : found;
  };
}

export interface SkillInfoResult {
  counts: {
    /** Oskills rows */
    skillInfoEntries: number;
    /** Skill names the Oskills headings expand to */
    skillInfoNames: number;
    /** Skills that got `infoPage` */
    skillInfoSkills: number;
    /** Skills with `infoPage` and no skilldesc description */
    skillInfoOnlyDescription: number;
    /** Mercenaries rows */
    skillInfoMercenaryRows: number;
    /** Skills that got `mercenaries` */
    skillInfoMercenarySkills: number;
    /** `{ hireling, subtype }` entries over all skills */
    skillInfoMercenaryLinks: number;
    /** Oskill and mercenary skill names that resolve to no skill (each also a warning) */
    skillInfoUnmatched: number;
  };
  /** The unmatched names, as listed in the warnings */
  unmatched: string[];
  warnings: string[];
}

/**
 * Attaches the page's text and mercenary lists to the skilldetails.json skills (mutates them). `skillIds` (every
 * skills.txt id) tells a name the bundle does not list (no item grants the skill) from an unknown one.
 */
export function applySkillInfoPage(skills: readonly SkillDetail[], page: SkillInfoPage, skillIds: ReadonlySet<string>): SkillInfoResult {
  const warnings = [...page.warnings];
  const unmatched: string[] = [];
  const resolve = createNameResolver(skills);
  const knownIds = new Set([...skillIds].map((id) => id.toLowerCase()));
  const miss = (name: string, where: string) => {
    unmatched.push(name);
    const reason = knownIds.has(name.toLowerCase()) ? 'a skills.txt skill not in skilldetails.json' : 'no such skill';
    warnings.push(`skilldetails: skill_information.htm ${where} names "${name}": ${reason}`);
  };

  let names = 0;
  for (const entry of page.oskills) {
    for (const name of entry.names) {
      names++;
      const matches = resolve(name);
      if (matches.length === 0) miss(name, `Oskills "${entry.heading}"`);
      for (const skill of matches) {
        if (skill.infoPage === undefined) skill.infoPage = { heading: entry.heading, text: entry.text };
        else if (skill.infoPage.heading !== entry.heading)
          warnings.push(`skilldetails: skill_information.htm describes "${skill.id}" twice (kept "${skill.infoPage.heading}")`);
      }
    }
  }

  for (const row of page.mercenaries) {
    const merc: SkillMercenary = { hireling: row.hireling, subtype: row.subtype };
    for (const name of row.skills) {
      const matches = resolve(name, true);
      if (matches.length === 0) miss(name, `Mercenaries "${row.hireling} ${row.subtype}"`);
      for (const skill of matches) {
        const list = skill.mercenaries ?? [];
        if (!list.some((entry) => entry.hireling === merc.hireling && entry.subtype === merc.subtype)) list.push({ ...merc });
        skill.mercenaries = list;
      }
    }
  }

  const withInfo = skills.filter((skill) => skill.infoPage !== undefined);
  const withMercs = skills.filter((skill) => skill.mercenaries !== undefined);
  return {
    counts: {
      skillInfoEntries: page.oskills.length,
      skillInfoNames: names,
      skillInfoSkills: withInfo.length,
      skillInfoOnlyDescription: withInfo.filter((skill) => skill.description.length === 0).length,
      skillInfoMercenaryRows: page.mercenaries.length,
      skillInfoMercenarySkills: withMercs.length,
      skillInfoMercenaryLinks: withMercs.reduce((sum, skill) => sum + (skill.mercenaries?.length ?? 0), 0),
      skillInfoUnmatched: unmatched.length,
    },
    unmatched,
    warnings,
  };
}
