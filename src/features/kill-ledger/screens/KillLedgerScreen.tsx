import { Link } from 'react-router-dom';
import { ExternalLink } from '@/components/ExternalLink';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { AMBER_HEADING_CLASS, EXTERNAL_ICON_CLASS, LINK_CLASS } from '@/features/ascendancies/components/styles';
import { CellIcon } from '@/features/game-data/components/CellIcon';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { KillLedgerBundle, KillLedgerItem } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { cubeFamilyHref } from '@/features/game-data/utils/materials';
import { officialDocsUrl } from '@/features/guide/engine/linkSchemes';
import { BossBonusesTable } from '../components/BossBonusesTable';
import { KillBonusesTable } from '../components/KillBonusesTable';
import { ingredientIcon, ingredientText, KILL_LEDGER_CUBE_FAMILY, KILL_LEDGER_GUIDE_PATH } from '../utils/killLedgerView';

const KILL_LEDGER_FILES = ['killledger'] as const;

export function KillLedgerScreen() {
  const gameData = useGameData(KILL_LEDGER_FILES);
  return (
    <PageShell title="Kill Ledger">
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <KillLedger bundle={gameData.data.killledger} />}
    </PageShell>
  );
}

function KillLedger({ bundle }: { readonly bundle: KillLedgerBundle }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        The Kill Ledger is a book that counts your kills. Transmute it at kill milestones and after endgame map bosses for permanent
        bonuses. Every number comes from the ESR game files.
      </p>

      <HowItWorks item={bundle.item} windowSeconds={bundle.windowSeconds} />

      <section aria-labelledby="kill-ledger-kill-bonuses">
        <SectionHeader id="kill-ledger-kill-bonuses" title="Kill bonuses" count={bundle.tiers.length} />
        <KillBonusesTable tiers={bundle.tiers} />
      </section>

      <section aria-labelledby="kill-ledger-boss-bonuses">
        <SectionHeader id="kill-ledger-boss-bonuses" title="Boss bonuses" count={bundle.bosses.length} />
        <p className="mb-3 text-sm text-muted-foreground">
          Kill the boss, then transmute within {bundle.windowSeconds} seconds. Each boss asks for its own items.
        </p>
        <BossBonusesTable bosses={bundle.bosses} />
      </section>

      {bundle.pageDiffs.length > 0 && (
        <section aria-labelledby="kill-ledger-page-diffs" className="space-y-2 text-sm">
          <h2 id="kill-ledger-page-diffs" className="font-semibold">
            Official page differs
          </h2>
          <p className="text-muted-foreground">Where the official page reads differently, this page follows the game files.</p>
          <ul className="list-disc space-y-1 pl-5">
            {bundle.pageDiffs.map((diff) => (
              <li key={diff.subject}>
                {diff.subject}: the files say &ldquo;{diff.files}&rdquo;, the page &ldquo;{diff.page}&rdquo;.
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HowItWorks({ item, windowSeconds }: { readonly item: KillLedgerItem; readonly windowSeconds: number }) {
  const { pack, remake } = item.source;
  return (
    <section aria-labelledby="kill-ledger-how" className="space-y-5 rounded-xl border bg-card p-4 text-sm shadow-sm sm:p-6">
      <h2 id="kill-ledger-how" className="sr-only">
        How the Kill Ledger works
      </h2>
      <div className="grid gap-6 @5xl/page:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <h3 className={AMBER_HEADING_CLASS}>Get it</h3>
          <p className="flex items-center gap-1.5">
            <CellIcon item={ingredientIcon(item)} />
            <span>
              Every new character starts with a <strong>{pack.name}</strong>. Transmute it alone in the Horadric Cube for the{' '}
              <strong>{item.name}</strong>.
            </span>
          </p>
          {remake.length > 0 && (
            <p>
              {remake.map(ingredientText).join(' + ')} transmute into another {pack.name}.
            </p>
          )}
        </section>

        <section className="min-w-0 space-y-3">
          <h3 className={AMBER_HEADING_CLASS}>How bonuses unlock</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Keep the ledger in your charm inventory at all times: skills need it for their random effects.</li>
            <li>Kill bonuses go in order, and each one needs its kill count. Trying one without the bonuses before it won&apos;t work.</li>
            <li>Boss bonuses can be done in any order, within {windowSeconds} seconds of the kill.</li>
            <li>Each bonus can be taken once.</li>
            <li>The ledger cannot be moved to another character.</li>
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <h3 className={AMBER_HEADING_CLASS}>What the book does</h3>
        <ul className="list-disc space-y-1 pl-5">
          {item.tooltip.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to={cubeFamilyHref(KILL_LEDGER_CUBE_FAMILY)} className={LINK_CLASS}>
          Cube recipes
        </Link>
        <Link to={KILL_LEDGER_GUIDE_PATH} className={LINK_CLASS}>
          Guide: Kill Ledger
        </Link>
        <ExternalLink href={officialDocsUrl('kill_ledger.htm')} className={LINK_CLASS} iconClassName={EXTERNAL_ICON_CLASS}>
          Official Kill Ledger page
        </ExternalLink>
      </p>
    </section>
  );
}
