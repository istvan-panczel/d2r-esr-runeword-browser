/**
 * Guide checks over public/guide/guide.json (HEAD vs working tree): `::recipes` row counts and caps, notes whose data
 * blocks changed, and notes whose title or glossary terms appear in the new patch notes. Every note is a draft today
 * and drafts get no staleReasons, so these are the only automatic signals that a note needs another look.
 */
import { CUBE_FAMILIES, MAX_FAMILY_ROWS } from '../../../src/features/game-data/build/cube/cubeFamilies.ts';
import { mentionsTerm, noteSearchTerms, type PatchNote } from '../../../src/features/guide/build/staleness.ts';
import type { DataBlock, GuideBundle } from '../../../src/features/guide/engine/schema.ts';
import { capLines, finding, info, ok, type Check } from './report.ts';

export interface RecipesBlockInfo {
  /** `<slug> | <family or caption>` (+ ` #2` for a repeat) */
  key: string;
  slug: string;
  caption: string;
  family: string | null;
  rows: number;
  /** Rows the block shows at most (the family's maxRows); Infinity for uncapped blocks (secret recipes, items) */
  cap: number;
}

/** Every data block of a note body, in order. */
export function dataBlocks(body: unknown): DataBlock[] {
  const blocks: DataBlock[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    if (record.type === 'data' && typeof record.block === 'object' && record.block !== null) blocks.push(record.block as DataBlock);
    for (const value of Object.values(record)) if (typeof value === 'object') walk(value);
  };
  walk(body);
  return blocks;
}

const FAMILY_CAPS = new Map(CUBE_FAMILIES.map((family) => [family.id, family.maxRows ?? MAX_FAMILY_ROWS]));

export function recipesBlocks(guide: Pick<GuideBundle, 'notes'> | null): RecipesBlockInfo[] {
  const result: RecipesBlockInfo[] = [];
  const seen = new Map<string, number>();
  for (const note of guide?.notes ?? []) {
    for (const block of dataBlocks(note.body)) {
      if (block.kind !== 'recipes') continue;
      const family = block.link === undefined ? null : (new URL(block.link.href, 'https://app.invalid').searchParams.get('family') ?? null);
      const caption = block.caption.replace(/ \(… and \d+ more\)$/, '');
      const base = `${note.slug} | ${family ?? caption}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const cap = (family === null ? undefined : FAMILY_CAPS.get(family)) ?? Number.POSITIVE_INFINITY;
      result.push({ key: n === 1 ? base : `${base} #${String(n)}`, slug: note.slug, caption, family, rows: block.rows.length, cap });
    }
  }
  return result;
}

export function recipesCheck(head: Pick<GuideBundle, 'notes'> | null, working: Pick<GuideBundle, 'notes'> | null): Check {
  const before = new Map(recipesBlocks(head).map((block) => [block.key, block]));
  const after = recipesBlocks(working);
  const changed: string[] = [];
  const newlyCapped: string[] = [];
  for (const block of after) {
    const old = before.get(block.key);
    const atCap = block.rows >= block.cap;
    if (old === undefined) changed.push(`+ ${block.key}: ${String(block.rows)} rows`);
    else if (old.rows !== block.rows) changed.push(`~ ${block.key}: ${String(old.rows)} → ${String(block.rows)} rows`);
    if (atCap && (old === undefined || old.rows < old.cap))
      newlyCapped.push(`${block.key}: ${String(block.rows)} rows (cap ${String(block.cap)})`);
  }
  const keys = new Set(after.map((block) => block.key));
  for (const key of before.keys()) if (!keys.has(key)) changed.push(`- ${key}`);
  const capped = after
    .filter((block) => block.rows >= block.cap)
    .map((block) => `at cap: ${block.key} (${String(block.rows)}/${String(block.cap)})`);
  const title = 'Guide ::recipes blocks';
  if (newlyCapped.length > 0) {
    return finding(
      'guide.recipes',
      title,
      `${String(newlyCapped.length)} recipe blocks newly reach their row cap`,
      'the block now cuts rows off ("… and N more"), so a note that says it lists every recipe is wrong',
      [...newlyCapped, ...changed, ...capped]
    );
  }
  if (changed.length > 0)
    return info('guide.recipes', title, `${String(changed.length)} of ${String(after.length)} blocks changed their row count.`, [
      ...changed,
      ...capped,
    ]);
  return ok(
    'guide.recipes',
    title,
    `${String(after.length)} blocks, row counts unchanged; ${String(capped.length)} at their cap as at HEAD.`,
    capped
  );
}

/** Notes whose resolved data blocks differ between HEAD and the working tree. */
export function dataBlocksCheck(head: Pick<GuideBundle, 'notes'> | null, working: Pick<GuideBundle, 'notes'> | null): Check {
  const captionOf = (block: DataBlock) => ('caption' in block ? block.caption : block.kind === 'card' ? `card ${block.name}` : block.kind);
  const before = new Map((head?.notes ?? []).map((note) => [note.slug, dataBlocks(note.body)]));
  const lines: string[] = [];
  for (const note of working?.notes ?? []) {
    const old = before.get(note.slug);
    const now = dataBlocks(note.body);
    if (old === undefined) continue;
    const changedCaptions = now
      .filter((block, i) => JSON.stringify(block) !== JSON.stringify(old[i]))
      .map(captionOf)
      .concat(old.length > now.length ? [`${String(old.length - now.length)} blocks removed`] : []);
    if (changedCaptions.length > 0) lines.push(`${note.slug}: ${changedCaptions.join('; ')}`);
  }
  const title = 'Guide notes whose data changed';
  if (lines.length === 0) return ok('guide.data-blocks', title, 'No note has a changed data block.');
  return finding(
    'guide.data-blocks',
    title,
    `${String(lines.length)} notes show changed data blocks`,
    'the prose around a regenerated block may now contradict it, and draft notes get no stale reasons to flag it',
    lines
  );
}

/** Notes whose title or owned glossary terms appear in the patch notes of the release range. */
export function patchNoteMentionsCheck(guide: Pick<GuideBundle, 'notes' | 'glossary'> | null, patchNotes: readonly PatchNote[]): Check {
  const title = 'Guide notes named in the new patch notes';
  if (patchNotes.length === 0) return ok('guide.patch-notes', title, 'No patch notes in the release range.');
  const lines: string[] = [];
  for (const note of guide?.notes ?? []) {
    const hits = noteSearchTerms(note, guide?.glossary ?? []).flatMap((term) =>
      patchNotes.filter((patch) => mentionsTerm(patch.text, term)).map((patch) => `'${term}' (${patch.version})`)
    );
    if (hits.length > 0) lines.push(`${note.slug}: ${hits.join(', ')}`);
  }
  const versions = patchNotes.map((patch) => patch.version).join(', ');
  if (lines.length === 0) return ok('guide.patch-notes', title, `Patch notes ${versions} name no note title or glossary term.`);
  return info(
    'guide.patch-notes',
    title,
    `${String(lines.length)} notes are named in patch notes ${versions}; re-read them.`,
    capLines(lines)
  );
}
