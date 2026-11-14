import { Download } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink } from '@/components/ExternalLink';
import { PageShell } from '@/components/PageShell';
import { ToolbarCard } from '@/components/ToolbarCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { cn } from '@/lib/utils';
import { EXTERNAL_ICON_CLASS, LINK_CLASS } from '@/features/ascendancies/components/styles';
import { REPORT_FILE_STEMS } from '../build/patchNotesIndex';
import { PatchNoteBody } from '../components/PatchNoteBody';
import { ReleasePicker, ReleaseTimeline } from '../components/ReleaseTimeline';
import { ReportSheet } from '../components/ReportSheet';
import type { PatchNoteRelease, PatchNotesIndex } from '../engine/schema';
import { patchNotesFileUrl } from '../engine/loadPatchNotes';
import { usePatchNotes } from '../hooks/usePatchNotes';
import {
  formatReleaseDate,
  releasePath,
  releaseViews,
  reportOf,
  resolveView,
  VIEW_DESCRIPTIONS,
  VIEW_LABELS,
  type PatchNotesView,
} from '../utils/patchNotesView';

export function PatchNotesScreen() {
  const state = usePatchNotes();
  return (
    <PageShell title="Patch Notes">
      {state.status === 'loading' && (
        <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-muted-foreground">
          <Spinner className="size-6" />
          Loading patch notes…
        </div>
      )}
      {state.status === 'error' && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{state.error instanceof Error ? state.error.message : 'Could not load the patch notes.'}</p>
          <Button variant="outline" size="sm" onClick={state.retry}>
            Try again
          </Button>
        </div>
      )}
      {state.status === 'ready' && <PatchNotes index={state.data} />}
    </PageShell>
  );
}

function PatchNotes({ index }: { readonly index: PatchNotesIndex }) {
  const { version } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const latest = index.releases.at(0);
  const release = version === undefined ? latest : index.releases.find((candidate) => candidate.version === version);

  if (latest === undefined) return <p className="text-sm text-muted-foreground">No patch notes yet.</p>;

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        What changed in each ESR release: the mod author&apos;s patch notes and, for the releases since 3.3, our own reports read from the
        game files.
      </p>
      <div className="grid gap-6 @3xl/page:grid-cols-[13rem_minmax(0,1fr)] @5xl/page:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden @3xl/page:block">
          <div className="sticky top-20">
            <ReleaseTimeline releases={index.releases} current={release?.version ?? ''} />
          </div>
        </aside>
        <div className="min-w-0 space-y-4">
          <div className="@3xl/page:hidden">
            <ReleasePicker
              releases={index.releases}
              current={release?.version ?? latest.version}
              onPick={(picked) => {
                void navigate(releasePath(picked));
              }}
            />
          </div>
          {release === undefined ? (
            <p className="text-sm">
              No release {version} here.{' '}
              <Link to={releasePath(latest.version)} className={LINK_CLASS}>
                Open {latest.version}, the latest
              </Link>
              .
            </p>
          ) : (
            <Release release={release} view={resolveView(release, searchParams.get('view'))} />
          )}
        </div>
      </div>
    </div>
  );
}

function Release({ release, view }: { readonly release: PatchNoteRelease; readonly view: PatchNotesView }) {
  const report = reportOf(release, view);
  const date = formatReleaseDate(release.date);
  const views = releaseViews(release);

  return (
    <article aria-labelledby="patch-notes-release" className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="patch-notes-release" className="text-xl font-semibold tabular-nums">
          ESR {release.version}
        </h2>
        {date !== null && <span className="text-sm text-muted-foreground">Released {date}</span>}
      </header>

      <ToolbarCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {views.length > 1 ? (
            <nav aria-label="Views of this release" className="flex flex-wrap gap-1">
              {views.map((candidate) => (
                <Link
                  key={candidate}
                  to={releasePath(release.version, candidate)}
                  replace
                  aria-current={candidate === view ? 'page' : undefined}
                  className={cn(SUBTAB_BASE, candidate === view ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
                >
                  {VIEW_LABELS[candidate]}
                </Link>
              ))}
            </nav>
          ) : (
            <span className="px-1 text-sm font-medium">{VIEW_LABELS.notes}</span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {report === null ? (
              <Button asChild variant="ghost" size="sm">
                <ExternalLink href={release.sourceUrl} iconClassName="size-4">
                  Source on GitHub
                </ExternalLink>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <ExternalLink href={patchNotesFileUrl(report.html)} iconClassName="size-4">
                    Open full page
                  </ExternalLink>
                </Button>
                {report.pdf !== null && (
                  <Button asChild variant="outline" size="sm">
                    <a href={patchNotesFileUrl(report.pdf)} download={`ESR-${release.version}-${REPORT_FILE_STEMS[report.kind]}.pdf`}>
                      <Download aria-hidden />
                      Download PDF
                    </a>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <p className="px-1 text-xs text-muted-foreground">{VIEW_DESCRIPTIONS[view]}</p>
      </ToolbarCard>

      {report === null ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <PatchNoteBody blocks={release.blocks} />
          <p className="mt-6 border-t pt-3 text-xs text-muted-foreground">
            From{' '}
            <ExternalLink href={release.sourceUrl} className={LINK_CLASS} iconClassName={EXTERNAL_ICON_CLASS}>
              patchnotes/{release.version}.md
            </ExternalLink>{' '}
            in the ESR repository.
          </p>
        </div>
      ) : (
        <ReportSheet key={report.html} src={patchNotesFileUrl(report.html)} title={`ESR ${release.version} ${VIEW_LABELS[view]}`} />
      )}
    </article>
  );
}
