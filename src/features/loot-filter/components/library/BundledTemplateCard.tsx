import { Link } from 'react-router-dom';
import { Download, Pin, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useTemplateText } from '../../hooks/useTemplateText';
import { filterMetadata, type FilterMetadata } from '../../sharing';
import { levelNames, ruleCountLabel } from '../../utils/library';
import { referencedAssetsOfText } from '../../utils/referencedAssets';
import type { BundledTemplate } from '../../utils/template';
import { FilterDownloadMenu } from '../FilterDownloadMenu';

function readMetadata(text: string): FilterMetadata | null {
  try {
    return filterMetadata(text);
  } catch {
    return null;
  }
}

interface BundledTemplateCardProps {
  readonly template: BundledTemplate;
  readonly onStart: () => void;
  /** This template's start is loading. */
  readonly starting: boolean;
  /** Another start is loading: the button waits. */
  readonly disabled: boolean;
}

/** A pinned card of the Shared tab: a bundled template (Sully's QoL filter, the example filter). */
export function BundledTemplateCard({ template, onStart, starting, disabled }: BundledTemplateCardProps) {
  const text = useTemplateText(template.id);
  const metadata = text.status === 'ready' ? readMetadata(text.text) : null;
  const levels = levelNames(metadata?.levels ?? null);

  return (
    <Card className="flex flex-col gap-3 border-primary/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to={template.sandboxPath} className="min-w-0 font-semibold leading-tight hover:underline">
          {template.name}
        </Link>
        <Badge variant="outline">
          <Pin aria-hidden />
          Pinned
        </Badge>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{template.summary}</p>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">by {template.author}</span>
        <span className="shrink-0 text-xs">v{template.version}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {text.status === 'loading' ? (
          <Skeleton className="h-4 w-40" />
        ) : metadata === null ? (
          <span>Could not load the filter file.</span>
        ) : (
          <p>
            {ruleCountLabel(metadata.rule_count)}
            {levels.length > 0 && (
              <>
                {' · '}
                <span title="Filter levels">{levels.join(', ')}</span>
              </>
            )}
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link to={template.sandboxPath}>Open</Link>
        </Button>
        {text.status === 'ready' ? (
          <FilterDownloadMenu name={template.name} getText={() => text.text} assets={referencedAssetsOfText(text.text)} variant="outline" />
        ) : (
          <Button size="sm" variant="outline" disabled>
            <Download />
            Download
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onStart} disabled={starting || disabled}>
          {starting ? <Spinner /> : <Sparkles />}
          Start from it
        </Button>
      </div>
    </Card>
  );
}
