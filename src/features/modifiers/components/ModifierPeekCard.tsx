import { Link } from 'react-router-dom';
import { useModifierRefIndex } from '../hooks/useModifierRefIndex';
import { peekNumbers } from '../utils/modifierPeek';
import type { ModifierRef } from '../utils/modifierRefData';
import { modifierRefUrl } from '../utils/modifierRefs';
import { FACT_ORIGIN_SOURCE } from '../utils/sourceKinds';
import { SourceBadge } from './SourceBadge';

/**
 * The modifier peek of an item line: the /modifiers entry's title and main source, its one-line summary, one or two
 * ESR numbers (for this line's value where that matters) and a link to the page (`newTab`: in a new tab, for lines inside
 * a form whose edits would be lost). Everything comes from data/modifierRefs.json, already loaded for the line.
 */
export function ModifierPeekCard({ modifierRef, newTab = false }: { readonly modifierRef: ModifierRef; readonly newTab?: boolean }) {
  const index = useModifierRefIndex();
  const entry = index?.byKey.get(modifierRef.key);
  if (index === null || entry === undefined) return <p className="text-muted-foreground">Loading the modifier…</p>;
  const numbers = peekNumbers(modifierRef, index.facts);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="font-semibold leading-tight">{entry.title}</p>
        <SourceBadge tag={{ kind: entry.source }} className="mx-0" />
      </div>
      <p className="text-xs">
        {entry.summary ?? 'No hand-written explanation yet: the Modifiers page lists its stats, numbers and items.'}
      </p>
      {numbers.length > 0 && (
        <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
          {numbers.map((number) => {
            const source = FACT_ORIGIN_SOURCE[number.origin];
            return (
              <li key={number.text}>
                {number.text}
                {/* Only a source other than the title's: "Vanilla D2" marks an engine number not confirmed for ESR */}
                {source !== entry.source && <SourceBadge tag={{ kind: source }} className="ml-1.5" />}
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to={modifierRefUrl(entry.key)}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Open in Modifiers {newTab ? '(new tab) ' : ''}→
      </Link>
    </div>
  );
}
