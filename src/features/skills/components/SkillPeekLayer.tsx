import { lazy, Suspense, type ReactNode } from 'react';
import { PeekPopover } from '@/components/PeekPopover';
import { useSkillRefPeek } from '../hooks/useSkillRefPeek';

// The card pulls in the skill calculator: its own chunk, loaded with the first peek
const SkillPeekCard = lazy(async () => {
  const module = await import('./SkillPeekCard');
  return { default: module.SkillPeekCard };
});

/**
 * The skill peek of every page (app shell): wraps the page, finds skill names in item lines (`SkillRefText`) by event
 * delegation and shows one shared popover for them (useSkillRefPeek). Renders no popover until a name is used.
 */
export function SkillPeekLayer({ children }: { readonly children: ReactNode }) {
  const { peek, skillRef, wrapperProps } = useSkillRefPeek();
  return (
    <>
      <div className="contents" {...wrapperProps}>
        {children}
      </div>
      {/* Outside the wrapper: React bubbles the portaled peek's events through its parents */}
      {skillRef !== null && (
        <PeekPopover peek={peek} anchorRef={peek.anchorRef}>
          <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
            <SkillPeekCard skillRef={skillRef} />
          </Suspense>
        </PeekPopover>
      )}
    </>
  );
}
