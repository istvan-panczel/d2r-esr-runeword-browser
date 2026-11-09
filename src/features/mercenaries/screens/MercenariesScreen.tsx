import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ExternalLink } from '@/components/ExternalLink';
import { PageShell } from '@/components/PageShell';
import { ToolbarCard } from '@/components/ToolbarCard';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { ESR_SKILL_INFO_URL } from '@/core/navigation/navConfig';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { LINK_CLASS } from '@/features/ascendancies/components/styles';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { MERCENARY_DIFFICULTIES, type MercenaryDifficulty } from '@/features/game-data/engine/mercenaryLinks';
import type { MercenariesBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { MercenaryCard } from '../components/MercenaryCard';
import { MercenaryTable } from '../components/MercenaryTable';
import {
  DEFAULT_CARD_DIFFICULTY,
  MERCENARIES_GUIDE_PATH,
  MERCENARIES_ROUTE,
  MERCENARY_DIFFICULTY_LABELS,
  mercenariesParams,
  mercenariesQuery,
  mercenaryCards,
  mercenaryTableRows,
  readMercenariesState,
  type MercenariesQuery,
} from '../utils/mercenariesView';

const MERCENARY_FILES = ['mercenaries'] as const;

export function MercenariesScreen() {
  const gameData = useGameData(MERCENARY_FILES);
  return (
    <PageShell title="Mercenaries">
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <MercenariesBrowser bundle={gameData.data.mercenaries} />}
    </PageShell>
  );
}

interface TabProps {
  readonly query: MercenariesQuery;
  readonly active: boolean;
  readonly children: ReactNode;
}

function Tab({ query, active, children }: TabProps) {
  return (
    <Link
      to={`?${mercenariesParams(query).toString()}`}
      aria-current={active ? 'page' : undefined}
      className={cn(SUBTAB_BASE, 'shrink-0 whitespace-nowrap', active ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
    >
      {children}
    </Link>
  );
}

function TabRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto">
      {children}
    </nav>
  );
}

/** Hireling, type, difficulty and view all live in the URL, so links and the back button keep them. */
function MercenariesBrowser({ bundle }: { readonly bundle: MercenariesBundle }) {
  const [searchParams] = useSearchParams();
  const state = readMercenariesState(searchParams, bundle);
  const query = mercenariesQuery(state);
  const getShareUrl = () => buildShareUrl(MERCENARIES_ROUTE, mercenariesParams(query));
  const isTable = state.view === 'table';
  const activeDifficulty: MercenaryDifficulty | null = isTable ? state.difficulty : (state.difficulty ?? DEFAULT_CARD_DIFFICULTY);

  if (bundle.hirelings.length === 0) return <p className="text-sm text-muted-foreground">The game data has no mercenaries.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ESR&apos;s hirelings: where to hire them, their skills and their stats at the levels the game file lists. The difficulty you hire in
        changes the gold and, for the Desert Mercenary, the skills.
      </p>

      <ToolbarCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabRow label="View">
            <Tab query={{ ...query, view: 'cards' }} active={!isTable}>
              Cards
            </Tab>
            <Tab query={{ ...query, view: 'table' }} active={isTable}>
              Table
            </Tab>
          </TabRow>
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
        <TabRow label="Difficulty">
          {isTable && (
            <Tab query={{ ...query, difficulty: null }} active={activeDifficulty === null}>
              All
            </Tab>
          )}
          {MERCENARY_DIFFICULTIES.map((difficulty) => (
            <Tab key={difficulty} query={{ ...query, difficulty }} active={activeDifficulty === difficulty}>
              {MERCENARY_DIFFICULTY_LABELS[difficulty]}
            </Tab>
          ))}
        </TabRow>
        <TabRow label="Hireling">
          <Tab query={{ ...query, hireling: null, type: null }} active={state.hireling === null}>
            All hirelings
          </Tab>
          {bundle.hirelings.map((hireling) => (
            <Tab
              key={hireling.slug}
              query={{ ...query, hireling: hireling.slug, type: null }}
              active={state.hireling?.slug === hireling.slug}
            >
              {hireling.name}
            </Tab>
          ))}
        </TabRow>
        {state.hireling !== null && state.hireling.types.length > 1 && (
          <TabRow label="Type">
            <Tab query={{ ...query, type: null }} active={state.type === null}>
              All types
            </Tab>
            {state.hireling.types.map((type) => (
              <Tab key={type.slug} query={{ ...query, type: type.slug }} active={state.type?.slug === type.slug}>
                {type.name}
              </Tab>
            ))}
          </TabRow>
        )}
      </ToolbarCard>

      {state.unknown !== null && (
        <p role="status" className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm">
          Nothing named &ldquo;{state.unknown}&rdquo; here, so that part of the link is ignored.
        </p>
      )}

      {isTable ? (
        <MercenaryTable rows={mercenaryTableRows(bundle, state)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mercenaryCards(bundle, state).map((entry) => (
            <MercenaryCard key={`${entry.hireling.slug}/${entry.type.slug}`} entry={entry} />
          ))}
        </div>
      )}

      <section aria-labelledby="mercenaries-notes" className="space-y-2 text-sm">
        <h2 id="mercenaries-notes" className="font-semibold">
          About this data
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Stats and skill levels come from hireling.txt, which lists them only at these levels. Nothing in between is shown.</li>
          <li>Gold is the value in the file; the price in the game may differ.</li>
          <li>Conduit and Whirlpool link to the class skills of that name. The hirelings use their own copies of them.</li>
          <li>
            Which hireling has which skills comes from the{' '}
            <ExternalLink href={`${ESR_SKILL_INFO_URL}#mercenaries`} className={LINK_CLASS} iconClassName="size-3">
              official Mercenary and Oskill page
            </ExternalLink>
            . See also the{' '}
            <Link to={MERCENARIES_GUIDE_PATH} className={LINK_CLASS}>
              guide note
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
