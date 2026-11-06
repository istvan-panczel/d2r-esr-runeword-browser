/**
 * Builds `data/modifierRefs.json` (the modifier peek's templates, entries and facts) from modifiers.json and
 * content/modifiers/modifiers.md: `npm run modifiers:refs` (scripts/generate-modifier-refs.ts), checked by
 * `modifiers:refs --check` and modifierRefs.test.ts. Node runs this file as is (hence the `.ts` extensions and type-only
 * alias imports). See docs/features/MODIFIERS.md "Modifier peek".
 */
import type { ModifierCategory, ModifiersBundle, ModifierStat } from '../../game-data/engine/schema.ts';
import { parseModifierContent, tokenizeInline, type SourceKind } from './modifierContent.ts';
import { CONTENT_KINDS } from './modifierContentKinds.ts';
import { resolveText } from './modifierPlaceholders.ts';
import {
  canonicalLine,
  NUMBER_MARK,
  PEEK_FACT_KEYS,
  WILDCARD,
  type ModifierRefEntry,
  type ModifierRefsData,
  type ModifierRefTemplate,
} from './modifierRefs.ts';

/** Skill templates (chance to cast, aura, charges, +N to <skill>): skill names are the skill peek's (skillRefs.ts) */
const SKILL_DESCFUNCS: ReadonlySet<number> = new Set([15, 16, 24, 27, 28]);
/** descfunc 13 / 14: the string names one class or skill tab, the game swaps in the others ("+2 to Druid Skill Levels") */
const CLASS_SKILLS_DESCFUNC = 13;
const SKILL_TAB_DESCFUNC = 14;
/** Value placement of the fixed-string descfuncs (1-14): descval 1 = before the text, 2 = after */
const VALUE_BEFORE = 1;
const VALUE_AFTER = 2;

/**
 * Lines the game prints from a property rather than from one stat's strings: [display string, kind]. "+N% Enhanced
 * Damage" is the min and max damage % stats printed together (the game's strModEnhancedDamage).
 */
const EXTRA_TEMPLATES: readonly (readonly [string, string])[] = [['%+d%% Enhanced Damage', 'enhanced-damage']];

/** A source tag's weight when several kinds tie: the more ESR-specific one wins */
const SOURCE_ORDER: readonly SourceKind[] = ['esr-config', 'esr-files', 'community', 'vanilla'];

export interface ModifierRefsBuild {
  readonly data: ModifierRefsData;
  /** Keys several entries claim (left out: no link), as "key: entry, entry" */
  readonly conflicts: readonly string[];
  /** Content blocks without a summary, unknown facts */
  readonly problems: readonly string[];
}

/** A display string as a canonical line: the numbers it prints are `#`, the names it takes are wildcards */
export function formatKey(format: string): string {
  const sample = format
    .replace(/%[+-]?d|%i|%0|%2/g, '1')
    .replace(/%s|%1/g, WILDCARD)
    .replace(/%%/g, '%');
  return canonicalLine(sample).key;
}

/** The canonical keys one display string gives, by the stat's descfunc / descval and its descstr2 */
export function statKeys(stat: Pick<ModifierStat, 'descfunc' | 'descval' | 'text2'>, format: string): string[] {
  if (format.includes('\n') || format.includes('\\n')) return [];
  const key = formatKey(format);
  const keys = [key];
  // "+2 to Druid Skill Levels"; the Warlock's line reads "+1 to Warlock Skills"
  if (stat.descfunc === CLASS_SKILLS_DESCFUNC) {
    keys.splice(0, 1, `${NUMBER_MARK} to ${WILDCARD} skill levels`, `${NUMBER_MARK} to ${WILDCARD} skills`);
  }
  // "+1 to Summoning Skills (Necromancer Only)"
  if (stat.descfunc === SKILL_TAB_DESCFUNC) keys.splice(0, 1, `${NUMBER_MARK} to ${WILDCARD} skills (${WILDCARD} only)`);
  // A fixed string (no number in it) of descfuncs 1-14 gets the value before or after it (sometimes printed without)
  if (!key.includes(NUMBER_MARK) && stat.descfunc !== undefined && stat.descfunc < 15) {
    if (stat.descval === VALUE_BEFORE) keys.push(`${NUMBER_MARK} ${key}`, `${NUMBER_MARK}% ${key}`);
    if (stat.descval === VALUE_AFTER) keys.push(`${key} ${NUMBER_MARK}`, `${key} ${NUMBER_MARK}%`);
  }
  if (stat.text2 === undefined) return keys;
  const second = formatKey(stat.text2);
  return keys.flatMap((entry) => [entry, `${entry} ${second}`]);
}

/** The source kind the body's tags name most (ties: the more ESR-specific); null without tags */
function mainSource(body: string): SourceKind | null {
  const counts = new Map<SourceKind, number>();
  for (const token of tokenizeInline(body)) if (token.type === 'tag') counts.set(token.tag.kind, (counts.get(token.tag.kind) ?? 0) + 1);
  let best: SourceKind | null = null;
  for (const kind of SOURCE_ORDER) if ((counts.get(kind) ?? 0) > (best === null ? 0 : (counts.get(best) ?? 0))) best = kind;
  return best;
}

/**
 * The peek data: one entry per /modifiers entry with a hand-written text or a reviewed key kind (generated kinds have
 * nothing to tell beyond the line itself), and a canonical key per display string of their stats. Technical stats and
 * the skill templates are left out. A key claimed by several entries goes to the entry with the most stats behind it
 * ("+N% to Spell Damage": four elemental masteries, two spell damage stats); a tie leaves it out ("+N% to All Speeds").
 */
