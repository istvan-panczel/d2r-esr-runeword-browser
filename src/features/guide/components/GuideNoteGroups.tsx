import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LoadedGuide } from '../engine/browser/loadGuide';
import type { GuideNote } from '../engine/schema';
import type { GuideMapGroup } from '../utils/guideMap';
import { FreshnessMarker } from './FreshnessBadge';
import { FOCUS_RING, GUIDE_PROSE_FONT } from './styles';
import { VisitedMark } from './VisitedMark';

interface NoteRowProps {
  readonly guide: LoadedGuide;
  readonly note: GuideNote;
  readonly visited: boolean;
}

/** One note card: title, ✓ when read, freshness marker, summary and tags. */
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
  const headingId = group.kind === 'step' ? `guide-group-step-${String(group.index)}` : 'guide-group-other';
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

interface GuideNoteGroupsProps {
  readonly guide: LoadedGuide;
  /** From `groupNotesForMap(guide.bundle)`: every note of the bundle, once. */
  readonly groups: readonly GuideMapGroup[];
  readonly visited: ReadonlySet<string>;
}

/** Every guide note as cards, one card per spine step plus "Other topics" (the `/guide` overview). */
export function GuideNoteGroups({ guide, groups, visited }: GuideNoteGroupsProps) {
  return (
    // Two groups per row from lg; three from 1536 px and all six (five spine steps + other topics) from 2880 px.
    // `/page` is the guide layout's PageShell, so the columns follow the Page width setting.
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start @8xl/page:grid-cols-3 @11xl/page:grid-cols-6">
      {groups.map((group) => (
        <Group key={group.kind === 'step' ? `step-${String(group.index)}` : 'other'} guide={guide} group={group} visited={visited} />
      ))}
    </div>
  );
}
