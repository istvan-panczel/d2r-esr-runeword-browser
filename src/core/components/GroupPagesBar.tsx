import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { APP_FRAME_CLASS } from '@/components/pageWidthClasses';
import { selectPageWidth } from '@/features/settings';
import { getActiveNavGroup, isNavItemActive } from '@/core/navigation/navConfig';
import { PAGE_ROW_LINK_ACTIVE, PAGE_ROW_LINK_BASE, PAGE_ROW_LINK_INACTIVE } from './navTabClasses';
import { centeredScrollLeft } from './centeredScrollLeft';

/**
 * The header's page row: the pages of the current menu group, one thin strip under the main row. It renders only on a
 * group's pages, scrolls sideways when it does not fit, and is not sticky (nor is the header: sticky page columns assume that).
 */
export function GroupPagesBar() {
  const { pathname } = useLocation();
  const pageWidth = useSelector(selectPageWidth);
  const stripRef = useRef<HTMLDivElement>(null);
  const group = getActiveNavGroup(pathname);

  // Centre the active link in the strip. Sets the strip's own scrollLeft: scrollIntoView would scroll the window too.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    const stripRect = strip.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    strip.scrollLeft = centeredScrollLeft({
      viewportWidth: stripRect.width,
      contentWidth: strip.scrollWidth,
      itemLeft: activeRect.left - stripRect.left + strip.scrollLeft,
      itemWidth: activeRect.width,
    });
  }, [pathname]);

  if (group === undefined) return null;

  return (
    <div className="border-t border-border/60">
      <nav aria-label={`${group.label} pages`} className={cn(APP_FRAME_CLASS[pageWidth], 'px-1')}>
        <div ref={stripRef} className="flex overflow-x-auto [scrollbar-width:none]">
          {group.items.map((item) => {
            const active = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(PAGE_ROW_LINK_BASE, active ? PAGE_ROW_LINK_ACTIVE : PAGE_ROW_LINK_INACTIVE)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
