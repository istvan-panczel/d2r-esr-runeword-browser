import { useSearchParams } from 'react-router-dom';

export interface UrlState<S> {
  /** The state the URL holds (defaults for missing or invalid params) */
  readonly state: S;
  /** Merges `patch` into the state and writes the URL; `replace` (default) keeps the history entry */
  readonly update: (patch: Partial<S>, replace?: boolean) => void;
  /** Writes a whole state as a new history entry (reset buttons) */
  readonly set: (state: S, replace?: boolean) => void;
}

/**
 * A stash page's state in the URL search params, so links and the back button keep it: `read` turns the params into
 * the state, `encode` writes only what differs from the defaults (engine/urlState.ts helpers).
 */
export function useUrlState<S>(read: (params: URLSearchParams) => S, encode: (state: S) => URLSearchParams): UrlState<S> {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = read(searchParams);
  return {
    state,
    update: (patch, replace = true) => {
      setSearchParams(encode({ ...state, ...patch }), { replace });
    },
    set: (next, replace = false) => {
      setSearchParams(encode(next), { replace });
    },
  };
}
