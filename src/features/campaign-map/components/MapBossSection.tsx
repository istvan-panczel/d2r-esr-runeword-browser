import { Link } from 'react-router-dom';
import { BookOpen, KeyRound, ShieldAlert, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignNote } from '../engine/types';
import type { BossCard, BossRewardLine, ZoneBossSummary } from '../utils/mapBossFacts';
import { AreaLink } from './AreaLink';
import { FactSourceLabel } from './FactSourceLabel';
import { WARNING_BOX_CLASS } from './mapStyles';

/** The guide note about the endgame map bosses */
export const MAP_BOSSES_GUIDE_PATH = '/guide/endgame-bosses';

const LINK_CLASS = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';
const SUBHEAD_CLASS = 'text-xs font-semibold text-muted-foreground';
const OFFICIAL_CLASS = 'text-xs text-amber-800 dark:text-amber-300';

interface MapBossSectionProps {
  readonly summary: ZoneBossSummary;
  /** Area name by id (arena links) */
  readonly nameOf: (id: number) => string;
  readonly areaHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
  /** The selected area (its own arena is not linked) */
  readonly areaId: number;
}

/**
 * The "Boss" part of an endgame map zone's panel: how the zone opens, then a card per boss (fight, how to hurt it,
 * rewards from the game files with the official page's figures where they differ, terrorized shards, players 8). A
 * zone without a boss says so. Cards of bosses fighting elsewhere in the zone start closed.
 */
export function MapBossSection({ summary, nameOf, areaHref, onSelect, areaId }: MapBossSectionProps) {
  const single = summary.bosses.length === 1;
  return (
    <div className="space-y-3">
      {summary.mapItemName !== null && (
        <p className="flex gap-1.5">
          <KeyRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Opened by the <span className="font-medium">{summary.mapItemName}</span> map: cube it by itself in Act V, Hell.
            <FactSourceLabel source="endgame" />
          </span>
        </p>
      )}
      {summary.noBoss !== null && (
        <p>
          No boss in this map: the loot comes from its monsters
          {summary.noBoss.uniques === null ? '' : ` (${packText(summary.noBoss.uniques)} unique packs in Hell)`}.
          <FactSourceLabel source="tables" />
        </p>
      )}
      {summary.pick !== null && (
        <p>
          Two of these tier 1 bosses come, each with its own tier 1 rewards; the game files do not say which pair (the map’s layout
          decides).
          <FactSourceLabel source="tables" />
        </p>
      )}
      {summary.bosses.map((boss) => (
        <BossDetails
          key={boss.id}
          boss={boss}
          open={single || (boss.here && summary.pick === null)}
          areaId={areaId}
          nameOf={nameOf}
          areaHref={areaHref}
          onSelect={onSelect}
        />
      ))}
      <p>
        <Link to={MAP_BOSSES_GUIDE_PATH} className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <BookOpen className="size-3.5" aria-hidden />
          Guide: endgame map bosses
        </Link>
      </p>
    </div>
  );
}

function packText([min, max]: readonly [number, number]): string {
  return min === max ? String(min) : `${String(min)}–${String(max)}`;
}

interface BossDetailsProps {
  readonly boss: BossCard;
  readonly open: boolean;
  readonly areaId: number;
  readonly nameOf: (id: number) => string;
  readonly areaHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
}

function BossDetails({ boss, open, areaId, nameOf, areaHref, onSelect }: BossDetailsProps) {
  const arena = boss.arenaIds.at(0);
  return (
    <details open={open} className="group rounded-md border bg-background/50">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 font-medium [&::-webkit-details-marker]:hidden">
        <Skull className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">{boss.name}</span>
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">show</span>
      </summary>
      <div className="space-y-2.5 border-t px-2.5 pt-2 pb-2.5">
        {arena !== undefined && arena !== areaId && !boss.arenaIds.includes(areaId) && (
          <p className="text-xs text-muted-foreground">
            Fights in{' '}
            <AreaLink id={arena} href={areaHref(arena)} onSelect={onSelect} className={LINK_CLASS}>
              {nameOf(arena)}
            </AreaLink>
          </p>
        )}
        {boss.uncurated && <p className="text-xs text-muted-foreground">New boss: no notes on the fight yet.</p>}
        {boss.fight.length > 0 && (
          <p>
            <span className={SUBHEAD_CLASS}>Fight: </span>
            {boss.fight.map((note, index) => (
              <span key={note.text}>
                {index > 0 && '; '}
                {note.text}
                <FactSourceLabel source={note.source} verify={note.verify} />
              </span>
            ))}
          </p>
        )}
        {boss.damage !== null && (
          <div className={cn('flex gap-2 rounded-md border px-2 py-1.5', WARNING_BOX_CLASS)}>
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="min-w-0">
              {boss.damage.text}
              <FactSourceLabel source={boss.damage.source} verify={boss.damage.verify} />
            </p>
          </div>
        )}
        <div>
          <p className={SUBHEAD_CLASS}>
            Rewards in Hell, players 1 (players 8)
            <FactSourceLabel source="tables" />
          </p>
          <ul className="mt-1 space-y-1">
            {boss.rewards.map((reward) => (
              <RewardRow key={reward.key} reward={reward} />
            ))}
            {boss.otherRolls > 0 && (
              <li className="text-muted-foreground">
                and {boss.otherRolls} rolls of gold, gear, jewellery, runes, gems and crafting materials
              </li>
            )}
          </ul>
        </div>
        {boss.sameTableAs.length > 0 && (
          <p>
            Uses the same loot table as {boss.sameTableAs.join(' and ')}, the boss of another map.
            <FactSourceLabel source="tables" />
          </p>
        )}
        {boss.setDrop !== null && (
          <p>
            Kill it, {boss.setDrop.with.join(' and ')} in one game: the last of them to die drops{' '}
            <span className="font-medium">{boss.setDrop.unique}</span> (launcher plugin rule).
            <FactSourceLabel source="tables" />
          </p>
        )}
        <p>
          <span className={SUBHEAD_CLASS}>Terrorized: </span>
          {boss.terror}.
          <FactSourceLabel source="tables" />
          {boss.terrorOfficial !== null && <span className={cn('ml-1', OFFICIAL_CLASS)}>Official page: {boss.terrorOfficial}.</span>}
        </p>
        {boss.uber.length > 0 && (
          <div>
            <p className={SUBHEAD_CLASS}>Players 8 (uber)</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {boss.uber.map((note: CampaignNote) => (
                <li key={note.text}>
                  {note.text}
                  <FactSourceLabel source={note.source} verify={note.verify} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function RewardRow({ reward }: { readonly reward: BossRewardLine }) {
  return (
    <li>
      <span className="font-medium">{reward.label}</span>: {reward.chance}
      {reward.players8 !== null && <span className="text-muted-foreground"> ({reward.players8})</span>}
      {reward.note !== null && <span className="text-muted-foreground">, {reward.note}</span>}
      {reward.official !== null && <span className={cn('block', OFFICIAL_CLASS)}>Official page: {reward.official}</span>}
    </li>
  );
}
