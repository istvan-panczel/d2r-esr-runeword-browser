import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CubeMergedRow, CubeRecipe, CubeSection } from '../engine/schema';
import { enhanceTabHref, familyAnchor, formatCount, sectionDocsUrl, type CubeFamilyView, type CubeGroupView } from '../utils/cube';
import { BonusLines } from './EnhanceParts';
import { LIST_CARD_CLASS, LIST_CARD_HEADER_CLASS, LIST_CARD_SUBHEAD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 px-3 py-2 text-sm break-words';

/** A link to the official docs page, opening in a new tab */
export function DocsLink({
  href,
  children,
  className,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-0.5 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary',
        className
      )}
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

function Conditions({ conditions }: { readonly conditions: readonly string[] }) {
  if (conditions.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {conditions.map((condition) => (
        <Badge key={condition} variant="outline" className="text-[11px] font-normal">
          {condition}
        </Badge>
      ))}
    </span>
  );
}

function MergedRow({ row }: { readonly row: CubeMergedRow }) {
  return (
    <li className={ROW_GRID}>
      <ul className="space-y-0.5">
        {row.inputs.map((input, i) => (
          // Inputs can repeat ("Key", "Key"); the position keeps keys unique
          <li key={`${String(i)}-${input}`}>{input}</li>
        ))}
      </ul>
      <span className="text-muted-foreground" aria-label="gives">
        →
      </span>
      <div>
        <p className="font-medium">{row.output}</p>
        {row.outputLevel !== undefined && <p className="text-xs text-muted-foreground">{row.outputLevel}</p>}
        {row.dstoneCaps !== undefined && (
          <p className="text-xs text-muted-foreground" title="What this D-stoning adds in total before its cap condition stops it">
            Cap: {row.dstoneCaps.join(' / ')}
          </p>
        )}
        {row.variants > 1 && <p className="text-xs text-muted-foreground">{formatCount(row.variants)} cubemain rows</p>}
        {row.enhanceTab !== undefined && (
          <p className="text-xs">
            <Link
              to={enhanceTabHref(row.enhanceTab)}
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2"
            >
              All {formatCount(row.variants)} outcomes on the Enhance page
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}

function RawRecipe({ recipe }: { readonly recipe: CubeRecipe }) {
  return (
    <li className={ROW_GRID}>
      <ul className="space-y-0.5">
        {recipe.inputs.map((input, i) => (
          <li key={`${String(i)}-${input.text}`}>{input.text}</li>
        ))}
      </ul>
      <span className="text-muted-foreground" aria-label="gives">
        →
      </span>
      <div className="space-y-1">
        {recipe.outputs.map((output, i) => (
          <div key={`${String(i)}-${output.text}`}>
            <p className="font-medium">
              {output.text}
              {output.details.length > 0 && <span className="font-normal text-muted-foreground"> ({output.details.join(', ')})</span>}
            </p>
            {output.level !== undefined && <p className="text-xs text-muted-foreground">{output.level}</p>}
            {output.bonus.length > 0 && <BonusLines lines={output.bonus} className="text-xs" />}
          </div>
        ))}
        <Conditions conditions={recipe.conditions} />
        <p className="text-[11px] text-muted-foreground" title="The cubemain.txt description (a developer label) and line">
          {recipe.description} · line {recipe.id}
        </p>
      </div>
    </li>
  );
}

function GroupBlock({
  view,
  showHeader,
  expanded,
}: {
  readonly view: CubeGroupView;
  readonly showHeader: boolean;
  readonly expanded: boolean;
}) {
  const { group, rows, recipes } = view;
  return (
    <div>
      {showHeader && (
        <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', LIST_CARD_SUBHEAD_CLASS)}>
          <p className="text-xs font-medium text-muted-foreground" title="The recipe shape, from the cubemain.txt descriptions">
            {group.label}
          </p>
          {/* A single merged row already counts its cubemain rows */}
          {rows.length > 1 && <span className="text-[11px] text-muted-foreground">{formatCount(group.rowCount)} rows</span>}
          <Conditions conditions={group.conditions} />
        </div>
      )}
      {!showHeader && group.conditions.length > 0 && (
        <div className={LIST_CARD_SUBHEAD_CLASS}>
          <Conditions conditions={group.conditions} />
        </div>
      )}
      {expanded && recipes.length > 0 ? (
        <ul className={cn('divide-y bg-muted/20', ROW_LIST_COLUMNS)}>
          {recipes.map((recipe) => (
            <RawRecipe key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      ) : (
        rows.length > 0 && (
          <ul className={cn('divide-y', ROW_LIST_COLUMNS)}>
            {rows.map((row, i) => (
              <MergedRow key={`${String(i)}-${row.output}`} row={row} />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function showAllLabel(count: number, searching: boolean): string {
  const matching = searching ? 'matching ' : '';
  return count === 1 ? `Show the ${matching}cubemain row` : `Show all ${formatCount(count)} ${matching}cubemain rows`;
}

interface CubeFamilySectionProps {
  readonly view: CubeFamilyView;
  readonly section: CubeSection;
  /** True while a search or the quality filter narrows the rows */
  readonly searching: boolean;
  readonly onFocus: (family: string) => void;
}

/** One family: its header, the merged rows per group and (small families) every cubemain row behind "Show all". */
export function CubeFamilySection({ view, section, searching, onFocus }: CubeFamilySectionProps) {
  const { family, groups } = view;
  const [showAll, setShowAll] = useState(false);
  const docs = sectionDocsUrl(section);
  const rawCount = groups.reduce((sum, group) => sum + group.recipes.length, 0);
  // A search that only matched raw rows (no merged row) shows those rows
  const onlyRaw = searching && groups.every((group) => group.rows.length === 0);
  const expanded = showAll || onlyRaw;

  return (
    <section
      id={familyAnchor(family.id)}
      aria-labelledby={`${familyAnchor(family.id)}-title`}
      className={cn('scroll-mt-20', LIST_CARD_CLASS)}
    >
      <header className={LIST_CARD_HEADER_CLASS}>
        <h3 id={`${familyAnchor(family.id)}-title`} className="text-base font-semibold">
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => {
              onFocus(family.id);
            }}
            title="Show only this family"
          >
            {family.label}
          </button>
        </h3>
        <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
          <span>
            {formatCount(family.rowCount)} {family.rowCount === 1 ? 'recipe' : 'recipes'}
          </span>
          {docs !== null && <DocsLink href={docs}>Official: {section.label}</DocsLink>}
        </div>
      </header>
      <div className="divide-y">
        {groups.map((group) => (
          // One group holding the whole family needs no header
          <GroupBlock key={group.group.id} view={group} showHeader={group.group.rowCount !== family.rowCount} expanded={expanded} />
        ))}
      </div>
      {family.raw && rawCount > 0 && !onlyRaw && (
        <div className="border-t px-4 py-2">
          <button
            type="button"
            className="text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            onClick={() => {
              setShowAll(!showAll);
            }}
          >
            {showAll ? 'Show the merged rows' : showAllLabel(rawCount, searching)}
          </button>
        </div>
      )}
    </section>
  );
}
