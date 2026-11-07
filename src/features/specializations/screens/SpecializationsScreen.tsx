import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { PageShell } from '@/components/PageShell';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { ToolbarCard } from '@/components/ToolbarCard';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { SpecializationsBundle, SpecializationTree } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { PerkCard, PerkIcon } from '../components/PerkCard';
import { UnlockPanel } from '../components/UnlockPanel';
import { perkAnchor, readSpecializationsState, SPECIALIZATIONS_ROUTE, specializationsParams } from '../utils/specializationsView';

const SPECIALIZATION_FILES = ['specializations'] as const;

export function SpecializationsScreen() {
  const gameData = useGameData(SPECIALIZATION_FILES);
  return (
    <PageShell title="Specializations">
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <SpecializationsBrowser bundle={gameData.data.specializations} />}
    </PageShell>
  );
}

/** The tree (`?tree=`) and the focused perk (`?perk=`) live in the URL, so links and the back button keep them. */
function SpecializationsBrowser({ bundle }: { readonly bundle: SpecializationsBundle }) {
  const [searchParams] = useSearchParams();
  const state = readSpecializationsState(searchParams, bundle);
  const focusedSlug = state?.perk?.slug ?? null;

  // A linked perk scrolls into view (after its tree rendered)
  useEffect(() => {
    if (focusedSlug === null) return;
    document.getElementById(perkAnchor(focusedSlug))?.scrollIntoView({ block: 'center' });
  }, [focusedSlug]);

  if (state === null) return <p className="text-sm text-muted-foreground">The game data has no specializations.</p>;
  const { tree } = state;
  const getShareUrl = () => buildShareUrl(SPECIALIZATIONS_ROUTE, specializationsParams(tree.slug, focusedSlug));
  const generalDiffs = bundle.pageDiffs.filter((diff) => diff.tree === undefined);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ESR 3.3 specializations: {bundle.trees.length} trees of {tree.perks.length} perks. Pick one tree and spend up to{' '}
        {bundle.rules.maxPoints} points on its perks, one per row. The texts, numbers and links come from the ESR game files and the
        launcher&apos;s plugin configs.
      </p>

      <UnlockPanel rules={bundle.rules} />

      <ToolbarCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TreeTabs trees={bundle.trees} active={tree.slug} />
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
      </ToolbarCard>

      {state.unknown !== null && (
        <p role="status" className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm">
          No specialization or perk named &ldquo;{state.unknown}&rdquo;. Showing the {tree.name} tree instead.
        </p>
      )}

      <TreeView tree={tree} bundle={bundle} focused={focusedSlug} />

      <section aria-labelledby="specializations-page-diffs" className="space-y-2 text-sm">
        <h2 id="specializations-page-diffs" className="font-semibold">
          Official page and game files
        </h2>
        {bundle.pageDiffs.length === 0 ? (
          <p className="text-muted-foreground">
            The official Specializations page agrees with the game files: every tree, perk title, description and rule.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">Where the official page reads differently, this page follows the game files.</p>
            {generalDiffs.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {generalDiffs.map((diff) => (
                  <li key={diff.subject}>
                    {diff.subject}: the files say &ldquo;{diff.files}&rdquo;, the page &ldquo;{diff.page}&rdquo;.
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <ScrollToTopButton />
    </div>
  );
}

function TreeTabs({ trees, active }: { readonly trees: readonly SpecializationTree[]; readonly active: string }) {
  return (
    <nav aria-label="Specialization trees" className="flex gap-1 overflow-x-auto">
      {trees.map((tree) => (
        <Link
          key={tree.slug}
          to={`?${specializationsParams(tree.slug).toString()}`}
          aria-current={tree.slug === active ? 'page' : undefined}
          className={cn(
            SUBTAB_BASE,
            'inline-flex shrink-0 items-center gap-2 whitespace-nowrap',
            tree.slug === active ? SUBTAB_ACTIVE : SUBTAB_INACTIVE
          )}
        >
          <PerkIcon icon={tree.perks.at(0)?.icon} size={20} />
          {tree.name}
        </Link>
      ))}
    </nav>
  );
}

interface TreeViewProps {
  readonly tree: SpecializationTree;
  readonly bundle: SpecializationsBundle;
  readonly focused: string | null;
}

/** The tree's rows, top to bottom, each with its perks left to right */
function TreeView({ tree, bundle, focused }: TreeViewProps) {
  const rows = [...new Set(tree.perks.map((perk) => perk.row))].sort((a, b) => a - b);
  return (
    <section aria-label={`${tree.name} perks`} className="space-y-4">
      {tree.summary !== undefined && (
        <p className="text-sm">
          <span className="font-semibold">{tree.name}</span>: {tree.summary}
        </p>
      )}
      {rows.map((row) => (
        <section key={row} aria-label={`Row ${String(row)}`} className="space-y-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Row {row} · learn one</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {tree.perks
              .filter((perk) => perk.row === row)
              .map((perk) => (
                <PerkCard
                  key={perk.slug}
                  tree={tree}
                  perk={perk}
                  focused={perk.slug === focused}
                  diffs={bundle.pageDiffs.filter((diff) => diff.tree === tree.slug && diff.perk === perk.slug)}
                />
              ))}
          </div>
        </section>
      ))}
    </section>
  );
}
