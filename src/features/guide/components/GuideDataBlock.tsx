/* eslint-disable react-x/no-array-index-key -- the body is a static generated tree that never reorders, so positional keys are stable */
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import type { SourceLabel } from '@/features/game-data/engine/schema';
import { cn } from '@/lib/utils';
import { DROP_FINDER_URL } from '../engine/linkSchemes';
import type { DataBlock } from '../engine/schema';
import { sourceCells } from '../utils/guideUtils';
import { GuideCardBoundary } from './GuideCardBoundary';
import { ExternalLink } from '@/components/ExternalLink';
import { GlossaryAppLink } from './GlossaryAppLink';
import { GuideCardFailed, GuideCardLoading } from './GuideCardPlaceholder';
import { GuideTable } from './GuideTable';
import { SectionLabel } from './SectionLabel';
import { INSET, LINK_CLASS } from './styles';

/** Lazy: the item cards (and the Dexie/game-data hooks behind them) are only fetched by notes that embed a card. */
const GuideItemCard = lazy(() => import('./GuideItemCard'));

const INSET_LIST = cn('divide-y rounded-md text-sm', INSET);

interface SourceBlockProps {
  readonly item: string;
  readonly labels: readonly SourceLabel[];
}

function SourceBlock({ item, labels }: SourceBlockProps) {
  return (
    <section className={cn('rounded-md p-3', INSET)} aria-label={`Where ${item} comes from`}>
      <p className="mb-2 text-sm font-semibold">
        Where it comes from: <span className="text-foreground">{item}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sourceCells(labels).map((cell) => (
          <div key={cell.key} className="rounded border bg-card/70 p-2">
            <SectionLabel as="p">{cell.title}</SectionLabel>
            {cell.labels.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm">
                {cell.labels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <p>Derived from the game files; may be incomplete.</p>
        {/* The plain page only: the Drop Finder's deep links are positional and change with every ESR release. */}
        <ExternalLink href={DROP_FINDER_URL} className={LINK_CLASS} iconClassName="ml-0.5 inline size-[0.9em] align-[-0.1em]">
          Look it up in the Drop Finder
        </ExternalLink>
      </div>
    </section>
  );
}

interface CaptionProps {
  readonly children: string;
}

function Caption({ children }: CaptionProps) {
  return (
    <SectionLabel as="p" className="mb-1.5">
      {children}
    </SectionLabel>
  );
}

interface GuideDataBlockProps {
  readonly block: DataBlock;
}

/** Renders a directive's data block (tables, item lists, recipes, sources, glossary, embedded item cards). */
export function GuideDataBlock({ block }: GuideDataBlockProps) {
  switch (block.kind) {
    case 'table':
      return (
        <figure>
          <Caption>{block.caption}</Caption>
          <GuideTable header={block.header} rows={block.rows} renderCell={(cell) => cell} />
        </figure>
      );
    case 'items':
      return (
        <figure>
          <Caption>{block.caption}</Caption>
          <ul className={INSET_LIST}>
            {block.items.map((item, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5">
                <span className="font-medium">{item.label}</span>
                {item.detail !== null && <span className="text-xs text-muted-foreground">{item.detail}</span>}
              </li>
            ))}
          </ul>
        </figure>
      );
    case 'recipes':
      return (
        <figure>
          <Caption>{block.caption}</Caption>
          <ul className={INSET_LIST}>
            {block.rows.map((row, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 px-3 py-2 break-words">
                <ul className="space-y-0.5">
                  {row.inputs.map((input, j) => (
                    <li key={j}>{input}</li>
                  ))}
                </ul>
                <span className="text-muted-foreground" aria-label="gives">
                  →
                </span>
                <div>
                  <p className="font-medium">{row.output}</p>
                  {row.note !== null && <p className="text-xs text-muted-foreground">{row.note}</p>}
                </div>
              </li>
            ))}
          </ul>
          {block.link !== undefined && (
            <p className="mt-1.5 text-right text-xs">
              <Link to={block.link.href} className={LINK_CLASS}>
                {block.link.label} on the Cube Recipes page
              </Link>
            </p>
          )}
        </figure>
      );
    case 'card':
      return (
        <GuideCardBoundary fallback={<GuideCardFailed name={block.name} href={block.href} />}>
          <Suspense fallback={<GuideCardLoading name={block.name} />}>
            <GuideItemCard block={block} />
          </Suspense>
        </GuideCardBoundary>
      );
    case 'source':
      return <SourceBlock item={block.item} labels={block.labels} />;
    case 'glossary':
      return (
        <dl className={INSET_LIST}>
          {block.entries.map((entry) => (
            <div key={entry.term} id={`term-${entry.term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="px-3 py-2">
              <dt className="font-semibold">
                {entry.note !== null ? (
                  <Link to={`/guide/${entry.note}`} className={LINK_CLASS}>
                    {entry.term}
                  </Link>
                ) : (
                  entry.term
                )}
              </dt>
              <dd className="mt-0.5 text-muted-foreground">
                {entry.definition}
                {entry.link !== undefined && <GlossaryAppLink href={entry.link} className="ml-2" />}
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}
