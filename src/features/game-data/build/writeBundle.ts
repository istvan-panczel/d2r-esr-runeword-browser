import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { GAME_DATA_SCHEMA, type GameDataFile, type GameDataManifest } from '../engine/schema.ts';

/**
 * Serializes a bundle with readable diffs: top-level keys keep their (schema) insertion order,
 * arrays are written one element per line, everything else is pretty-printed.
 */
export function serializeBundle(bundle: object): string {
  const entries = Object.entries(bundle).map(([key, value]: [string, unknown]) => {
    let body: string;
    if (Array.isArray(value)) {
      body = value.length === 0 ? '[]' : `[\n${value.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`;
    } else {
      body = JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
    }
    return `  ${JSON.stringify(key)}: ${body}`;
  });
  return `{\n${entries.join(',\n')}\n}\n`;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface ManifestInput {
  esrVersion: string;
  esrTag: string | null;
  esrCommit: string;
  /** Committer date of `esrCommit` (ISO 8601), null when unknown */
  esrDate?: string | null;
  /** Serialized bundle files */
  files: Partial<Record<GameDataFile, string>>;
  counts: Record<string, number>;
  warnings: string[];
  /** Manifest currently on disk, if any; its generatedAt is kept when no content hash changed */
  previous: GameDataManifest | null;
  now: Date;
}

export function buildManifest(input: ManifestInput): GameDataManifest {
  const files: GameDataManifest['files'] = {};
  for (const [name, text] of Object.entries(input.files) as [GameDataFile, string][]) {
    files[name] = { hash: sha256(text), bytes: Buffer.byteLength(text, 'utf8') };
  }

  const previous = input.previous;
  const unchanged =
    previous !== null &&
    previous.schema === GAME_DATA_SCHEMA &&
    Object.keys(files).length === Object.keys(previous.files).length &&
    (Object.entries(files) as [GameDataFile, { hash: string }][]).every(([name, { hash }]) => previous.files[name]?.hash === hash);

  return {
    schema: GAME_DATA_SCHEMA,
    esrVersion: input.esrVersion,
    esrTag: input.esrTag,
    esrCommit: input.esrCommit,
    esrDate: input.esrDate ?? null,
    generatedAt: unchanged ? previous.generatedAt : input.now.toISOString(),
    files,
    counts: input.counts,
    warnings: input.warnings,
  };
}
