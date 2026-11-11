import { ChevronRight } from 'lucide-react';
import { ExternalLink } from '@/components/ExternalLink';
import { FRAME_TABLE_URL } from '@/core/navigation/navConfig';
import { cn } from '@/lib/utils';
import type { CharacterTab } from '../../engine/characterTabs';
import { DIFFICULTY_NAMES } from '../../engine/sheet/statLabels';
import type { CharacterSheet } from '../../engine/sheet/types';
import {
  attributeRows,
  experienceToNext,
  handRows,
  overviewRows,
  poolRows,
  resistReadouts,
  STATUS_TEXT,
  whereText,
  type HandRow,
  type PoolRow,
} from '../../engine/sheetView';
import type { CharacterSheetState } from '../../hooks/useCharacterSheet';
import type { CharacterFile } from '../../parser/types';
import { NUMBER_FORMAT } from '../tabs/tabClasses';
import { BuffedBadge, UnbuffedBadge } from './BuffedBadge';
import { BuffsPanel } from './BuffsPanel';
import { ResistMeters } from './ResistMeters';
import { SheetCard, SourcesPopover, StatList, StatusMark, ValueText, type ItemNamer } from './SheetParts';

type ReadySheet = Extract<CharacterSheetState, { status: 'ready' }>;

const LINK_CLASS =
  'inline-flex items-center gap-0.5 rounded text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring';

/** Life red, mana blue, stamina gold: the game's orbs and bar, as a thin edge on each tile (identity, not state) */
const POOL_EDGE: Readonly<Record<string, string>> = {
  life: 'border-l-red-600 dark:border-l-red-500',
  mana: 'border-l-blue-600 dark:border-l-blue-400',
  stamina: 'border-l-yellow-500 dark:border-l-yellow-400',
};

