import { lazy, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSkillRefPeek } from '../hooks/useSkillRefPeek';

// The popover (Radix + floating-ui) loads with the first peek, not with the shell; each card with its first peek
const SkillPeekHost = lazy(async () => {
  const module = await import('./SkillPeekHost');
  return { default: module.SkillPeekHost };
});

/**
 * The skill and modifier peek of every page (app shell): wraps the page, finds skill names and modifier lines in item
 * lines (`SkillRefText`) by event delegation and shows one shared popover for them (useSkillRefPeek). Renders no popover
 * until a name is used, and none after the page changed (a peek belongs to the page its name is on).
 */
export function SkillPeekLayer({ children }: { readonly children: ReactNode }) {
  const { pathname, search } = useLocation();
  const { peek, shown, wrapperProps } = useSkillRefPeek(`${pathname}${search}`);
  return (
    <>
      <div className="contents" {...wrapperProps}>
        {children}
      </div>
      {/* Outside the wrapper: React bubbles the portaled peek's events through its parents */}
      {shown !== null && (
        <Suspense fallback={null}>
          <SkillPeekHost peek={peek} peekRef={shown.ref} newTab={shown.inForm} />
        </Suspense>
      )}
    </>
  );
}
