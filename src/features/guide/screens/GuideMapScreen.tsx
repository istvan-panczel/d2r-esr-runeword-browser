import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_WIDE_LG_CLASS } from '@/components/pageWidthClasses';
import { selectPageWidth } from '@/features/settings';
import type { LoadedGuide } from '../engine/browser/loadGuide';
import type { GuideNote } from '../engine/schema';
import { FreshnessMarker } from '../components/FreshnessBadge';
import { FullGraph } from '../components/FullGraph';
import { GuideGate } from '../components/GuideGate';
import { SectionLabel } from '../components/SectionLabel';
import { FOCUS_RING, GUIDE_PROSE_FONT } from '../components/styles';
import { VisitedMark } from '../components/VisitedMark';
import { useVisitedNotes } from '../hooks/useVisitedNotes';
import { groupNotesForMap, type GuideMapGroup } from '../utils/guideMap';

interface NoteRowProps {
  readonly guide: LoadedGuide;
  readonly note: GuideNote;
  readonly visited: boolean;
}

/** One note card, styled like the spine screen's step cards. */
function NoteRow({ guide, note, visited }: NoteRowProps) {
  return (
    <li>
      <Link
        to={`/guide/${note.slug}`}
        className={cn(
          'block rounded-md border bg-background/60 px-3 py-2 transition-colors hover:border-primary/50 hover:bg-accent/40',
          FOCUS_RING
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            {note.title}
            {visited && <VisitedMark className="size-3.5" />}
          </span>
          <FreshnessMarker verified={note.verified} current={guide.manifest.esrVersion} reasons={note.staleReasons} />
        </span>
        <span className={cn('mt-0.5 block text-sm text-muted-foreground', GUIDE_PROSE_FONT)}>{note.summary}</span>
        {note.tags.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full border px-1.5 text-[0.6875rem] leading-4 text-muted-foreground">
                {tag}
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}

interface GroupProps {
  readonly guide: LoadedGuide;
  readonly group: GuideMapGroup;
  readonly visited: ReadonlySet<string>;
}

function Group({ guide, group, visited }: GroupProps) {
  const headingId = group.kind === 'step' ? `guide-map-step-${String(group.index)}` : 'guide-map-other';
  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        {group.kind === 'step' ? (
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold text-muted-foreground"
            aria-hidden
          >
            {group.index + 1}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-semibold">
            {group.kind === 'step' ? group.step.title : 'Other topics'}
          </h2>
          <p className={cn('mt-0.5 text-sm text-muted-foreground', GUIDE_PROSE_FONT)}>
            {group.kind === 'step' ? group.step.summary : 'Notes off the main path: look them up when you need them.'}
          </p>
        </div>
      </div>
      {group.notes.length > 0 && (
        <ul className={cn('mt-3 space-y-2', group.kind === 'step' && 'sm:pl-10')}>
          {group.notes.map((note) => (
            <NoteRow key={note.slug} guide={guide} note={note} visited={visited.has(note.slug)} />
          ))}
        </ul>
      )}
    </section>
  );
}

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
        {/* Two groups per row; three from 1536 px and all six (five spine steps + other topics) from 2880 px */}
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start @8xl/page:grid-cols-3 @11xl/page:grid-cols-6">
          {groups.map((group) => (
            <Group key={group.kind === 'step' ? `step-${String(group.index)}` : 'other'} guide={guide} group={group} visited={visited} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** `/guide/map`: every note as a graph (lg+) and as a list grouped by spine step. */
export function GuideMapScreen() {
  return <GuideGate>{(guide) => <GuideMap guide={guide} />}</GuideGate>;
}
