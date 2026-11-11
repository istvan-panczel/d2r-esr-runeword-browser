import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { ItemCard } from '@/features/stash/components/items/ItemCards';
import { ToneBadge } from '@/features/stash/components/shared/ToneBadge';
import { SPECIALIZATIONS_ROUTE, specializationsParams } from '@/features/specializations/utils/specializationsView';
import { cn } from '@/lib/utils';
import type { PlacedItemRow } from '../../engine/characterItems';
import { progressCounters, specializationProgress } from '../../engine/characterProgress';
import { DIFFICULTY_NAMES } from '@/features/builds/utils/statLabels';
import type { SheetFacts } from '../../engine/sheet/types';
import { ledgerBossName, resistScrollsText } from '../../engine/sheetView';
import { useCharacterItems } from '../../hooks/useCharacterItems';
import { useCharacterSheet } from '../../hooks/useCharacterSheet';
import type { CharacterFile } from '../../parser/types';
import { CARD_CLASS, NUMBER_FORMAT } from './tabClasses';

const FILES = ['specializations'] as const;
const LINK_CLASS = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

const perkUrl = (tree: string, perk: string) => `/${SPECIALIZATIONS_ROUTE}?${specializationsParams(tree, perk).toString()}`;

interface CounterProps {
  readonly label: string;
  readonly value: number;
  readonly hint?: string;
  /** Text before the number ("Hell, act ") */
  readonly prefix?: string;
}

