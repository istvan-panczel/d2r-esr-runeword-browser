/**
 * Coverage drift: what the review (and the /esr-update skill built on it) knows, and what the generators now produce
 * that it does not. A new bundle file, bundle section, manifest count or warning class means a feature was added after
 * the skill and this script were last updated.
 */
import { BUNDLE_SPECS } from './bundles.ts';
import { capLines, finding, info, ok, type Check } from './report.ts';

/** Manifest count key prefixes the review and the skill explain (every key must start with one). */
export const KNOWN_COUNT_PREFIXES: readonly string[] = [
  'types',
  'classes',
  'bases',
  'weapons',
  'armors',
  'misc',
  'strings',
  'stringConflicts',
  'duplicateBases',
  'baseAutomods',
  'superior',
  'runeword',
  'affixes',
  'sources',
  'lootFilter',
  'enhance',
  'cube',
  'materials',
  'sets',
  'setItems',
  'skillClasses',
  'skills',
  'skillDetails',
  'skillGrant',
  'skillCalc',
  'skillIcons',
  'crafting',
  'tierCodes',
  'areas',
  'stash',
  'itemText',
  'terrorZone',
  'modifier',
  'itemIcons',
  'uniqueIcons',
  'setIcons',
  'miscIcons',
  'vanillaIcon',
  'tintedIcon',
];

/** Warning classes (the text before the first ": ") the generators emit and the skill knows. */
export const KNOWN_WARNING_CLASSES: readonly string[] = [
  'itemtypes',
  'charstats',
  'bases',
  'superior',
  'runewords',
  'affixes',
  'affix stats',
  'sources',
  'lootfilter',
  'lootfilter skills',
  'enhance',
  'cube',
  'materials',
  'sets',
  'skills',
  'skilldetails',
  'skillcalc',
  'crafting',
  'areas',
  'stash',
  'itemtext',
  'terrorzones',
  'modifiers',
];

/** `lootfilter skills: …` → `lootfilter skills`; null when the text has no lower-case class prefix. */
export function warningClass(warning: string): string | null {
  return /^([a-z][a-z0-9]*(?: [a-z][a-z0-9]*)?): /.exec(warning)?.[1] ?? null;
}

/**
 * Warning classes in generator source text: template or string literals starting `<class>: ` on lines that mention a
 * warning (warnings.push, warn(…)). A heuristic for classes no manifest has shown yet.
 */
export function warningClassesInSource(source: string): string[] {
  const classes = new Set<string>();
  for (const line of source.split('\n')) {
    if (!/warn/i.test(line)) continue;
    for (const match of line.matchAll(/[`'"]([a-z][a-z0-9]*(?: [a-z][a-z0-9]*)?): /g)) classes.add(match[1]);
  }
  return [...classes];
}

export interface CoverageInputs {
  /** Bundle files under public/game-data/ (HEAD and working tree) */
  bundleFiles: readonly string[];
  /** Sections the bundle diff found that BUNDLE_SPECS does not name: `<file> <section>` */
  unknownSections: readonly string[];
  countKeys: readonly string[];
  warnings: readonly string[];
  /** Warning classes found in the generator sources (warningClassesInSource), with the file they are in */
  sourceWarningClasses: readonly { file: string; cls: string }[];
}

export function coverageCheck(input: CoverageInputs): Check {
  const lines: string[] = [];
  for (const file of input.bundleFiles) if (!Object.hasOwn(BUNDLE_SPECS, file)) lines.push(`bundle file ${file}`);
  for (const section of input.unknownSections) lines.push(`bundle section ${section}`);
  for (const key of input.countKeys)
    if (!KNOWN_COUNT_PREFIXES.some((prefix) => key.startsWith(prefix))) lines.push(`manifest count ${key}`);
  const known = new Set(KNOWN_WARNING_CLASSES);
  const seen = new Set<string>();
  for (const warning of input.warnings) {
    const cls = warningClass(warning) ?? '(no class prefix)';
    if (!known.has(cls) && !seen.has(cls)) {
      seen.add(cls);
      lines.push(`warning class "${cls}" (manifest)`);
    }
  }
  for (const { file, cls } of input.sourceWarningClasses) {
    if (!known.has(cls) && !seen.has(cls)) {
      seen.add(cls);
      lines.push(`warning class "${cls}" (${file})`);
    }
  }
  const title = 'Review coverage';
  if (lines.length > 0) {
    return finding(
      'self.coverage',
      title,
      `${String(lines.length)} things not covered by esr:review / the esr-update skill: update them`,
      'a feature added since the skill was written reads ESR data this review does not compare, so its release changes would go unseen',
      lines
    );
  }
  return ok(
    'self.coverage',
    title,
    `Every bundle file and section, ${String(input.countKeys.length)} count keys and every warning class are known.`
  );
}

export interface CommitLine {
  hash: string;
  subject: string;
}

/** feat/fix commits (`git log --format=%h%x09%s`), the ones the skill's self-update step should read. */
export function featureCommits(log: string): CommitLine[] {
  return log
    .split('\n')
    .map((line) => {
      const [hash = '', ...rest] = line.split('\t');
      return { hash, subject: rest.join('\t') };
    })
    .filter(({ hash, subject }) => hash !== '' && /^(feat|fix)(\([^)]*\))?!?:/.test(subject));
}

export function commitsCheck(since: string | null, commits: readonly CommitLine[]): Check {
  const title = 'Feature commits since the skill was updated';
  if (since === null) return info('self.commits', title, 'No commit touches the skill or this script yet.');
  if (commits.length === 0)
    return ok('self.commits', title, `No feat/fix commit touched src/features, scripts or public/game-data since ${since}.`);
  return info(
    'self.commits',
    title,
    `${String(commits.length)} feat/fix commits since ${since} (the last skill or review-script change): check whether the skill covers them.`,
    capLines(commits.map((commit) => `${commit.hash} ${commit.subject}`))
  );
}
