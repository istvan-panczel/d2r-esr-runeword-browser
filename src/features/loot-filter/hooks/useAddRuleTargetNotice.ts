import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { LootFilter } from '../engine/types';
import { addRuleTarget, addRuleTargetNotice, type AddRuleTargetSnapshot } from '../utils/addRuleTarget';

/**
 * Tells the user when an edit of the open filter changes where Add rule puts new rules (a Protection part added,
 * renamed or removed: `addRuleTargetNotice`). `filterKey` identifies the open filter, so opening another one says
 * nothing. Held by the editor screen, so it sees edits from every tab.
 */
export function useAddRuleTargetNotice(filterKey: string | null, filter: LootFilter | null): void {
  const kind = filter === null ? null : addRuleTarget(filter).kind;
  // What the last commit saw; a ref, not state, so the effect never renders again.
  const previous = useRef<AddRuleTargetSnapshot | null>(null);
  useEffect(() => {
    const current = filterKey === null || kind === null ? null : { filterKey, kind };
    const notice = addRuleTargetNotice(previous.current, current);
    previous.current = current;
    if (notice !== undefined) toast.info(notice);
  }, [filterKey, kind]);
}