function Counter({ label, value, hint, prefix }: CounterProps) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {prefix}
        {NUMBER_FORMAT.format(value)}
      </dd>
      {hint !== undefined && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

interface PlacedItemsProps {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly PlacedItemRow[];
  readonly empty: ReactNode;
  readonly link: (row: PlacedItemRow) => ReactNode;
  /** What the computed sheet reads from the active one (tier, boss flags) */
  readonly summary?: ReactNode;
}

/** The Kill Ledger or Ascendancy Stone cards, each with where it is and the page about it */
function PlacedItems({ id, title, rows, empty, link, summary }: PlacedItemsProps) {
  return (
    <section aria-labelledby={id} className={cn(CARD_CLASS, 'space-y-3')}>
      <h3 id={id} className="font-semibold">
        {title}
      </h3>
      {summary}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((entry) => (
            <li key={entry.key} className="flex flex-col gap-2">
              <p className="flex flex-wrap items-center gap-2 text-xs">
                {entry.inCharmInventory ? (
                  <ToneBadge label="In the Charm Inventory" tone="success" />
                ) : (
                  <ToneBadge label="Not in the Charm Inventory: it does nothing there" tone="warning" />
                )}
                {link(entry)}
              </p>
              <ItemCard row={entry.row} where={entry.where} className="h-auto flex-1" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The difficulty and act the save is in, the difficulties done and Anya's scrolls (computed sheet facts) */
function WhereCard({ facts }: { readonly facts: SheetFacts }) {
  const scrolls = resistScrollsText(facts.resistScrolls);
  return (
    <section aria-labelledby="character-where" className={cn(CARD_CLASS, 'space-y-2')}>
      <h3 id="character-where" className="font-semibold">
        Where the character is
      </h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Counter label="Difficulty and act" value={facts.act} prefix={`${DIFFICULTY_NAMES[facts.saveDifficulty]}, act `} />
        <Counter label="Difficulties completed" value={facts.completedDifficulties} hint="Eve of Destruction done" />
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Anya&apos;s Scroll of Resistance read</dt>
          <dd className="text-lg font-semibold">{scrolls ?? 'None'}</dd>
          <dd className="text-xs text-muted-foreground">+10 to each resist per scroll</dd>
        </div>
      </dl>
    </section>
  );
}

function TierLine({ label, tier, extra }: { readonly label: string; readonly tier: number | null; readonly extra?: string }) {
  if (tier === null) return null;
  return (
    <p className="text-sm">
      <ToneBadge label={`${label} ${String(tier)}`} tone="info" />
      {extra !== undefined && <span className="ml-2 text-muted-foreground">{extra}</span>}
    </p>
  );
}

/** Progress: kills, respec points, relics, the specialization perks learned, and the Kill Ledger and Ascendancy Stone. */
export function ProgressTab({ character }: { readonly character: CharacterFile }) {
  const gameData = useGameData(FILES);
  const items = useCharacterItems(character);
  // The facts (where, tiers) add to the tab; it shows without them while they load or when they cannot be loaded
  const sheet = useCharacterSheet(character);
  const facts = sheet.status === 'ready' ? sheet.sheet.facts : null;
  if (gameData.status === 'loading' || items.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  if (items.status === 'error') return <GameDataError error={items.error} onRetry={items.retry} />;
  const { specializations } = gameData.data;
  const counters = progressCounters(character);
  const progress = specializationProgress(character, specializations);
  const { ledgers, ascendancyStones } = items.view;
  const { unlearnCost } = specializations.rules;

  return (
    <div className="space-y-4">
      {facts !== null && <WhereCard facts={facts} />}
      <section aria-labelledby="character-counters" className={cn(CARD_CLASS, 'space-y-2')}>
        <h3 id="character-counters" className="font-semibold">
          Counters
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Counter label="Kills" value={counters.kills} hint="The character's kill counter" />
          <Counter
            label="Respec points"
            value={counters.respecPoints}
            hint={unlearnCost === undefined ? undefined : `Unlearning a perk costs ${String(unlearnCost)}`}
          />
          <Counter label="Relics of Knowledge used" value={counters.relics} />
          <Counter label="Unspent specialization points" value={progress.unspentPoints} />
        </dl>
        <p className="text-xs text-muted-foreground">
          Read from the save&apos;s character stats; a stat the save does not hold counts as 0.
        </p>
      </section>

      <section aria-labelledby="character-specializations" className={cn(CARD_CLASS, 'space-y-3')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="character-specializations" className="font-semibold">
            Specializations
          </h3>
          {progress.unlocked ? (
            <ToneBadge
              label={`${String(progress.learnedCount)} ${progress.learnedCount === 1 ? 'perk' : 'perks'} learned`}
              tone="success"
            />
          ) : (
            <ToneBadge label="Not unlocked" tone="neutral" />
          )}
        </div>
        {!progress.unlocked && (
          <p className="text-sm text-muted-foreground">
            Unlocked with a {specializations.rules.token.name} (
            {specializations.rules.token.shards === undefined ? '' : `${String(specializations.rules.token.shards)} `}
            {specializations.rules.shard.name}s in the cube).{' '}
            <Link to={`/${SPECIALIZATIONS_ROUTE}`} className={LINK_CLASS}>
              How specializations work
            </Link>
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {progress.trees.map(({ tree, learned }) => (
            <li key={tree.slug} className="rounded-lg border px-3 py-2">
              <p className="font-medium">
                {tree.name} <span className="font-normal text-muted-foreground tabular-nums">({learned.length})</span>
              </p>
              {learned.length === 0 ? (
                <p className="text-sm text-muted-foreground">None learned</p>
              ) : (
                <ul className="space-y-0.5 text-sm">
                  {learned.map(({ perk, rank }) => (
                    <li key={perk.slug}>
                      <Link to={perkUrl(tree.slug, perk.slug)} className={LINK_CLASS}>
                        {perk.title}
                      </Link>
                      {rank > 1 && <span className="text-muted-foreground tabular-nums"> ×{rank}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlacedItems
          id="character-ledger"
          title="Kill Ledger"
          rows={ledgers}
          summary={
            facts === null ? undefined : (
              <TierLine
                label="Tier"
                tier={facts.killLedgerTier}
                extra={facts.killLedgerBosses.length === 0 ? undefined : `Bosses: ${facts.killLedgerBosses.map(ledgerBossName).join(', ')}`}
              />
            )
          }
          empty={
            <>
              No Kill Ledger on this character.{' '}
              <Link to="/kill-ledger" className={LINK_CLASS}>
                What it does
              </Link>
            </>
          }
          link={() => (
            <Link to="/kill-ledger" className={LINK_CLASS}>
              Every bonus it can take
            </Link>
          )}
        />
        <PlacedItems
          id="character-ascendancy-stone"
          title="Ascendancy Stone"
          rows={ascendancyStones}
          summary={facts === null ? undefined : <TierLine label="Tier" tier={facts.ascendancyTier} />}
          empty={
            <>
              No Ascendancy Stone on this character.{' '}
              <Link to="/ascendancies" className={LINK_CLASS}>
                The ascendancies
              </Link>
            </>
          }
          link={(entry) => (
            <Link
              to={`/ascendancies?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.SEARCH]: entry.row.name.replace(/ Ascendancy Stone$/i, '') }).toString()}`}
              className={LINK_CLASS}
            >
              Its tier bonuses
            </Link>
          )}
        />
      </div>
    </div>
  );
}