/** What the sheet counts and leaves out, the markers' meaning and the engine's warnings */
function SheetIntro({ sheet, buffed }: { readonly sheet: CharacterSheet; readonly buffed: boolean }) {
  return (
    <section aria-label="What these numbers count" className="space-y-2 rounded-xl border bg-card p-3 text-sm shadow-sm sm:p-4">
      <p className="flex flex-wrap items-center gap-2">
        {buffed ? <BuffedBadge /> : <UnbuffedBadge />}
        <span className="text-muted-foreground">
          Weapon set {sheet.weaponSet === 1 ? 'I' : 'II'}, resists for {DIFFICULTY_NAMES[sheet.difficulty]}
          {sheet.difficulty === sheet.facts.saveDifficulty ? ' (where the save is)' : ''}
        </span>
      </p>
      <p className="max-w-prose text-muted-foreground">
        Worked out from the save as the character screen shows it standing idle at full life: the gear of the active weapon set, the charms
        in the Charm Inventory, set bonuses, passive skills and item auras.{' '}
        {buffed ? 'Plus the buffs switched on below. ' : 'Buffs you cast are not counted: switch them on under Buffs. '}
        Never counted: shrines, elixirs, potions, charges, states like Whirlwind, and your mercenary&apos;s auras.
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Select any number to see where it comes from.</span>
        <span className="inline-flex items-center gap-1">
          <StatusMark status="inferred" /> {STATUS_TEXT.inferred.short}: not yet compared with the game
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusMark status="unverified" /> {STATUS_TEXT.unverified.short}: changed by a buff
        </span>
      </p>
      {sheet.warnings.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            {sheet.warnings.length} {sheet.warnings.length === 1 ? 'note' : 'notes'} from the calculation
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {sheet.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function PoolTile({ row, itemName }: { readonly row: PoolRow; readonly itemName: ItemNamer }) {
  return (
    <li className={cn('rounded-xl border border-l-4 bg-card shadow-sm', POOL_EDGE[row.key])}>
      <SourcesPopover
        title={row.label}
        text={row.text}
        value={row.value}
        unbuffedText={row.unbuffedText}
        itemName={itemName}
        className="h-full rounded-l-none rounded-r-xl px-3 py-2"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {row.label}
          <StatusMark status={row.value.status} />
        </span>
        <ValueText text={row.text} unbuffedText={row.unbuffedText} className="text-3xl font-semibold tracking-tight" />
        <span className="block text-xs text-muted-foreground">
          When saved <span className="tabular-nums">{row.savedText}</span>
          {row.savedAbove && (
            <span className="block text-amber-700 dark:text-amber-400">
              Above this maximum: a buff or a shape-shift was likely active when the game saved.
            </span>
          )}
        </span>
      </SourcesPopover>
    </li>
  );
}

function AttributesCard({
  sheet,
  unbuffed,
  itemName,
}: {
  readonly sheet: CharacterSheet;
  readonly unbuffed: CharacterSheet | null;
  readonly itemName: ItemNamer;
}) {
  const rows = attributeRows(sheet, unbuffed, NUMBER_FORMAT);
  const grid = 'grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_4.5rem] items-baseline gap-x-2';
  return (
    <SheetCard id="character-attributes" title="Attributes">
      <div className={cn(grid, 'px-1.5 pb-1 text-xs text-muted-foreground')} aria-hidden>
        <span />
        <span className="text-right">Base</span>
        <span className="text-right">Bonus</span>
        <span className="text-right">Total</span>
      </div>
      <ul className="-mx-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.key}>
            <SourcesPopover title={row.label} text={row.text} value={row.value} unbuffedText={row.unbuffedText} itemName={itemName}>
              <span className={cn(grid, 'px-1.5 py-0.5')}>
                <span className="text-muted-foreground group-hover:text-foreground">{row.label}</span>
                <span className="text-right text-muted-foreground tabular-nums">
                  <span className="sr-only">base </span>
                  {NUMBER_FORMAT.format(row.base)}
                </span>
                <span className="text-right text-muted-foreground tabular-nums">
                  <span className="sr-only">bonus </span>
                  {row.bonusText ?? '0'}
                </span>
                <span className="flex items-baseline justify-end gap-1 font-semibold">
                  <ValueText
                    text={row.text}
                    unbuffedText={row.unbuffedText}
                    className="underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
                  />
                  <StatusMark status={row.value.status} className="self-center" />
                </span>
              </span>
            </SourcesPopover>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Base: points put in by hand and the class start values, as the save stores them.</p>
    </SheetCard>
  );
}

function HandList({ rows, itemName }: { readonly rows: readonly HandRow[]; readonly itemName: ItemNamer }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No skill on the mouse buttons uses attack rating.</p>;
  return (
    <ul className="-mx-1.5 text-sm">
      {rows.map((row) => (
        <li key={row.key}>
          <SourcesPopover
            title={`${row.label} attack rating`}
            text={row.text}
            value={row.value}
            unbuffedText={row.unbuffedText}
            itemName={itemName}
          >
            <span className="flex items-baseline justify-between gap-3 px-1.5 py-0.5">
              <span className="min-w-0">
                <span className="text-foreground">{row.label}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  {row.hand}, level {row.level}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 font-semibold">
                <ValueText
                  text={row.text}
                  unbuffedText={row.unbuffedText}
                  className="underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
                />
                <StatusMark status={row.status} className="self-center" />
              </span>
            </span>
          </SourcesPopover>
        </li>
      ))}
    </ul>
  );
}

function LevelCard({ sheet }: { readonly sheet: CharacterSheet }) {
  const { facts } = sheet;
  const next = experienceToNext(sheet, NUMBER_FORMAT);
  const rows: readonly (readonly [string, string])[] = [
    ['Where', whereText(sheet)],
    ['Experience', NUMBER_FORMAT.format(facts.experience)],
    ['Next level', next ?? 'Highest level'],
    ['Unspent stat points', NUMBER_FORMAT.format(facts.statPoints)],
    ['Unspent skill points', NUMBER_FORMAT.format(facts.skillPoints)],
    ['Gold on the character', NUMBER_FORMAT.format(facts.gold)],
    ['Gold in the stash', NUMBER_FORMAT.format(facts.goldStash)],
  ];
  return (
    <SheetCard id="character-level" title={`Level ${String(facts.level)}`}>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </SheetCard>
  );
}

interface OverviewSheetProps {
  readonly character: CharacterFile;
  readonly state: ReadySheet;
  readonly itemName: ItemNamer;
  readonly onTab: (tab: CharacterTab) => void;
}

/** The Overview's computed sheet: what is counted, life / mana / stamina, then the cards, the buffs and the level */
export function OverviewSheet({ character, state, itemName, onTab }: OverviewSheetProps) {
  const { sheet, unbuffed } = state;
  const buffed = sheet.buffs.length > 0;
  const rows = overviewRows(sheet, unbuffed, NUMBER_FORMAT);
  const pools = poolRows(sheet, unbuffed, character.baseAttributes, NUMBER_FORMAT);
  return (
    <div className="space-y-4">
      <SheetIntro sheet={sheet} buffed={buffed} />

      <ul aria-label="Life, mana and stamina" className="grid gap-3 @2xl/page:grid-cols-3">
        {pools.map((row) => (
          <PoolTile key={row.key} row={row} itemName={itemName} />
        ))}
      </ul>

      <div className="grid items-start gap-4 @3xl/page:grid-cols-2 @6xl/page:grid-cols-3">
        <AttributesCard sheet={sheet} unbuffed={unbuffed} itemName={itemName} />
        <ResistMeters
          readouts={resistReadouts(sheet, unbuffed, NUMBER_FORMAT)}
          difficulty={state.difficulty}
          saveDifficulty={sheet.facts.saveDifficulty}
          onDifficulty={state.setDifficulty}
          itemName={itemName}
        />
        <SheetCard id="character-defense" title="Defense">
          <StatList rows={rows.defense} itemName={itemName} />
          {rows.absorb.length > 0 && (
            <>
              <h4 className="mt-2 text-xs font-medium text-muted-foreground">Absorb</h4>
              <StatList rows={rows.absorb} itemName={itemName} />
            </>
          )}
          {sheet.block === null && (
            <p className="mt-2 text-xs text-muted-foreground">No shield in the active weapon set: no block chance.</p>
          )}
        </SheetCard>
        <SheetCard id="character-offense" title="Offense">
          <h4 className="text-xs font-medium text-muted-foreground">Attack rating per skill</h4>
          <HandList rows={handRows(sheet, unbuffed, NUMBER_FORMAT)} itemName={itemName} />
          <div className="mt-2">
            <StatList rows={rows.offense} itemName={itemName} />
          </div>
        </SheetCard>
        <SheetCard
          id="character-speed"
          title="Speed"
          actions={
            <ExternalLink href={FRAME_TABLE_URL} className={LINK_CLASS} iconClassName="size-3">
              Breakpoints: Frame Table
            </ExternalLink>
          }
        >
          <StatList rows={rows.speed} itemName={itemName} />
        </SheetCard>
        <SheetCard
          id="character-find"
          title="Find, skills and recovery"
          actions={
            <button
              type="button"
              className={LINK_CLASS}
              onClick={() => {
                onTab('skills');
              }}
            >
              Skill levels <ChevronRight className="size-3" aria-hidden />
            </button>
          }
        >
          <StatList rows={[...rows.find, ...rows.recovery]} itemName={itemName} />
        </SheetCard>
        <LevelCard sheet={sheet} />
      </div>

      <BuffsPanel
        available={state.availableBuffs}
        selections={state.buffs}
        applied={sheet.buffs}
        itemName={itemName}
        onChange={state.setBuffs}
      />
    </div>
  );
}
