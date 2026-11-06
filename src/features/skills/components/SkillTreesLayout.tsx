import type { ReactNode } from 'react';

interface SkillTreesLayoutProps {
  /** The trees (`SkillClassTrees`), or what replaces them (the Skills page's search results and item skills) */
  readonly children: ReactNode;
  /** The skill detail card: a sticky right column from `lg`, under the trees below that; null while nothing is selected */
  readonly aside: ReactNode | null;
  /** Shown in the right column at `lg` while nothing is selected */
  readonly placeholder: string;
}

/**
 * The two-column skill tree layout shared by the Skills page and the builds pages. On pages wider than the Standard
 * width the detail card grows (28rem from 1920 px) and from 2400 px the trees stop at 124rem, so the 3 × 6 tab grids
 * do not stretch across a whole ultrawide window (the rest of the row stays empty).
 */
export function SkillTreesLayout({ children, aside, placeholder }: SkillTreesLayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start @9xl/page:grid-cols-[minmax(0,1fr)_28rem] @10xl/page:grid-cols-[minmax(0,124rem)_minmax(22rem,40rem)]">
      <div className="min-w-0 space-y-4">{children}</div>
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        {aside ?? <p className="hidden rounded-lg border border-dashed p-4 text-sm text-muted-foreground lg:block">{placeholder}</p>}
      </aside>
    </div>
  );
}
