import { Suspense } from 'react';
import { PeekPopover } from '@/components/PeekPopover';
import type { HoverPopover } from '@/components/useHoverPopover';
import { useSkillRefIndex } from '../hooks/useSkillRefIndex';
import type { SkillRef } from '../utils/skillRefData';
import { SkillPeekCard } from './SkillPeekCard';

interface SkillPeekHostProps {
  readonly peek: HoverPopover;
  readonly skillRef: SkillRef;
  /** The name sits in a form (the build editor): the card's link opens a new tab, so the edits stay */
  readonly newTab: boolean;
}

/**
 * The shared popover of the skill peek (Radix Popover + the card with the calculator). Its own chunk: `SkillPeekLayer`
 * in the app shell loads it the first time a peek opens, so no route pays for it up front.
 */
export function SkillPeekHost({ peek, skillRef, newTab }: SkillPeekHostProps) {
  const index = useSkillRefIndex();
  const name = index?.byId.get(skillRef.id)?.name ?? skillRef.id;
  return (
    <PeekPopover peek={peek} anchorRef={peek.anchorRef} label={name} hideWhenDetached>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <SkillPeekCard skillRef={skillRef} newTab={newTab} />
      </Suspense>
    </PeekPopover>
  );
}
