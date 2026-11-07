import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { cubeCellIcon, type CubeIconRef } from '../engine/cubeIcons';
import { parsePerkCheck, specializationHref } from '../engine/specializationLinks';
import type { CubeMergedRow, CubeRecipe, CubeSection } from '../engine/schema';
import { enhanceTabHref, familyAnchor, formatCount, sectionDocsUrl, type CubeFamilyView, type CubeGroupView } from '../utils/cube';
import { CellIcon } from './CellIcon';
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

/** A guide note: its slug and title */
export interface CubeGuideNote {
  readonly slug: string;
  readonly title: string;
}

/** "Guide: Forging · Mercenaries" links to the guide notes */
export function GuideLinks({ notes, className }: { readonly notes: readonly CubeGuideNote[]; readonly className?: string }) {
  if (notes.length === 0) return null;
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', className)}>
      <span className="text-muted-foreground">Guide:</span>
      {notes.map((note) => (
        <Link
          key={note.slug}
          to={`/guide/${note.slug}`}
          className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          <BookOpen className="size-3" aria-hidden />
          {note.title}
        </Link>
      ))}
    </p>
  );
}

/** Short notes (the official page's rules, fail-safe limits) as a muted list */
export function CubeNotes({ notes, className }: { readonly notes: readonly string[]; readonly className?: string }) {
  if (notes.length === 0) return null;
  return (
    <ul className={cn('list-disc space-y-0.5 pl-4 text-xs text-muted-foreground', className)}>
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

/** A condition's text; a specialisation perk check links the perk on the Specializations page */
function ConditionText({ condition }: { readonly condition: string }) {
  const perk = parsePerkCheck(condition);
  if (perk === null) return condition;
  return (
    <>
      {perk.prefix}
      {perk.tree} perk{' '}
      <Link
        to={specializationHref(perk.tree, perk.title)}
        className="underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {perk.title}
      </Link>
      {perk.suffix}
    </>
  );
}

function Conditions({ conditions }: { readonly conditions: readonly string[] }) {
  if (conditions.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {conditions.map((condition) => (
        <Badge key={condition} variant="outline" className="h-auto max-w-full text-left text-[11px] font-normal whitespace-normal">
          <ConditionText condition={condition} />
        </Badge>
      ))}
    </span>
  );
}

/** cube.json `icons` (cell text → icon token); undefined in an older bundle */
type CubeIcons = Readonly<Record<string, string>> | undefined;

/** Indent of the lines under a result that has an icon: the slot (1.75rem) and the gap (0.375rem) */
const UNDER_ICON = 'pl-[2.125rem]';

/** A cell with its icon slot in front; `slot` false (no cell of the list has an icon) leaves the slot out */
function Cell({
  icon,
  slot,
  className,
  children,
}: {
  readonly icon: CubeIconRef | null;
  readonly slot: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  if (!slot) return <span className={cn('block pt-1', className)}>{children}</span>;
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <CellIcon item={icon} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** The inputs of a row, each with its icon (the slots only when any input has one) */
function Inputs({ inputs, icons }: { readonly inputs: readonly string[]; readonly icons: CubeIcons }) {
  const refs = inputs.map((input) => cubeCellIcon(input, icons));
  const slot = refs.some((ref) => ref !== null);
  return (
    <ul className="space-y-0.5">
      {inputs.map((input, i) => (
        // Inputs can repeat ("Key", "Key"); the position keeps keys unique
        <li key={`${String(i)}-${input}`}>
          <Cell icon={refs[i] ?? null} slot={slot}>
            {input}
          </Cell>
        </li>
      ))}
    </ul>
  );
}

function Arrow() {
  return (
    <span className="pt-1 text-muted-foreground" aria-label="gives">
      →
    </span>
  );
}

function MergedRow({ row, icons }: { readonly row: CubeMergedRow; readonly icons: CubeIcons }) {
  const output = cubeCellIcon(row.output, icons);
  return (
    <li className={ROW_GRID}>
      <Inputs inputs={row.inputs} icons={icons} />
      <Arrow />
      <div>
        <Cell icon={output} slot={output !== null} className="font-medium">
          {row.output}
        </Cell>
        <div className={cn(output !== null && UNDER_ICON)}>
          {row.outputLevel !== undefined && <p className="text-xs text-muted-foreground">{row.outputLevel}</p>}
          {row.dstoneCaps !== undefined && (
            <p className="text-xs text-muted-foreground" title="What this D-stoning adds in total before its cap condition stops it">
              Cap: {row.dstoneCaps.join(' / ')}
            </p>
          )}
          {row.odds !== undefined && (
            <ul className="text-xs" aria-label="Odds">
              {row.odds.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {row.returned !== undefined && (
            <p className="text-xs text-muted-foreground" title="Ingredients the cube hands back unchanged">
              Given back: {row.returned}
            </p>
          )}
          {row.conditions !== undefined && <Conditions conditions={row.conditions} />}
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
      </div>
    </li>
  );
}

function RawRecipe({ recipe, icons }: { readonly recipe: CubeRecipe; readonly icons: CubeIcons }) {
  const outputs = recipe.outputs.map((output) => cubeCellIcon(output.text, icons));
  const slot = outputs.some((ref) => ref !== null);
  return (
    <li className={ROW_GRID}>
      <Inputs inputs={recipe.inputs.map((input) => input.text)} icons={icons} />
      <Arrow />
      <div className="space-y-1">
        {recipe.outputs.map((output, i) => (
          <div key={`${String(i)}-${output.text}`}>
            <Cell icon={outputs[i] ?? null} slot={slot} className="font-medium">
              {output.text}
              {output.details.length > 0 && <span className="font-normal text-muted-foreground"> ({output.details.join(', ')})</span>}
            </Cell>
            <div className={cn(slot && UNDER_ICON)}>
              {output.level !== undefined && <p className="text-xs text-muted-foreground">{output.level}</p>}
              {output.bonus.length > 0 && <BonusLines lines={output.bonus} className="text-xs" />}
            </div>
          </div>
        ))}
        <div className={cn('space-y-1', slot && UNDER_ICON)}>
          <Conditions conditions={recipe.conditions} />
          <p className="text-[11px] text-muted-foreground" title="The cubemain.txt description (a developer label) and line">
            {recipe.description} · line {recipe.id}
          </p>
        </div>
      </div>
    </li>
  );
}

function GroupBlock({
  view,
  showHeader,
  expanded,
  icons,
}: {
  readonly view: CubeGroupView;
  readonly showHeader: boolean;
  readonly expanded: boolean;
  readonly icons: CubeIcons;
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
            <RawRecipe key={recipe.id} recipe={recipe} icons={icons} />
          ))}
        </ul>
      ) : (
        rows.length > 0 && (
          <ul className={cn('divide-y', ROW_LIST_COLUMNS)}>
            {rows.map((row, i) => (
              <MergedRow key={`${String(i)}-${row.output}`} row={row} icons={icons} />
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
  /** cube.json `icons` */
  readonly icons: CubeIcons;
  /** Guide notes that show this family (the section's are listed above it); empty without the guide bundle */
  readonly guideNotes: readonly CubeGuideNote[];
}

/** One family: its header, the merged rows per group and (small families) every cubemain row behind "Show all". */
export function CubeFamilySection({ view, section, searching, onFocus, icons, guideNotes }: CubeFamilySectionProps) {
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
        {family.notes !== undefined && <CubeNotes notes={family.notes} className="basis-full" />}
        <GuideLinks notes={guideNotes} className="basis-full" />
      </header>
      <div className="divide-y">
        {groups.map((group) => (
          // One group holding the whole family needs no header
          <GroupBlock
            key={group.group.id}
            view={group}
            showHeader={group.group.rowCount !== family.rowCount}
            expanded={expanded}
            icons={icons}
          />
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
