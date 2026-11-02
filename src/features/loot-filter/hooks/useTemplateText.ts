import { useEffect, useState } from 'react';
import { loadTemplateText } from '../utils/template';

export type TemplateTextState =
  { readonly status: 'loading' } | { readonly status: 'ready'; readonly text: string } | { readonly status: 'error' };

/** The bundled template's text, fetched on mount (once per page load, shared with Start from Sully's). */
export function useTemplateText(): TemplateTextState {
  const [state, setState] = useState<TemplateTextState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadTemplateText().then(
      (text) => {
        if (!cancelled) setState({ status: 'ready', text });
      },
      (error: unknown) => {
        console.error('[Loot filters] Could not load the template', error);
        if (!cancelled) setState({ status: 'error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
