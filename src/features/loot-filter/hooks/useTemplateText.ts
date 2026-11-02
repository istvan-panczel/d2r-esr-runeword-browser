import { useEffect, useState } from 'react';
import { loadTemplateText, type BundledTemplateId } from '../utils/template';

export type TemplateTextState =
  { readonly status: 'loading' } | { readonly status: 'ready'; readonly text: string } | { readonly status: 'error' };

/** A bundled template's text, fetched on mount (once per page load, shared with its start button). */
export function useTemplateText(id: BundledTemplateId): TemplateTextState {
  const [loaded, setLoaded] = useState<{ readonly id: BundledTemplateId; readonly state: TemplateTextState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTemplateText(id).then(
      (text) => {
        if (!cancelled) setLoaded({ id, state: { status: 'ready', text } });
      },
      (error: unknown) => {
        console.error(`[Loot filters] Could not load the template ${id}`, error);
        if (!cancelled) setLoaded({ id, state: { status: 'error' } });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  return loaded?.id === id ? loaded.state : { status: 'loading' };
}
