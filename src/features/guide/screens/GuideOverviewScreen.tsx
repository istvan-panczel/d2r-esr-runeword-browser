import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PAGE_WIDE_LG_CLASS } from '@/components/pageWidthClasses';
import { selectPageWidth } from '@/features/settings';
import type { LoadedGuide } from '../engine/browser/loadGuide';
import { GuideGate } from '../components/GuideGate';
import { GuideNoteGroups } from '../components/GuideNoteGroups';
import { GuideOfficialReference } from '../components/GuideOfficialReference';
import { GuideSearch } from '../components/GuideSearch';
import { FOCUS_RING } from '../components/styles';
import { useVisitedNotes } from '../hooks/useVisitedNotes';
import { groupNotesForMap } from '../utils/guideMap';

interface OverviewProps {
  readonly guide: LoadedGuide;
}

function Overview({ guide }: OverviewProps) {
  const { visited, reset: resetVisited } = useVisitedNotes();
  // A reading column below lg; from lg the Page width setting, so the groups can sit side by side.
  const pageWidth = useSelector(selectPageWidth);
  const groups = groupNotesForMap(guide.bundle);
  const noteCount = groups.reduce((sum, group) => sum + group.notes.length, 0);
  // Only notes that still exist (stored slugs of deleted or renamed notes are ignored).
  const visitedCount = guide.bundle.notes.filter((note) => visited.has(note.slug)).length;

  return (
    <div className={cn('mx-auto max-w-2xl space-y-6', PAGE_WIDE_LG_CLASS[pageWidth])}>
      <PageHeader
        className="mb-0"
        title="Guide"
        meta={`All ${String(noteCount)} notes, grouped by where they fit on your path through Eastern Sun Resurrected.`}
      />

      <div className="lg:max-w-xl">
        <GuideSearch notes={guide.bundle.notes} />
      </div>

      <GuideNoteGroups guide={guide} groups={groups} visited={visited} />

      {visitedCount > 0 && (
        <p className="text-right text-xs text-muted-foreground">
          {visitedCount} of {noteCount} {noteCount === 1 ? 'note' : 'notes'} read ·{' '}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Forget which guide notes you have read?')) resetVisited();
            }}
            className={cn('underline underline-offset-2 hover:text-foreground', FOCUS_RING)}
          >
            Reset progress
          </button>
        </p>
      )}

      <GuideOfficialReference />
    </div>
  );
}

/**
 * `/guide`: the guide's only overview. Every note of the bundle (the same list the old note map showed), one card per
 * spine step plus "Other topics", with search, read progress and the "Official reference" strip. `/guide/map`
 * redirects here.
 */
export function GuideOverviewScreen() {
  return <GuideGate>{(guide) => <Overview guide={guide} />}</GuideGate>;
}
