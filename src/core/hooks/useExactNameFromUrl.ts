import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import type { PayloadAction } from '@reduxjs/toolkit';
import { useUrlArrival } from '@/core/hooks/useUrlArrival';
import { FILTER_URL_PARAM_KEYS, hasExactNameParam } from '@/core/utils/filterUrlParams';
import { parseExactNameParam } from '@/core/utils/exactName';

export interface ExactNameFromUrl {
  /** Whether the latest read of the URL carried a `name` param (the URL is cleaned after init, so it is captured) */
  readonly nameFromUrl: boolean;
  /** Clears the exact-name focus (the chip's "×") */
  readonly clearExactName: () => void;
}

/**
 * Applies the `?name=` exact-name focus of a list screen, without waiting for the filter data: on mount and on every
 * later arrival (`useUrlArrival`). The focus is independent of the other filters (it overrides them while set, see
 * applyExactNameFocus): set from the URL, and cleared by a visit or arrival whose URL has no `name`, so it never outlives
 * the deep link. `hasOtherParams` tells whether the URL has the screen's other filter params: those arrive without a
 * name too and clear the focus, while the bare URL left by the cleanup must not.
 * Cleaning the URL stays with the screen's own useUrlInitialize, which knows its other params.
 */
export function useExactNameFromUrl(
  setExactName: (name: string | null) => PayloadAction<string | null>,
  hasOtherParams: (params: URLSearchParams) => boolean
): ExactNameFromUrl {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [nameFromUrl, setNameFromUrl] = useState(() => hasExactNameParam(searchParams));

  useUrlArrival({
    hasParams: (params) => hasExactNameParam(params) || hasOtherParams(params),
    apply: (params) => {
      const name = parseExactNameParam(params.get(FILTER_URL_PARAM_KEYS.NAME));
      setNameFromUrl(name !== null);
      dispatch(setExactName(name));
    },
  });

  return { nameFromUrl, clearExactName: () => dispatch(setExactName(null)) };
}
