import { useEffect, useState } from 'react';
import { NO_FOLDS, readFilterFolds, writeFilterFolds, type FilterFolds, type FoldList } from '../utils/sectionFolds';

/** The open filter's folds, and whether they changed since they were read (only then are they written back). */
interface FoldsState {
  readonly id: string | null;
  readonly folds: FilterFolds;
  readonly changed: boolean;
}

export interface SectionFoldsApi {
  readonly folds: FilterFolds;
  /** Sets one list's open headings from the current ones. */
  readonly update: (list: FoldList, change: (open: ReadonlySet<string>) => ReadonlySet<string>) => void;
}

/**
 * The open headings of the filter `id` (`foldsIdOf`), for the Rules and Styles tabs: held by the editor screen so they
 * outlive a tab switch, read from this browser's storage when another filter opens and written back when they change.
 * `carry`: the open filter only moved to a new id (a draft saved, a sandbox copied to my filters), so its folds go with
 * it instead of being read for the new id.
 */
export function useSectionFolds(id: string | null, carry: boolean): SectionFoldsApi {
  const [state, setState] = useState<FoldsState>(() => ({ id, folds: id === null ? NO_FOLDS : readFilterFolds(id), changed: false }));
  let current = state;
  if (state.id !== id) {
    // Another filter: adjusted while rendering, so the first render of the new filter already has its folds.
    current =
      carry && state.id !== null && id !== null
        ? { id, folds: state.folds, changed: true }
        : { id, folds: id === null ? NO_FOLDS : readFilterFolds(id), changed: false };
    setState(current);
  }

  useEffect(() => {
    if (current.changed && current.id !== null) writeFilterFolds(current.id, current.folds);
  }, [current]);

  return {
    folds: current.folds,
    update: (list, change) => {
      setState((previous) => {
        const open = change(previous.folds[list]);
        if (open === previous.folds[list]) return previous;
        return { ...previous, folds: { ...previous.folds, [list]: open }, changed: true };
      });
    },
  };
}
