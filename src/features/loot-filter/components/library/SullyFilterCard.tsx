import { Link } from 'react-router-dom';
import { Download, Pin, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useTemplateText } from '../../hooks/useTemplateText';
import { filterMetadata, type FilterMetadata } from '../../sharing';
import { TEMPLATE_SANDBOX_PATH, levelNames, ruleCountLabel } from '../../utils/library';
import { referencedAssetsOfText } from '../../utils/referencedAssets';
import { TEMPLATE_NAME, TEMPLATE_VERSION } from '../../utils/template';
import { FilterDownloadMenu } from '../FilterDownloadMenu';

function readMetadata(text: string): FilterMetadata | null {
  try {
    return filterMetadata(text);
  } catch {
    return null;
  }
}

interface SullyFilterCardProps {
  readonly onStart: () => void;
  readonly starting: boolean;
}

/** The pinned first card of the Shared tab: the bundled Sully's QoL filter (the one the ESR launcher ships). */
export function SullyFilterCard({ onStart, starting }: SullyFilterCardProps) {
  const template = useTemplateText();
  const metadata = template.status === 'ready' ? readMetadata(template.text) : null;
  const levels = levelNames(metadata?.levels ?? null);

  return (
    <Card className="flex flex-col gap-3 border-primary/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to={TEMPLATE_SANDBOX_PATH} className="min-w-0 font-semibold leading-tight hover:underline">
          {TEMPLATE_NAME}
        </Link>
        <Badge variant="outline">
          <Pin aria-hidden />
          Pinned
        </Badge>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        The filter the ESR launcher gives every player, bundled with this site. Start from it to change its rules.
      </p>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>by Sully</span>
        <span className="shrink-0 text-xs">v{TEMPLATE_VERSION}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {template.status === 'loading' ? (
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
          <Link to={TEMPLATE_SANDBOX_PATH}>Open</Link>
        </Button>
        {template.status === 'ready' ? (
          <FilterDownloadMenu
            name={TEMPLATE_NAME}
            getText={() => template.text}
            assets={referencedAssetsOfText(template.text)}
            variant="outline"
          />
        ) : (
          <Button size="sm" variant="outline" disabled>
            <Download />
            Download
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onStart} disabled={starting}>
          {starting ? <Spinner /> : <Sparkles />}
          Start from it
        </Button>
      </div>
    </Card>
  );
}
