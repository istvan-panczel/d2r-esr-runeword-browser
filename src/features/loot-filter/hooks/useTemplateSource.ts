import { useEffect, useState } from 'react';
import type { BundledTemplateId } from '../utils/template';
import { loadTemplate, peekTemplateSource, type TemplateSource } from '../utils/templateSource';

export type TemplateSourceState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly source: TemplateSource }
  | { readonly status: 'error'; readonly message: string };

/**
 * A bundled template's text and version (`loadTemplate`: the live file or the bundled copy), loaded on mount and shared
 * with every other caller; `null` loads nothing ('idle'), so only the pages that need a template fetch it. A source
 * another page already loaded shows at once (no loading flash); a stale one is re-checked in the background.
 */
export function useTemplateSource(id: BundledTemplateId | null): TemplateSourceState {
  const [loaded, setLoaded] = useState<{ readonly id: BundledTemplateId; readonly state: TemplateSourceState } | null>(null);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    loadTemplate(id).then(
      (source) => {
        if (!cancelled) setLoaded({ id, state: { status: 'ready', source } });
      },
      (error: unknown) => {
        console.error(`[Loot filters] Could not load the template ${id}`, error);
        if (!cancelled) setLoaded({ id, state: { status: 'error', message: error instanceof Error ? error.message : String(error) } });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (id === null) return { status: 'idle' };
  if (loaded?.id === id) return loaded.state;
  const known = peekTemplateSource(id);
  return known === null ? { status: 'loading' } : { status: 'ready', source: known };
}

/**
 * The current version of each template in `ids` (the text in use: live or bundled), for "Update available" checks; an id
 * not loaded yet (or that failed) is missing, which never reads as an update. An empty list loads nothing.
 */
export function useTemplateVersions(ids: readonly BundledTemplateId[]): Partial<Record<BundledTemplateId, string | null>> {
  const [versions, setVersions] = useState<Partial<Record<BundledTemplateId, string | null>>>({});
  const key = [...new Set(ids)].sort().join(',');

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    for (const id of key.split(',') as BundledTemplateId[]) {
      loadTemplate(id).then(
        (source) => {
          if (!cancelled) setVersions((previous) => ({ ...previous, [id]: source.version }));
        },
        (error: unknown) => {
          console.error(`[Loot filters] Could not load the template ${id}`, error);
        }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return versions;
}
