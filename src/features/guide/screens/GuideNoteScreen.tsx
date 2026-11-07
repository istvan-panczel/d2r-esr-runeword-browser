import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LoadedGuide } from '../engine/browser/loadGuide';
import { findNote, findSourceRef, noteTitle } from '../engine/notes';
import type { GuideNote } from '../engine/schema';
import { AppLinkIcon } from '../components/AppLinkIcon';
import { ExternalLink } from '@/components/ExternalLink';
import { FreshnessBadge } from '../components/FreshnessBadge';
import { GuideBody } from '../components/GuideBody';
import { GuideGate } from '../components/GuideGate';
import { LocalGraph } from '../components/LocalGraph';
import { NoteChip } from '../components/NoteChip';
import { SectionLabel } from '../components/SectionLabel';
import { FOCUS_RING, GUIDE_PROSE_FONT } from '../components/styles';
import { useVisitedNotes } from '../hooks/useVisitedNotes';
import { collectAppLinks } from '../utils/guideUtils';

interface NoteNotFoundProps {
  readonly slug: string;
}

function NoteNotFound({ slug }: NoteNotFoundProps) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-xl font-bold">Note Not Found</h1>
        <p className="mb-4 break-words text-muted-foreground">There is no guide note called “{slug}”.</p>
        <Button asChild variant="outline">
          <Link to="/guide">Back to the Guide</Link>
        </Button>
      </div>
    </div>
  );
}

interface SectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

interface ChipsProps {
  readonly slugs: readonly string[];
  readonly visited: ReadonlySet<string>;
}

function Chips({ slugs, visited }: ChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {slugs.map((slug) => (
        <NoteChip key={slug} slug={slug} visited={visited.has(slug)} />
      ))}
    </div>
  );
}

interface NextOnPathProps {
  readonly guide: LoadedGuide;
  readonly next: string;
}

function NextOnPath({ guide, next }: NextOnPathProps) {
  return (
    // Phone: a sticky bar at the bottom of the viewport (the article reserves space for it); sm+: an inline button.
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <Link
        to={`/guide/${next}`}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 transition-colors hover:border-primary/50 hover:bg-accent/40 sm:w-auto sm:max-w-md',
          FOCUS_RING
        )}
      >
        <span className="min-w-0">
          <SectionLabel as="span" className="block">
            Next on your path
          </SectionLabel>
          <span className="block truncate font-medium">{noteTitle(guide.bundle, next)}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
      </Link>
    </div>
  );
}

interface NoteProps {
  readonly guide: LoadedGuide;
  readonly note: GuideNote;
  readonly visited: ReadonlySet<string>;
}

function Note({ guide, note, visited }: NoteProps) {
  const { bundle, manifest } = guide;
  const appLinks = collectAppLinks(note.body);
  const sources = note.sources.map((id) => findSourceRef(bundle, id));

  // Note-to-note navigation reuses this component; start each note at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [note.slug]);

  return (
    // lg: body + a 22rem sticky local graph column; xl+: 2/3 + 1/3; below lg the graph is hidden (the chips carry the same edges).
    <div className="mx-auto max-w-2xl lg:grid lg:max-w-7xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <article className={cn('min-w-0 space-y-6', note.next !== null && 'pb-28 sm:pb-0')}>
        <header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <Link to="/guide" className="hover:text-foreground hover:underline">
                Guide
              </Link>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate text-foreground" aria-current="page">
                {note.title}
              </span>
            </nav>
            <FreshnessBadge verified={note.verified} current={manifest.esrVersion} reasons={note.staleReasons} />
          </div>
        </header>

        {/* Reading panel: the note itself on a card surface with softened body text (less glare than
            near-white on the near-black page); navigation sections stay outside it. */}
        <div className="space-y-6 rounded-lg border bg-card p-4 text-card-foreground sm:p-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">{note.title}</h1>
            <p className={cn('text-base text-muted-foreground', GUIDE_PROSE_FONT)}>{note.summary}</p>
          </div>

          {note.knowFirst.length > 0 && (
            <Section title="Know first">
              <Chips slugs={note.knowFirst} visited={visited} />
            </Section>
          )}

          <GuideBody blocks={note.body} />
        </div>

        {appLinks.length > 0 && (
          <Section title="In the app">
            <ul className="flex flex-wrap gap-2">
              {appLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <AppLinkIcon href={link.href} className="size-4 text-muted-foreground" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {note.officialDocs.length > 0 && (
          <Section title="Official docs">
            <ul className="space-y-1">
              {note.officialDocs.map((doc) => (
                <li key={doc.href}>
                  <ExternalLink
                    href={doc.href}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    iconClassName="size-3.5"
                  >
                    {doc.label}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(note.related.length > 0 || note.backlinks.length > 0) && (
          <Section title="Related">
            {note.related.length > 0 && <Chips slugs={note.related} visited={visited} />}
            {note.backlinks.length > 0 && (
              <details className="group text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
                  Mentioned in ({note.backlinks.length})
                </summary>
                <div className="mt-2">
                  <Chips slugs={note.backlinks} visited={visited} />
                </div>
              </details>
            )}
          </Section>
        )}

        {note.next !== null && <NextOnPath guide={guide} next={note.next} />}

        {sources.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Sources:{' '}
            {sources.map((ref, i) => (
              <span key={ref.id}>
                {i > 0 && ' · '}
                {ref.url !== null ? (
                  <a href={ref.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    {ref.title}
                  </a>
                ) : (
                  ref.title
                )}
              </span>
            ))}
          </p>
        )}
      </article>
      <aside className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
        <LocalGraph note={note} visited={visited} />
      </aside>
    </div>
  );
}

interface NoteRouteProps {
  readonly guide: LoadedGuide;
  readonly slug: string;
}

function NoteRoute({ guide, slug }: NoteRouteProps) {
  const note = findNote(guide.bundle, slug);
  const found = note !== undefined;
  // Read once per screen (it stays mounted across note-to-note navigation) and passed down, so chips and graph agree.
  const { visited, markVisited } = useVisitedNotes();

  useEffect(() => {
    if (found) markVisited(slug);
  }, [found, slug, markVisited]);

  if (note === undefined) return <NoteNotFound slug={slug} />;
  // Keyed by slug so per-note UI state (open peeks, the expanded backlinks) resets on note-to-note navigation.
  return <Note key={slug} guide={guide} note={note} visited={visited} />;
}

/** `/guide/:slug`: one note. */
export function GuideNoteScreen() {
  const { slug = '' } = useParams();
  return <GuideGate>{(guide) => <NoteRoute guide={guide} slug={slug} />}</GuideGate>;
}
