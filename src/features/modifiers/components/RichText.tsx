import { ExternalLink } from '@/components/ExternalLink';
import type { RichLine } from '../utils/modifiersView';
import { SourceBadge } from './SourceBadge';

/**
 * One resolved content line: text, `code`, **bold**, links and the source badges after each claim. `badgeDetails`:
 * a badge with a detail ("D2MOO SUnitDmg.cpp:…") opens it on click or tap; off inside a link (the list cards).
 */
export function RichText({ line, badgeDetails = true }: { readonly line: RichLine; readonly badgeDetails?: boolean }) {
  return (
    <>
      {line.map((token, index) => {
        // Tokens never reorder: the index is a stable key
        const key = String(index);
        switch (token.type) {
          case 'text':
            return <span key={key}>{token.text}</span>;
          case 'code':
            return (
              <code key={key} className="rounded bg-muted px-1 py-px font-mono text-[0.85em] break-words">
                {token.text}
              </code>
            );
          case 'strong':
            return (
              <strong key={key} className="font-semibold">
                {token.text}
              </strong>
            );
          case 'link':
            return (
              <ExternalLink key={key} href={token.href} className="break-words text-primary hover:underline" iconClassName="inline size-3">
                {token.text}
              </ExternalLink>
            );
          case 'tag':
            return <SourceBadge key={key} tag={token.tag} details={badgeDetails} />;
        }
      })}
    </>
  );
}
