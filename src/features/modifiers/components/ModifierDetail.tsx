import { Link } from 'react-router-dom';
import { ArrowLeft, CircleHelp } from 'lucide-react';
import { ExternalLink } from '@/components/ExternalLink';
import type { ModifierFact, ModifierStat } from '@/features/game-data/engine/schema';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  entryExamples,
  exampleItemUrl,
  ITEM_KIND_LABELS,
  statDisplayText,
  usageSummary,
  type ModifierEntry,
} from '../utils/modifiersView';
import { keyed } from '@/features/skills/utils/skills';
import { plainText, tokenizeInline } from '../utils/modifierContent';
import { SOURCE_KINDS } from '../utils/sourceKinds';
import { ModifierCalculators } from './Calculators';
import { FactTables } from './FactTables';
import { RichText } from './RichText';

const SECTION_TITLE = 'text-xs font-semibold tracking-wide text-muted-foreground uppercase';
const LINK = 'text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

export function EntryChips({ entry, className }: { readonly entry: ModifierEntry; readonly className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1 text-[0.7rem]', className)}>
      <span className="rounded-full border px-2 py-px text-muted-foreground">{CATEGORY_LABELS[entry.category]}</span>
      {entry.esrOnly && (
        <span className="rounded-full border border-sky-600/40 bg-sky-500/10 px-2 py-px text-sky-800 dark:text-sky-300">ESR only</span>
      )}
      {entry.changed && (
        <span className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-2 py-px text-emerald-800 dark:text-emerald-300">
          Changed in ESR
        </span>
      )}
      {entry.technical && <span className="rounded-full border px-2 py-px text-muted-foreground">Technical (ESR bookkeeping)</span>}
      <span className="rounded-full border px-2 py-px text-muted-foreground">
        {entry.items === 0 ? 'on no item' : `${entry.items.toLocaleString('en-US')} item${entry.items === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}

function vanillaText(stat: ModifierStat): string {
  if (stat.vanilla === 'same') return 'Vanilla stat, same mechanics';
  if (stat.vanilla === 'changed') return `Vanilla stat, ESR changed ${stat.changed?.join(', ') ?? 'its mechanics'}`;
  return stat.reusesId === undefined ? 'ESR-only stat' : `ESR-only stat (reuses the row of vanilla ${stat.reusesId})`;
}

function StatRow({ stat }: { readonly stat: ModifierStat }) {
  const texts = [stat.text, stat.textNeg, stat.text2, stat.group].flatMap((text) => (text === undefined ? [] : [statDisplayText(text)]));
  const usage = usageSummary(stat.usage);
  return (
    <li className="space-y-1 rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{texts[0] ?? stat.stat}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {stat.stat} · {stat.id}
        </span>
      </div>
      {texts.length > 1 && <div className="text-xs text-muted-foreground">Also shown as: {texts.slice(1).join(' · ')}</div>}
      <div className={cn('text-xs', stat.vanilla === 'same' ? 'text-muted-foreground' : 'text-sky-800 dark:text-sky-300')}>
        {vanillaText(stat)}
        {stat.technical === true && ' · ESR bookkeeping (tinkering cap, display or hidden twin)'}
      </div>
      {stat.op !== undefined && (
        <div className="text-xs">
          <span className="text-muted-foreground">Feeds: </span>
          <code className="rounded bg-muted px-1 font-mono break-words">{stat.op.formula}</code>
        </div>
      )}
      {stat.events !== undefined && stat.events.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Triggers: </span>
          {stat.events.map((event) => `${event.trigger}: ${event.action}`).join('; ')}
        </div>
      )}
      {usage.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {usage.map((entry) => `${entry.label} ${entry.count.toLocaleString('en-US')}`).join(' · ')}
        </div>
      )}
    </li>
  );
}

function Examples({ entry, mythicals }: { readonly entry: ModifierEntry; readonly mythicals: ReadonlySet<string> }) {
  const examples = entryExamples(entry.stats);
  if (examples.length === 0) return <p className="text-sm text-muted-foreground">No ESR item, affix or recipe carries it.</p>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {examples.map((example) => {
        const href = exampleItemUrl(example.kind, example.name, mythicals);
        return (
          <li key={`${example.kind}:${example.name}`} className="min-w-0 break-words">
            {href === null ? (
              <span>{example.name}</span>
            ) : (
              <Link to={href} className={LINK}>
                {example.name}
              </Link>
            )}{' '}
            <span className="text-xs text-muted-foreground">({ITEM_KIND_LABELS[example.kind]})</span>
          </li>
        );
      })}
    </ul>
  );
}

function Unconfirmed({ entry }: { readonly entry: ModifierEntry }) {
  const caveats = entry.content?.caveats ?? [];
  const questions = entry.content?.questions ?? [];
  if (caveats.length === 0 && questions.length === 0) return null;
  return (
    <aside className="space-y-1.5 rounded-md border border-dashed border-amber-600/50 bg-amber-500/5 px-3 py-2 text-xs">
      <p className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
        <CircleHelp className="size-3.5" aria-hidden />
        Unconfirmed
      </p>
      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
        {keyed(caveats, plainText).map(({ key, value }) => (
          <li key={key}>
            <RichText line={value} />
          </li>
        ))}
        {questions.map((question) => (
          <li key={`q${String(question.number)}`}>
            <span className="font-medium text-foreground">{question.title}</span> ({question.how}).{' '}
            <RichText line={tokenizeInline(question.lines.join(' '))} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

interface ModifierDetailProps {
  readonly entry: ModifierEntry;
  readonly facts: readonly ModifierFact[];
  readonly mythicals: ReadonlySet<string>;
  /** The list link (keeps the search, category and view) */
  readonly backHref: string;
}

/** Everything about one modifier: the explanation with its sources, the numbers, calculators, the stats and the items */
export function ModifierDetail({ entry, facts, mythicals, backHref }: ModifierDetailProps) {
  const { content } = entry;
  const leechResource = entry.kinds.some((kind) => kind.key === 'mana-leech') ? 'mana' : 'life';
  return (
    <article aria-labelledby={`modifier-${entry.key}`} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="space-y-2">
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          All modifiers
        </Link>
        <h2 id={`modifier-${entry.key}`} className="text-xl font-semibold">
          {entry.title}
        </h2>
        <EntryChips entry={entry} />
        {entry.kinds.length > 1 && (
          <p className="text-xs text-muted-foreground">Covers: {entry.kinds.map((kind) => kind.title).join(' · ')}</p>
        )}
      </div>

      {content === null ? (
        <p className="text-sm text-muted-foreground">
          Generated from the game files: what the item line says, the stats it sets and the items that carry it. No hand-checked explanation
          yet.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="font-medium">
            <RichText line={content.summary} />
          </p>
          <p className="text-sm leading-relaxed">
            <RichText line={content.body} />
          </p>
          <Unconfirmed entry={entry} />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">What the source badges mean</summary>
            <div className="mt-1.5">
              <SourceLegend />
            </div>
          </details>
        </div>
      )}

      {entry.calculators.length > 0 && <ModifierCalculators calculators={entry.calculators} facts={facts} leechResource={leechResource} />}

      {entry.facts.length > 0 && (
        <section className="space-y-2">
          <h3 className={SECTION_TITLE}>Numbers</h3>
          <FactTables facts={entry.facts} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className={SECTION_TITLE}>Stats</h3>
        <ul className="space-y-2">
          {entry.stats.map((stat) => (
            <StatRow key={stat.id} stat={stat} />
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className={SECTION_TITLE}>Found on {entry.items > 0 ? `(${entry.items.toLocaleString('en-US')} items, examples)` : ''}</h3>
        <Examples entry={entry} mythicals={mythicals} />
      </section>

      {content !== null && content.facts.length > 0 && (
        <details className="group rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Technical details
          </summary>
          {content.factsIntro !== '' && <p className="mt-2 text-xs text-muted-foreground">{content.factsIntro}</p>}
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed break-words">
            {keyed(content.facts, plainText).map(({ key, value }) => (
              <li key={key}>
                <RichText line={value} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {content !== null && content.sources.length > 0 && (
        <footer className="space-y-1 border-t pt-3">
          <h3 className={SECTION_TITLE}>Sources</h3>
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
            {content.sources.map((source) => (
              <li key={source.text} className="break-words">
                {source.href === null ? (
                  source.text
                ) : (
                  <ExternalLink href={source.href} className="hover:text-foreground hover:underline" iconClassName="inline size-3">
                    {source.text}
                  </ExternalLink>
                )}
              </li>
            ))}
          </ol>
        </footer>
      )}
    </article>
  );
}

/** The meaning of each source badge */
export function SourceLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {Object.entries(SOURCE_KINDS).map(([kind, info]) => (
        <li key={kind} className="flex items-baseline gap-1.5">
          <span className={cn('shrink-0 rounded border px-1 py-px text-[0.68rem] font-medium whitespace-nowrap', info.className)}>
            {info.short}
          </span>
          <span>{info.full}</span>
        </li>
      ))}
    </ul>
  );
}
