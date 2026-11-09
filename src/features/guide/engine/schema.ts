/**
 * Shape of the static guide bundle under `public/guide/`.
 * Bump GUIDE_SCHEMA whenever the bundle shape changes incompatibly. Adding a field is compatible (the 1 → 1 change that
 * added GuideNote.staleReasons kept the schema at 1: an older page simply ignores the field).
 *
 * Shared by the generator (Node) and the browser: relative `.ts` imports only, no DOM.
 */
import type { SourceLabel } from '../../game-data/engine/schema.ts';

export const GUIDE_SCHEMA = 1;

export type GuideFile = 'guide';

export interface GuideManifest {
  schema: number;
  /** ESR version of the clone the generated blocks were resolved against */
  esrVersion: string;
  esrTag: string | null;
  esrCommit: string;
  generatedAt: string;
  files: Partial<Record<GuideFile, { hash: string; bytes: number }>>;
  counts: Record<string, number>;
  warnings: string[];
}

export type NoteKind = 'note' | 'link' | 'hub';
export type Volatility = 'low' | 'high';

export interface OfficialDocLink {
  label: string;
  /** Absolute URL */
  href: string;
}

export interface GuideNote {
  slug: string;
  title: string;
  kind: NoteKind;
  summary: string;
  tags: string[];
  aliases: string[];
  /** ESR version the text was verified against in-game; null = draft */
  verified: string | null;
  /**
   * Why a verified note may need another look (computed at build: data blocks that changed since guide:verify,
   * newer patch notes that mention the note). Empty when nothing changed; always empty for drafts.
   */
  staleReasons: string[];
  volatility: Volatility;
  /** Slugs the reader should know first (≤3) */
  knowFirst: string[];
  /** Explicitly related slugs (≤5) */
  related: string[];
  /** Slugs of notes whose body or frontmatter links here (computed) */
  backlinks: string[];
  /** Next note on the journey (spine order, or the frontmatter override); null when off the path */
  next: string | null;
  /** 0-based index of the spine step the note belongs to, or null */
  spineStep: number | null;
  officialDocs: OfficialDocLink[];
  /** Ids into GuideBundle.sourceRefs */
  sources: string[];
  /** Word count of the body text (excluding data blocks) */
  words: number;
  body: GuideBlock[];
}

export interface GuideSpineStep {
  title: string;
  summary: string;
  notes: string[];
}

export interface GuideQuestion {
  label: string;
  note: string;
}

export interface GuideSpine {
  steps: GuideSpineStep[];
  questions: GuideQuestion[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Owning note slug, if any */
  note: string | null;
  /**
   * App page the term links to (`/modifiers?kind=deadly-strike`), resolved from the `link:` key of _glossary.yml like a
   * note's `page:` link; left out when the entry has none
   */
  link?: string;
}

export interface SourceRef {
  id: string;
  title: string;
  url: string | null;
  license: string | null;
  note: string | null;
}

export interface GuideBundle {
  notes: GuideNote[];
  spine: GuideSpine;
  glossary: GlossaryEntry[];
  sourceRefs: SourceRef[];
  /**
   * Cube family id (cube.json) → slugs of the notes that show it (`::recipes`, `::secret-recipes`, `::secret-recipe`,
   * `::recipe-output`). Always written by the generator; optional so hand-built test bundles can leave it out.
   */
  familyNotes?: Record<string, string[]>;
  /**
   * misc.txt item code → slugs of the notes that show the item (`::source` of a misc item, `::card[socketable:…]`, the
   * misc inputs of `::recipe-output`); every code of a name shared by several rows. Read by the Materials page.
   */
  itemNotes?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Body tree: a deliberately small subset of markdown, fully resolved at build time.
// ---------------------------------------------------------------------------

export type LinkKind = 'note' | 'app' | 'external';

export type GuideInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: GuideInline[] }
  | { type: 'emphasis'; children: GuideInline[] }
  | { type: 'code'; value: string }
  | { type: 'break' }
  /** note: href is a slug · app: an app path incl. query, without the base URL · external: absolute URL */
  | { type: 'link'; kind: LinkKind; href: string; children: GuideInline[] }
  /** Glossary hover; `term` matches a GlossaryEntry.term */
  | { type: 'term'; term: string; children: GuideInline[] };

export type GuideBlock =
  | { type: 'paragraph'; children: GuideInline[] }
  | { type: 'heading'; depth: 3 | 4; children: GuideInline[] }
  | { type: 'list'; ordered: boolean; items: GuideBlock[][] }
  | { type: 'blockquote'; children: GuideBlock[] }
  | { type: 'table'; header: GuideInline[][]; rows: GuideInline[][][] }
  | { type: 'thematicBreak' }
  | { type: 'codeBlock'; value: string }
  | { type: 'data'; block: DataBlock };

/** One entry of an `items` data block (vendor stock, recipe contents) */
export interface ItemsBlockItem {
  label: string;
  detail: string | null;
}

/** One row of a `recipes` data block */
export interface RecipeRow {
  inputs: string[];
  output: string;
  note: string | null;
}

export type CardItem = 'runeword' | 'gemword' | 'unique' | 'mythical' | 'socketable';

/** An embedded item card (resolved from the HTM data in the browser); `href` is the app-link fallback (`?name=`) */
export interface CardBlock {
  kind: 'card';
  item: CardItem;
  name: string;
  href: string;
}

export interface RecipesBlock {
  kind: 'recipes';
  caption: string;
  rows: RecipeRow[];
  /** The family on the Cube Recipes page (`/cube-recipes?family=…`, "All N recipes"); absent when it has no rows there */
  link?: { label: string; href: string };
}

/** Blocks produced by directives; the browser renders them generically. */
export type DataBlock =
  | { kind: 'table'; caption: string; header: string[]; rows: string[][] }
  | { kind: 'items'; caption: string; items: ItemsBlockItem[] }
  | RecipesBlock
  | { kind: 'source'; item: string; labels: SourceLabel[] }
  | { kind: 'glossary'; entries: GlossaryEntry[] }
  | CardBlock;
