import { lazy, Suspense } from 'react';
import { PeekPopover } from '@/components/PeekPopover';
import type { HoverPopover } from '@/components/useHoverPopover';
import { useModifierRefIndex } from '@/features/modifiers/hooks/useModifierRefIndex';
import { useSkillRefIndex } from '../hooks/useSkillRefIndex';
import type { PeekRef } from '../hooks/useSkillRefPeek';
import { loadModifierPeekCard, loadSkillPeekCard } from './peekChunks';

// Each card is its own chunk (prefetched on idle once item lines have their data, peekChunks.ts)
const SkillPeekCard = lazy(async () => {
  const module = await loadSkillPeekCard();
  return { default: module.SkillPeekCard };
});
const ModifierPeekCard = lazy(async () => {
  const module = await loadModifierPeekCard();
  return { default: module.ModifierPeekCard };
});

interface SkillPeekHostProps {
  readonly peek: HoverPopover;
  readonly peekRef: PeekRef;
  /** The name sits in a form (the build editor): the card's link opens a new tab, so the edits stay */
  readonly newTab: boolean;
}

/**
 * The shared popover of the skill and modifier peeks (Radix Popover and the card). Its own chunk: `SkillPeekLayer` in the
 * app shell loads it the first time a peek opens, so no route pays for it up front.
 */
export function SkillPeekHost({ peek, peekRef, newTab }: SkillPeekHostProps) {
  const skills = useSkillRefIndex();
  const modifiers = useModifierRefIndex();
  const label =
    peekRef.type === 'skill'
      ? (skills?.byId.get(peekRef.ref.id)?.name ?? peekRef.ref.id)
      : (modifiers?.byKey.get(peekRef.ref.key)?.title ?? peekRef.ref.key);
  return (
    <PeekPopover peek={peek} anchorRef={peek.anchorRef} label={label} hideWhenDetached>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        {peekRef.type === 'skill' ? (
          <SkillPeekCard skillRef={peekRef.ref} newTab={newTab} />
        ) : (
          <ModifierPeekCard modifierRef={peekRef.ref} newTab={newTab} />
        )}
      </Suspense>
    </PeekPopover>
  );
}
