import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import type { BaseItem, ItemTypeInfo, SuperiorAffixes } from '../engine/schema';
import type { EligibleBase } from '../engine/bestBase';
import { minIlvlForSockets } from '../engine/sockets';
import { BASE_TIER_LABELS, TIER_BADGE_CLASS } from '../constants/bases';
import { formatRange } from '../utils/format';
import { collapseRowsBySockets, formatSocketOption } from '../utils/bestBaseResults';
import { SuperiorRollsSection } from './SuperiorRollsSection';

interface EligibleBaseCardProps {
  readonly result: EligibleBase;
  readonly type: ItemTypeInfo | undefined;
  readonly classNames: ReadonlyMap<string, string>;
  readonly upgrade: BaseItem | null;
  /** Superior affix rows and rules (null: no "Superior rolls" panel) */
  readonly superior: SuperiorAffixes | null;
}

function Stat({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Requirement({ label, value, deficit }: { readonly label: string; readonly value: number; readonly deficit: number }) {
  return (
    <span>
      {label} {value}
      {deficit > 0 && <span className="ml-1 font-medium text-red-600 dark:text-red-400">(+{deficit})</span>}
    </span>
  );
}

function basesSearchPath(name: string): string {
  return `/game-data/bases?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.SEARCH]: `"${name}"` }).toString()}`;
}

/** Compact base card for the Best Base results: stats after the ethereal estimate, requirement deficits, sockets. */
export function EligibleBaseCard({ result, type, classNames, upgrade, superior }: EligibleBaseCardProps) {
  const { base, deficits } = result;
  const damage = [
    result.dmg1 && `1H ${formatRange(result.dmg1)}`,
    result.dmg2 && `2H ${formatRange(result.dmg2)}`,
    result.throwDmg && `Throw ${formatRange(result.throwDmg)}`,
  ].filter(Boolean);
  const socketOptions = collapseRowsBySockets(result.rows);
  const thresholds = type?.thresholds;

  return (
    <Card className={`h-full gap-2 py-3 ${result.usable ? '' : 'opacity-75'}`}>
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-base">{base.name}</CardTitle>
          <div className="flex shrink-0 gap-1">
            {result.estimate && (
              <Badge variant="outline" title="Ethereal: ×1.5 damage/defense, −10 Str/Dex (vanilla rules)">
                Eth estimate
              </Badge>
            )}
            <Badge variant="outline" className={TIER_BADGE_CLASS[base.tier]}>
              {BASE_TIER_LABELS[base.tier]}
            </Badge>
          </div>
        </div>
        {base.cls !== null && (
          <div>
            <Badge variant="secondary">{classNames.get(base.cls) ?? base.cls} only</Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-4">
        <dl className="space-y-0.5 text-sm">
          {damage.length > 0 && <Stat label="Damage">{damage.join(' · ')}</Stat>}
          {result.def !== null && <Stat label="Defense">{formatRange(result.def)}</Stat>}
          {base.block !== null && <Stat label="Block">{base.block}%</Stat>}
          {base.kind === 'weapon' && <Stat label="Speed">{base.speed}</Stat>}
          <Stat label="Required">
            <span className="flex flex-wrap gap-x-2">
              <Requirement label="Lvl" value={result.effectiveReqLvl} deficit={deficits.lvl} />
              {result.reqStr > 0 && <Requirement label="Str" value={result.reqStr} deficit={deficits.str} />}
              {result.reqDex > 0 && <Requirement label="Dex" value={result.reqDex} deficit={deficits.dex} />}
            </span>
          </Stat>
          <Stat label="Sockets">
            <ul>
              {socketOptions.map((option) => {
                const minIlvl = thresholds === undefined ? null : minIlvlForSockets(base, option.sockets, thresholds);
                return (
                  <li key={option.sockets}>
                    {formatSocketOption(option)}
                    {minIlvl !== null && minIlvl > 1 && (
                      <span className="text-muted-foreground">
                        {' '}
                        — needs ilvl ≥ {minIlvl} for {option.sockets}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Stat>
          {upgrade !== null && (
            <Stat label="Upgrade">
              <Link to={basesSearchPath(upgrade.name)} className="text-primary underline-offset-2 hover:underline">
                {upgrade.name}
              </Link>
            </Stat>
          )}
        </dl>
        {superior !== null && <SuperiorRollsSection superior={superior} base={base} />}
      </CardContent>
    </Card>
  );
}
