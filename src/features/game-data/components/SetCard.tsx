import { CopyLinkButton } from '@/components/CopyLinkButton';
import { Card } from '@/components/ui/card';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { cn } from '@/lib/utils';
import type { SetBonusGroup, SetInfo, SetItemInfo } from '../engine/schema';
import type { SourceIndex } from '../engine/sourceLookup';
import { DocsLink } from './CubeFamilySection';
import { SkillRefText } from '@/features/skills/components/SkillRefText';
import { BonusLines } from './EnhanceParts';
import { ItemIcon } from './ItemIcon';
import { ItemSourceLine } from './ItemSourceLine';
import { TierBadge, TierRangeBadge } from './TierBadge';
import type { BaseTierIndex } from '../hooks/useBaseTiers';
import { reqLevelText, SETS_ROUTE, setDifficulty, setDocsUrl, setFocusParams, setTierRange } from '../utils/sets';

const SET_NAME = 'text-green-700 dark:text-green-400';
const BADGE = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs leading-tight';

function PiecesPill({ pieces, className }: { readonly pieces: number; readonly className?: string }) {
  return <span className={cn(BADGE, 'font-medium', className)}>{pieces} items</span>;
}

/** Per-item bonuses: "2 items" pill, then the lines */
function ItemBonuses({ groups, itemName }: { readonly groups: readonly SetBonusGroup[]; readonly itemName: string }) {
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.pieces} className="space-y-0.5">
          <PiecesPill pieces={group.pieces} className="border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300" />
          <BonusLines lines={group.lines} className="text-green-700 dark:text-green-400" skillItem={{ kind: 'set', name: itemName }} />
        </div>
      ))}
    </div>
  );
}

function SetItemRow({
  item,
  highlighted,
  sources,
  tiers,
}: {
  readonly item: SetItemInfo;
  readonly highlighted: boolean;
  readonly sources: SourceIndex | null;
  readonly tiers: BaseTierIndex | null;
}) {
  const tier = tiers?.get(item.code);
  return (
    <li
      className={cn(
        'grid gap-x-4 gap-y-2 px-3 py-2.5 text-sm sm:grid-cols-2',
        highlighted && 'bg-amber-500/10 shadow-[inset_3px_0_0] shadow-amber-500/70'
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-start gap-2.5">
          <ItemIcon item={{ kind: 'set', name: item.name, code: item.code }} size={36} className="rounded-md bg-muted/50" />
          <div className="min-w-0">
            <p className={cn('font-medium', SET_NAME)}>{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.baseName}
              {tier !== undefined && <TierBadge tier={tier} className="ml-1 px-1.5 py-0 align-middle text-[0.7rem]" />}
              {item.category !== '' && item.category !== item.baseName && ` · ${item.category}`}
              {' · '}Lvl {item.level} · Req Lvl {item.reqLevel}
            </p>
          </div>
        </div>
        <BonusLines lines={item.lines} skillItem={{ kind: 'set', name: item.name }} />
        <ItemSourceLine index={sources} name={item.name} kind="set" />
      </div>
      {item.partial.length > 0 && <ItemBonuses groups={item.partial} itemName={item.name} />}
    </li>
  );
}

/** A set-wide bonus box ("2 items", "Full set") */
function SetBonusBox({ label, lines }: { readonly label: string; readonly lines: readonly string[] }) {
  return (
    <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">{label}</p>
      <ul className="space-y-0.5 text-amber-900 dark:text-amber-200">
        {lines.map((line, index) => (
          // Lines can repeat; the index keeps keys unique
          <li key={`${String(index)}-${line}`}>
            <SkillRefText line={line} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SetCardProps {
  readonly set: SetInfo;
  /** Indexes of the items to highlight */
  readonly highlighted: ReadonlySet<number>;
  readonly sources: SourceIndex | null;
  /** Base tiers (from `useBaseTiers()`); null → no tier badges */
  readonly tiers: BaseTierIndex | null;
}

/** One set: header (class, pieces, tiers, level range, links), its items, then the set-wide partial and full bonuses */
export function SetCard({ set, highlighted, sources, tiers }: SetCardProps) {
  const getShareUrl = () => buildShareUrl(SETS_ROUTE, setFocusParams(set));
  const difficulty = setDifficulty(set);
  const tierRange = tiers === null ? null : setTierRange(set.items, tiers);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5">
        <h3 className={cn('text-base font-semibold', SET_NAME)}>{set.name}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(BADGE, set.className === null ? 'text-muted-foreground' : 'border-primary/40 bg-primary/10')}>
            {set.className ?? 'Any class'}
          </span>
          {difficulty !== null && <span className={cn(BADGE, 'border-sky-500/40 bg-sky-500/10')}>{difficulty}</span>}
          <span className={BADGE}>{set.items.length} pieces</span>
          {tierRange !== null && <TierRangeBadge from={tierRange.from} to={tierRange.to} />}
          <span className={BADGE}>{reqLevelText(set.reqLevel)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <DocsLink href={setDocsUrl(set)} className="text-xs">
            Official page
          </DocsLink>
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <ul className="divide-y">
          {set.items.map((item, index) => (
            <SetItemRow
              key={`${String(index)}-${item.name}`}
              item={item}
              highlighted={highlighted.has(index)}
              sources={sources}
              tiers={tiers}
            />
          ))}
        </ul>
        <div className="space-y-2 border-t p-3 lg:border-t-0 lg:border-l">
          {set.partial.map((group) => (
            <SetBonusBox key={group.pieces} label={`${String(group.pieces)} items`} lines={group.lines} />
          ))}
          <SetBonusBox label="Full set" lines={set.full} />
        </div>
      </div>
    </Card>
  );
}
