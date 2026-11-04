import type { ReactNode } from 'react';
import { ExternalLink } from '@/components/ExternalLink';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/features/guide/components/styles';

const LINK_ICON = 'ml-0.5 inline size-[0.9em] align-[-0.1em]';

interface HomeLinkCardProps {
  readonly label: string;
  readonly href: string;
  readonly description: string;
  /** Muted description (the compact official-link cards) instead of body text. */
  readonly mutedDescription?: boolean;
  /** A row under the title (author, badges). */
  readonly meta?: ReactNode;
  /** Short feature labels shown as a dot-separated line under the description. */
  readonly features?: readonly string[];
  readonly caveat?: string;
  /** Adds a small "Source on GitHub" link. */
  readonly sourceUrl?: string;
}

/** One external-link card of the home page's Official ESR links and Community tools sections (an `<li>`). */
export function HomeLinkCard({ label, href, description, mutedDescription = false, meta, features, caveat, sourceUrl }: HomeLinkCardProps) {
  return (
    <li className={cn('rounded-lg border bg-background p-4', meta === undefined && caveat === undefined ? 'space-y-1' : 'space-y-1.5')}>
      <ExternalLink href={href} className={cn('text-sm font-medium text-primary hover:underline', FOCUS_RING)} iconClassName={LINK_ICON}>
        {label}
      </ExternalLink>
      {meta !== undefined && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
      <p className={cn('text-sm', mutedDescription && 'text-muted-foreground')}>{description}</p>
      {features !== undefined && features.length > 0 && (
        <ul aria-label={`${label} features`} className="flex flex-wrap gap-x-1.5 text-xs text-foreground/80">
          {features.map((feature) => (
            <li key={feature} className="whitespace-nowrap after:ml-1.5 after:text-muted-foreground after:content-['·'] last:after:hidden">
              {feature}
            </li>
          ))}
        </ul>
      )}
      {caveat !== undefined && <p className="text-xs text-muted-foreground">{caveat}</p>}
      {sourceUrl !== undefined && (
        <ExternalLink
          href={sourceUrl}
          className={cn('inline-block text-xs text-muted-foreground hover:text-foreground hover:underline', FOCUS_RING)}
          iconClassName={LINK_ICON}
        >
          Source on GitHub
        </ExternalLink>
      )}
    </li>
  );
}
