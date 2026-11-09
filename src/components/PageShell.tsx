import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { selectPageWidth } from '@/features/settings';
import { PageHeader, type PageHeaderProps } from './PageHeader';
import { pageShellWidthClass, type PageWidth } from './pageWidthClasses';

export type { PageWidth };

interface PageShellProps extends Partial<Omit<PageHeaderProps, 'className'>> {
  /** Omit the title to use the shell for its width only (e.g. a layout route whose children render their own header) */
  readonly title?: ReactNode;
  readonly width?: PageWidth;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * The frame of a page: one centred width plus the shared title row (see `PageHeader`).
 *
 * The shell is the `page` size container (`@container/page`), so page content can respond to the page's real width
 * (which depends on the Page width setting) instead of the viewport. Container steps, `min-width` like the viewport
 * breakpoints (defined in src/index.css, rem based like `max-w-7xl`; px at the default 16 px text size):
 *
 * - Tailwind's own `@3xl` (768 px), `@5xl` (1024 px), `@7xl` (1280 px = the whole Standard page);
 * - `@8xl` 1536 px (4 cards), `@9xl` 1920 px (the whole Wide page, 5 cards), `@10xl` 2400 px (6 cards),
 *   `@11xl` 2880 px (7 cards): only Wide and Full pages ever reach these.
 *
 * Rule for a grid that should use the extra room: keep its viewport classes as they are (they are the Standard
 * layout) and add columns from `@8xl/page:` up, e.g. `grid sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4
 * @9xl/page:grid-cols-5`. The Standard page is never wider than 1280 px, so it never matches `@8xl` and stays exactly
 * as it was. Name the container (`/page`): a bare `@8xl:` queries the nearest container of any kind (a shadcn
 * `CardHeader` is one). Nested shells (a layout route's shell around a screen's shell) are fine: `/page` resolves
 * to the innermost one. Arbitrary steps (`@min-[1700px]/page:`) work too but prefer the named ones.
 *
 * `container-type: inline-size` only contains the inline size: `position: fixed` children (the guide note's phone bar)
 * still position against the viewport and `sticky` columns still stick (checked in Chrome).
 * The shell must keep a width that does not depend on its content (`w-full`), which it has.
 */
export function PageShell({ title, count, actions, meta, width = 'wide', className, children }: PageShellProps) {
  const mode = useSelector(selectPageWidth);
  return (
    <div className={cn('@container/page mx-auto w-full', pageShellWidthClass(width, mode), className)}>
      {title !== undefined && <PageHeader title={title} count={count} actions={actions} meta={meta} />}
      {children}
    </div>
  );
}
