/*
 * NOT ROUTED (kept on purpose, 2026-11-07): the owner asked for a single guide view, so `/guide` is now the overview
 * (GuideOverviewScreen) and `/guide/map` only redirects there. This screen, FullGraph and engine/fullGraph.ts stay in
 * the code (and tested) so the graph can come back; the screen is not exported from the feature's index.ts, so d3-force
 * stays out of the bundle.
 */
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_WIDE_LG_CLASS } from '@/components/pageWidthClasses';
import { selectPageWidth } from '@/features/settings';
import type { LoadedGuide } from '../engine/browser/loadGuide';
import { FullGraph } from '../components/FullGraph';
import { GuideGate } from '../components/GuideGate';
import { GuideNoteGroups } from '../components/GuideNoteGroups';
import { SectionLabel } from '../components/SectionLabel';
import { useVisitedNotes } from '../hooks/useVisitedNotes';
import { groupNotesForMap } from '../utils/guideMap';

interface MapProps {
  readonly guide: LoadedGuide;
}

function GuideMap({ guide }: MapProps) {
  const { visited } = useVisitedNotes();
  // A reading column below lg; from lg the page width setting (the graph grows with it).
  const pageWidth = useSelector(selectPageWidth);
  const groups = groupNotesForMap(guide.bundle);
  const order = groups.flatMap((group) => group.notes.map((note) => note.slug));

  return (
    <div className={cn('mx-auto max-w-2xl space-y-6', PAGE_WIDE_LG_CLASS[pageWidth])}>
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <Link to="/guide" className="hover:text-foreground hover:underline">
            Guide
          </Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate text-foreground" aria-current="page">
            Map
          </span>
        </nav>
        <h1 className="text-2xl font-bold">Guide map</h1>
        <p className="text-sm text-muted-foreground">
          All {order.length} notes of the guide and how they connect, grouped by where they fit on your path.
        </p>
      </header>

      {/* Desktop only: below lg the list alone carries every note. */}
      <FullGraph order={order} visited={visited} className="hidden lg:block" />

      <div className="space-y-3">
        <SectionLabel>All notes</SectionLabel>
        <GuideNoteGroups guide={guide} groups={groups} visited={visited} />
      </div>
    </div>
  );
}

/** `/guide/map` (not routed, see above): every note as a graph (lg+) and as a list grouped by spine step. */
export function GuideMapScreen() {
  return <GuideGate>{(guide) => <GuideMap guide={guide} />}</GuideGate>;
}
