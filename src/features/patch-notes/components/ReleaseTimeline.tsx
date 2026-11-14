import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExternalLink } from '@/components/ExternalLink';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ESR_CHANGELOG_URL } from '@/core/navigation/navConfig';
import { cn } from '@/lib/utils';
import { EXTERNAL_ICON_CLASS, LINK_CLASS } from '@/features/ascendancies/components/styles';
import type { PatchNoteRelease } from '../engine/schema';
import { formatReleaseDate, groupReleases, releasePath } from '../utils/patchNotesView';

interface ReleaseTimelineProps {
  readonly releases: readonly PatchNoteRelease[];
  readonly current: string;
}

/** The marker of a release we have reports for. */
function ReportMark() {
  return (
    <>
      <FileText className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
      <span className="sr-only">, has our reports</span>
    </>
  );
}

const firstOldVersion = (releases: readonly PatchNoteRelease[]) => releases.at(-1)?.version;

/** Releases newest first, one line per minor version (ESR 3.3, ESR 3.2), as a vertical timeline. */
export function ReleaseTimeline({ releases, current }: ReleaseTimelineProps) {
  const oldest = firstOldVersion(releases);
  return (
    <nav aria-label="Releases" className="space-y-5">
      {groupReleases(releases).map((group) => (
        <section key={group.line} aria-labelledby={`patch-notes-line-${group.line}`}>
          <h2 id={`patch-notes-line-${group.line}`} className="mb-1.5 text-sm font-semibold">
            ESR {group.line}
          </h2>
          <ol className="ml-1 border-l">
            {group.releases.map((release) => {
              const active = release.version === current;
              const date = formatReleaseDate(release.date);
              return (
                <li key={release.version} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1/2 -left-[5px] size-2.5 -translate-y-1/2 rounded-full border-2',
                      active ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background'
                    )}
                  />
                  <Link
                    to={releasePath(release.version)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'ml-3 flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-accent font-semibold text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <span className="tabular-nums">{release.version}</span>
                    {release.reports.length > 0 && <ReportMark />}
                    {date !== null && <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">{date}</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <FileText className="size-3.5 text-amber-600 dark:text-amber-500" aria-hidden />
          Has our item changes or patch-note check
        </p>
        {oldest !== undefined && (
          <p>
            Releases before {oldest}:{' '}
            <ExternalLink href={ESR_CHANGELOG_URL} className={LINK_CLASS} iconClassName={EXTERNAL_ICON_CLASS}>
              official changelog
            </ExternalLink>
          </p>
        )}
      </div>
    </nav>
  );
}

interface ReleasePickerProps extends ReleaseTimelineProps {
  readonly onPick: (version: string) => void;
}

/** The phone version of the timeline: one select, grouped like the timeline. */
export function ReleasePicker({ releases, current, onPick }: ReleasePickerProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="patch-notes-release" className="text-xs font-normal text-muted-foreground">
        Release
      </Label>
      <Select value={current} onValueChange={onPick}>
        <SelectTrigger id="patch-notes-release" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupReleases(releases).map((group) => (
            <SelectGroup key={group.line}>
              <SelectLabel>ESR {group.line}</SelectLabel>
              {group.releases.map((release) => (
                <SelectItem key={release.version} value={release.version}>
                  {release.version}
                  {release.date !== null && <span className="text-muted-foreground"> · {formatReleaseDate(release.date)}</span>}
                  {release.reports.length > 0 && <ReportMark />}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
