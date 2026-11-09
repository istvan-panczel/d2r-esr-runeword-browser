import { useEffect, useEffectEvent, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decideUrlRead } from '@/core/utils/urlArrival';

interface UrlArrivalOptions {
  /** False while the screen's own data loads: the URL is read once it is true */
  readonly ready?: boolean;
  /** Whether the URL carries params the screen acts on (the screen removes them again in `apply`) */
  readonly hasParams: (params: URLSearchParams) => boolean;
  /** Reads the params. `firstMount` is true only for the first read, which also runs with no params (a screen's defaults) */
  readonly apply: (params: URLSearchParams, firstMount: boolean) => void;
}

/**
 * Runs a filter screen's URL → Redux step on mount and whenever the URL later carries params the screen recognises,
 * so a link to the page you are on behaves like arriving from another page. See `decideUrlRead`.
 */
export function useUrlArrival({ ready = true, hasParams, apply }: UrlArrivalOptions): void {
  const [searchParams] = useSearchParams();
  const handled = useRef<URLSearchParams | null>(null);

  const read = useEffectEvent((params: URLSearchParams) => {
    const decision = decideUrlRead(handled.current, params, hasParams);
    handled.current = params;
    if (decision !== 'skip') apply(params, decision === 'first-mount');
  });

  useEffect(() => {
    if (ready) read(searchParams);
  }, [searchParams, ready]);
}
