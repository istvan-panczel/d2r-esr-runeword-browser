import { Link } from 'react-router-dom';
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { ToneBadge } from '@/features/stash/components/shared/ToneBadge';
import { tiersText, type SheetAscendancy } from '../engine/sheet/ascendancy';

const LINK_CLASS = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

/** The Ascendancies page, filtered to one ascendancy when a name is given */
function ascendanciesUrl(name: string | null): string {
  return name === null ? '/ascendancies' : `/ascendancies?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.SEARCH]: name }).toString()}`;
}

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What each tier gives, as the game's ascendancy panel words it; locked tiers dimmed */
function TierBonuses({ ascendancy }: { readonly ascendancy: SheetAscendancy }) {
  if (ascendancy.tierLines.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {ascendancy.tierLines.map((lines, i) => {
        const tier = i + 1;
        const unlocked = ascendancy.tiers.includes(tier);
        return (
          <li key={tier} className={unlocked ? undefined : 'text-muted-foreground/70'}>
            <span className="mr-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Tier {tier}
              {!unlocked && ' · locked'}
            </span>
            {lines.map((line) => (
              <span key={line} className="block pl-3">
                {line}
              </span>
            ))}
          </li>
        );
      })}
      {ascendancy.lichKingText !== null && (
        <li className={ascendancy.lichKing ? undefined : 'text-muted-foreground/70'}>
          <span className="mr-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Lich King{!ascendancy.lichKing && ' · not earned'}
          </span>
          <span className="block pl-3">{ascendancy.lichKingText}</span>
        </li>
      )}
    </ul>
  );
}

/**
 * What the save says about the ascendancy panel (ESR 3.3.04+): the ascendancy, its unlocked tiers, the Lich King bonus,
 * the Primordial Soulstones and the orb; an old stone's reading is labelled as such. `undefined`: the sheet data is not
 * there (loading, or it could not be loaded).
 */
export function AscendancySummary({ ascendancy }: { readonly ascendancy: SheetAscendancy | null | undefined }) {
  if (ascendancy === undefined) return <p className="text-sm text-muted-foreground">Reading the ascendancy…</p>;
  if (ascendancy === null)
    return (
      <p className="text-sm text-muted-foreground">
        No ascendancy: an Orb of Creation unlocks the ascendancy panel.{' '}
        <Link to="/ascendancies" className={LINK_CLASS}>
          See the ascendancies
        </Link>
      </p>
    );
  if (ascendancy.name === null)
    return (
      <p className="text-sm text-muted-foreground">
        {ascendancy.index === 0
          ? `${ascendancy.orbConsumed ? 'The Orb of Creation is consumed, but' : 'The orb is not consumed and'} no ascendancy is chosen.`
          : `Ascendancy ${String(ascendancy.index)} is not one this app's game data knows (a save from a newer ESR?).`}
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{ascendancy.name}</span>
        <ToneBadge label={upperFirst(tiersText(ascendancy.tiers))} tone="info" />
        {ascendancy.lichKing && <ToneBadge label="Lich King bonus" tone="success" />}
        <ToneBadge
          label={`Primordial Soulstones ${String(ascendancy.soulstones)}/${String(ascendancy.soulstoneCap)}`}
          tone={ascendancy.soulstones >= ascendancy.soulstoneCap ? 'success' : 'neutral'}
        />
      </p>
      <TierBonuses ascendancy={ascendancy} />
      {ascendancy.source === 'stone' && (
        <p className="text-xs text-muted-foreground">
          Read from the old Ascendancy Stone: since ESR 3.3.04 the game turns it into the ascendancy panel on the next login (same
          ascendancy and tiers) and removes it.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        The game applies the unlocked tiers&apos; bonuses every game (the save holds only the ascendancy and its tiers); the computed stats
        count them.{' '}
        <Link to={ascendanciesUrl(ascendancy.name)} className={LINK_CLASS}>
          Its tier challenges
        </Link>
      </p>
    </div>
  );
}