export function buildModifierRefsData(bundle: ModifiersBundle, markdown: string): ModifierRefsBuild {
  const problems: string[] = [];
  const blocks = parseModifierContent(markdown).blocks;
  const kindByKey = new Map(bundle.kinds.map((kind) => [kind.key, kind]));
  const entries: ModifierRefEntry[] = [];
  const entryOfKind = new Map<string, number>();
  /** Entries that cover several kinds: their templates name the kind too */
  const multiKind = new Set<number>();

  for (const block of blocks) {
    const mapping = CONTENT_KINDS[block.key];
    const kinds = (mapping?.kinds ?? []).flatMap((key) => kindByKey.get(key) ?? []);
    const first = kinds.at(0);
    if (mapping === undefined || first === undefined) continue;
    if (block.summary === '') problems.push(`${block.key}: no summary`);
    // The summary's placeholders are filled in now: the peek has no facts beyond PEEK_FACT_KEYS
    const summary = resolveText(block.summary, bundle.facts);
    for (const path of summary.missing) problems.push(`${block.key}: summary placeholder {${path}} resolves to nothing`);
    const category: ModifierCategory = mapping.category ?? first.category;
    for (const kind of kinds) entryOfKind.set(kind.key, entries.length);
    if (kinds.length > 1) multiKind.add(entries.length);
    entries.push({
      key: block.key,
      title: block.title,
      category,
      summary: block.summary === '' ? null : summary.text,
      source: mainSource(block.body) ?? 'esr-files',
    });
  }
  for (const kind of bundle.kinds) {
    if (kind.generated === true || entryOfKind.has(kind.key)) continue;
    entryOfKind.set(kind.key, entries.length);
    entries.push({ key: kind.key, title: kind.title, category: kind.category, summary: null, source: 'esr-files' });
  }

  // key → entry index → kind → the stats behind it
  const claims = new Map<string, Map<number, Map<string, number>>>();
  const claim = (key: string, entry: number, kind: string) => {
    const byEntry = claims.get(key) ?? new Map<number, Map<string, number>>();
    const byKind = byEntry.get(entry) ?? new Map<string, number>();
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    byEntry.set(entry, byKind);
    claims.set(key, byEntry);
  };
  for (const stat of bundle.stats) {
    const entry = entryOfKind.get(stat.kind);
    if (entry === undefined || stat.technical === true || (stat.descfunc !== undefined && SKILL_DESCFUNCS.has(stat.descfunc))) continue;
    const formats = [stat.text, stat.textNeg, stat.group].filter((text) => text !== undefined);
    for (const key of new Set(formats.flatMap((format) => statKeys(stat, format)))) claim(key, entry, stat.kind);
  }
  for (const [format, kind] of EXTRA_TEMPLATES) {
    const entry = entryOfKind.get(kind);
    if (entry === undefined) problems.push(`extra template ${format}: no entry for kind ${kind}`);
    else claim(formatKey(format), entry, kind);
  }

  const templates: ModifierRefTemplate[] = [];
  const patterns: ModifierRefTemplate[] = [];
  const conflicts: string[] = [];
  const total = (byKind: ReadonlyMap<string, number>) => [...byKind.values()].reduce((sum, count) => sum + count, 0);
  for (const [key, byEntry] of claims) {
    const ranked = [...byEntry].map(([entry, byKind]) => [entry, total(byKind), byKind] as const).sort((a, b) => b[1] - a[1]);
    const best = ranked.at(0);
    const second = ranked.at(1);
    if (best === undefined) continue;
    if (ranked.length > 1)
      conflicts.push(`${key}: ${ranked.map(([entry, count]) => `${entries.at(entry)?.key ?? '?'} (${String(count)})`).join(', ')}`);
    if (second !== undefined && second[1] === best[1]) continue;
    // Nothing but a number, or a wildcard alone, would match any line
    if (key.replace(/[#%+\-¤ ]/g, '') === '') continue;
    // The kind with the most stats behind the key (a tie: the first claimed, which is the bundle's stat order)
    const kind = [...best[2]].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    (key.includes(WILDCARD) ? patterns : templates).push(multiKind.has(best[0]) ? [key, best[0], kind] : [key, best[0]]);
  }
  templates.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  patterns.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

  const facts = PEEK_FACT_KEYS.flatMap((key) => {
    const fact = bundle.facts.find((entry) => entry.key === key);
    if (fact === undefined) problems.push(`modifiers.json has no fact ${key}`);
    return fact === undefined ? [] : [fact];
  });
  return { data: { entries, templates, patterns, facts, searchNames: modifierSearchNames(bundle) }, conflicts, problems };
}

/**
 * The home search's modifier names, [title, kind key] (`/modifiers?kind=<key>`): every kind title except kinds made only
 * of ESR bookkeeping stats (tinkering caps, display twins) and generated titles that are only a stat name or a stray
 * word. Kept in modifierRefs.json so the search does not fetch the whole modifiers.json for them.
 */
export function modifierSearchNames(bundle: Pick<ModifiersBundle, 'kinds' | 'stats'>): [string, string][] {
  const technical = new Set(bundle.stats.filter((stat) => stat.technical === true).map((stat) => stat.id));
  return bundle.kinds.flatMap((kind): [string, string][] => {
    if (kind.stats.length > 0 && kind.stats.every((id) => technical.has(id))) return [];
    if (kind.generated === true && (/^[a-z0-9_]+$/.test(kind.title) || kind.title.length <= 3)) return [];
    return [[kind.title, kind.key]];
  });
}
