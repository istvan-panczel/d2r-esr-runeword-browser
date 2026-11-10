import { useEffect, useState } from 'react';
import {
  readFilterFolds,
  startFoldsSession,
  switchFoldsSession,
  writeFilterFolds,
  type FilterFolds,
  type FoldList,
  type FoldsSession,
} from '../utils/sectionFolds';

export interface SectionFoldsApi {
  readonly folds: FilterFolds;
  /** Sets one list's open headings from the current ones. */
  readonly update: (list: FoldList, change: (open: ReadonlySet<string>) => ReadonlySet<string>) => void;
}

/**
 * The open headings of the filter `id` (`foldsIdOf`), for the Rules and Styles tabs: held by the editor screen so they
 * outlive a tab switch, read from this browser's storage when another filter opens and written back when they change.
 * `carry`: the open filter only moved to a new id (a draft saved, a sandbox copied to my filters), so its folds go with
 * it instead of being read for the new id (`switchFoldsSession`: only onto an id not shown before).
 */
export function useSectionFolds(id: string | null, carry: boolean): SectionFoldsApi {
  const [state, setState] = useState<FoldsSession>(() => startFoldsSession(id, readFilterFolds));
  let current = state;
  if (state.id !== id) {
    // Another filter: adjusted while rendering, so the first render of the new filter already has its folds.
    current = switchFoldsSession(state, id, carry, readFilterFolds);
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
