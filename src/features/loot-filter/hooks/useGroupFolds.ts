import { useState } from 'react';

export interface GroupFolds<G extends string> {
  readonly isOpen: (group: G) => boolean;
  readonly setOpen: (group: G, open: boolean) => void;
}

/**
 * The open / folded state of the editor's groups for one editor mount (the rule editor remounts per rule, the Styles
 * tab's per style). A group starts open when `initial` (read once, at mount) has it; a group with a diagnostic is open
 * until the user folds it. After that only the user opens or folds a group: editing a field never folds one.
 */
export function useGroupFolds<G extends string>(initial: () => ReadonlySet<G>, flagged: ReadonlySet<G>): GroupFolds<G> {
  const [start] = useState(initial);
  const [toggled, setToggled] = useState<Partial<Record<G, boolean>>>({});
  return {
    isOpen: (group) => toggled[group] ?? (start.has(group) || flagged.has(group)),
    setOpen: (group, open) => {
      setToggled((previous) => (previous[group] === open ? previous : { ...previous, [group]: open }));
    },
  };
}
