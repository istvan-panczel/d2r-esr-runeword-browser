import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { PageShell } from '@/components/PageShell';
import { ToolbarCard } from '@/components/ToolbarCard';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { EnhanceSearch, NoMatches, Pills, type PillOption } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { MasteriesBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import { CLASS_NAMES } from '@/features/skills/utils/skillRefs';
import { HowItWorks } from '../components/HowItWorks';
import { MasteryFamilyCard } from '../components/MasteryFamilyCard';
import {
  classCode,
  filterFamilies,
  groupByClass,
  masteriesParams,
  masteryAnchor,
  masteryFamilies,
  MASTERIES_ROUTE,
  noMasteryGroups,
  otherBaseGroups,
  readMasteriesState,
} from '../utils/masteriesView';

const MASTERY_FILES = ['masteries'] as const;
const ALL = '';

export function WeaponMasteriesScreen() {
  const gameData = useGameData(MASTERY_FILES);
  const version = useManifest()?.esrVersion ?? null;
  return (
    <PageShell
      title="Weapon Masteries"
      meta={
        <>
          What each class weapon&apos;s mastery does{version === null ? '' : ` in ESR ${version}`}, from the game files and the official
          page.
        </>
      }
    >
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <MasteriesBrowser bundle={gameData.data.masteries} />}
    </PageShell>
  );
}

function MasteriesBrowser({ bundle }: { readonly bundle: MasteriesBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const state = readMasteriesState(searchParams, bundle);
  const focused = state.mastery?.slug ?? null;
  const families = masteryFamilies(bundle.masteries);
  const shown = filterFamilies(families, bundle, state.cls, search);
  const groups = groupByClass(shown);
  const chips: PillOption[] = [
    { value: ALL, label: 'All', count: families.length },
    ...groupByClass(families).map((group) => ({ value: group.cls, label: CLASS_NAMES[group.cls], count: group.families.length })),
  ];
  const getShareUrl = () => buildShareUrl(MASTERIES_ROUTE, masteriesParams(state.cls, focused));

  // A linked mastery scrolls into view
  useEffect(() => {
    if (focused === null) return;
    document.getElementById(masteryAnchor(focused))?.scrollIntoView({ block: 'center' });
  }, [focused]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {bundle.masteries.length} masteries across {families.length} weapon families.
      </p>

      <HowItWorks bundle={bundle} />

      <ToolbarCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Pills
            label="Filter by class"
            options={chips}
            value={state.cls ?? ALL}
            onChange={(value) => {
              setSearchParams(masteriesParams(classCode(value)), { replace: true });
            }}
          />
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
        <EnhanceSearch
          id="weapon-mastery-search"
          label="Search masteries"
          value={search}
          onChange={setSearch}
          onClear={() => {
            setSearch('');
          }}
          placeholder="Search weapons or skills..."
          hint="Weapon, base or skill;"
        />
      </ToolbarCard>

      {state.unknown !== null && (
        <p role="status" className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm">
          No class or mastery named &ldquo;{state.unknown}&rdquo;.
        </p>
      )}

      {shown.length === 0 ? (
        <NoMatches />
      ) : (
        groups.map((group) => (
          <section key={group.cls} aria-label={`${CLASS_NAMES[group.cls]} weapons`} className="space-y-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{CLASS_NAMES[group.cls]}</h2>
            <div className="grid gap-3 md:grid-cols-2 @8xl/page:grid-cols-3">
              {group.families.map((family) => (
                <MasteryFamilyCard key={family.key} family={family} bundle={bundle} cls={state.cls} focused={focused} />
              ))}
            </div>
          </section>
        ))
      )}

      <MasteriesNotes bundle={bundle} />
    </div>
  );
}

/** The weapons the official page says all take a mastery but the rows do not, the bases the page does not list, the page diffs */
function MasteriesNotes({ bundle }: { readonly bundle: MasteriesBundle }) {
  const noMastery = noMasteryGroups(bundle);
  const others = otherBaseGroups(bundle);
  const generalDiffs = bundle.pageDiffs.filter((diff) => diff.mastery === undefined);
  return (
    <section aria-labelledby="masteries-notes" className="space-y-2 text-sm">
      <h2 id="masteries-notes" className="font-semibold">
        Notes
      </h2>
      {noMastery.length > 0 && (
        <ul className="space-y-1">
          {noMastery.map((group) => (
            <li key={group.cls}>
              No mastery recipes in the game files for {group.names.length} {CLASS_NAMES[group.cls]} weapons: {group.names.join(', ')}. The
              official page says any class weapon can take one.
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <details className="rounded-md border p-2">
          <summary className="cursor-pointer text-muted-foreground">
            Also accepted: {others.reduce((sum, group) => sum + group.bases.length, 0)} bases the game files do not list as normal drops
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            The cube recipes also take these bases. LoD copies are old versions that share a name with a current base; the mythicals may not
            be obtainable.
          </p>
          <ul className="mt-1 space-y-1">
            {others.map((group) => (
              <li key={group.label}>
                <span className="font-medium">{group.label}: </span>
                {group.bases.map((base) => `${base.name} (${base.family})`).join(', ')}.
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-muted-foreground">
        {bundle.pageDiffs.length === 0
          ? 'The official page agrees with the game files on every recipe and effect.'
          : `Where the official page reads differently (${String(bundle.pageDiffs.length)} ${bundle.pageDiffs.length === 1 ? 'place' : 'places'}), this page follows the game files and notes it on the card.`}
      </p>
      {generalDiffs.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {generalDiffs.map((diff) => (
            <li key={diff.subject}>
              {diff.subject}: the files say &ldquo;{diff.files}&rdquo;, the page &ldquo;{diff.page}&rdquo;.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
