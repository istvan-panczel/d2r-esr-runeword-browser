import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BaseAutomod, BaseItem, ItemTypeInfo, SuperiorAffixes } from '../engine/schema';
import { BASE_TIER_LABELS, TIER_BADGE_CLASS } from '../constants/bases';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { baseAutomodView, baseDamageLabel, type BaseAutomodView } from '../utils/baseAutomods';
import { formatAffixLevel } from '../utils/filterAffixes';
import { formatArmorRunWalk, formatRange, formatSocketCaps } from '../utils/format';
import type { MasteryIndex } from '../utils/masteries';
import { ItemIcon } from './ItemIcon';
import { SuperiorRollsSection } from './SuperiorRollsSection';
import { WeaponMasterySection } from './WeaponMasterySection';

const DEFAULT_THRESHOLDS: ItemTypeInfo['thresholds'] = [25, 40];

interface BaseCardProps {
  readonly base: BaseItem;
  readonly typeByCode: ReadonlyMap<string, ItemTypeInfo>;
  readonly baseByCode: ReadonlyMap<string, BaseItem>;
  /** BasesBundle.automods by id */
  readonly automodById: ReadonlyMap<number, BaseAutomod>;
  readonly classNames: ReadonlyMap<string, string>;
  /** Superior affix rows and rules (null: no "Superior rolls" panel) */
  readonly superior: SuperiorAffixes | null;
  /** Weapon mastery specialisations (null: no "Weapon mastery" panel) */
  readonly masteries: MasteryIndex | null;
  /** Sets the page search (family links) */
  readonly onSearch: (text: string) => void;
}

function Stat({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const FAMILY_LABELS = ['N', 'X', 'E'] as const;

/** Longer automod pools start collapsed so the card grid stays readable */
const AUTOMOD_COLLAPSE_AFTER = 5;

function AutomodMeta({ automod }: { readonly automod: BaseAutomod }) {
  const meta = [automod.name, formatAffixLevel(automod), `req lvl ${String(automod.reqLvl)}`].filter(Boolean).join(' · ');
  return <span className="text-xs text-muted-foreground">{meta}</span>;
}

function AutomodSection({ view, group }: { readonly view: BaseAutomodView; readonly group: number | null }) {
  const { shared, options } = view;
  const groupTitle = group === null ? undefined : `automagic.txt group ${String(group)}`;
  if (options.length === 1) {
    const [single] = options;
    return (
      <div className="mt-2 text-sm">
        <p className="text-muted-foreground" title={groupTitle}>
          Automod <AutomodMeta automod={single.automod} />
        </p>
        <ul className="text-blue-700 dark:text-blue-400">
          {single.lines.map((line, index) => (
            <li key={`${String(index)}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }

  const list = (
    <ul className="space-y-1">
      {options.map(({ automod, lines }) => (
        <li key={automod.id} className="border-l-2 border-muted pl-2">
          <span className="text-blue-700 dark:text-blue-400">{lines.length > 0 ? lines.join(' · ') : '(shared lines only)'}</span>{' '}
          <AutomodMeta automod={automod} />
        </li>
      ))}
    </ul>
  );
  const heading = `Automod: one of ${String(options.length)}, picked by item level`;
  return (
    <div className="mt-2 space-y-1 text-sm">
      {options.length > AUTOMOD_COLLAPSE_AFTER ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground" title={groupTitle}>
            {heading}
          </summary>
          <div className="mt-1">{list}</div>
        </details>
      ) : (
        <>
          <p className="text-muted-foreground" title={groupTitle}>
            {heading}
          </p>
          {list}
        </>
      )}
      {shared.length > 0 && (
        <p>
          <span className="text-muted-foreground">Every option also: </span>
          <span className="text-blue-700 dark:text-blue-400">{shared.join(' · ')}</span>
        </p>
      )}
    </div>
  );
}

export function BaseCard({ base, typeByCode, baseByCode, automodById, classNames, superior, masteries, onSearch }: BaseCardProps) {
  const type = typeByCode.get(base.type);
  const type2 = base.type2 === null ? undefined : typeByCode.get(base.type2);
  const thresholds = type?.thresholds ?? DEFAULT_THRESHOLDS;

  const damage = [
    base.dmg1 && `${baseDamageLabel(base)} ${formatRange(base.dmg1)}`,
    base.dmg2 && `2H ${formatRange(base.dmg2)}`,
    base.throwDmg && `Throw ${formatRange(base.throwDmg)}`,
  ].filter(Boolean);

  const requirements = [
    base.reqLvl > 0 && `Lvl ${String(base.reqLvl)}`,
    base.reqStr > 0 && `Str ${String(base.reqStr)}`,
    base.reqDex > 0 && `Dex ${String(base.reqDex)}`,
  ].filter(Boolean);

  const bonuses = [base.strBonus > 0 && `Str ${String(base.strBonus)}`, base.dexBonus > 0 && `Dex ${String(base.dexBonus)}`].filter(
    Boolean
  );

  const automods = baseAutomodView(base, automodById);
  const className = (code: string) => classNames.get(code) ?? code;

  // Self-referential families (accessories, mythicals) and blank members have nothing to link to
  const hasFamily = base.family.some((code) => code !== '' && code !== base.code);

  return (
    <Card className="h-full gap-3 py-4">
      <CardHeader className="flex items-start gap-3 px-4">
        <ItemIcon item={{ kind: 'base', code: base.code }} size={48} className="rounded-md bg-muted/50" />
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="min-w-0 text-lg">{base.name}</CardTitle>
            <Badge variant="outline" className={TIER_BADGE_CLASS[base.tier]}>
              {BASE_TIER_LABELS[base.tier]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>
              {type?.name ?? base.type}
              {type2 && ` / ${type2.name}`}
            </span>
            <span className="font-mono text-xs">({base.code})</span>
            {base.cls !== null && <Badge variant="secondary">{className(base.cls)} only</Badge>}
            {base.autoGroup !== null && automods === null && (
              <Badge variant="outline" title="Automagic affix group without visible stats on this base">
                Automod {base.autoGroup}
              </Badge>
            )}
            {base.indestructible && <Badge variant="outline">Indestructible</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4">
        <dl className="space-y-0.5 text-sm">
          {damage.length > 0 && <Stat label="Damage">{damage.join(' · ')}</Stat>}
          {base.def !== null && <Stat label="Defense">{formatRange(base.def)}</Stat>}
          {base.block !== null && <Stat label="Block">{base.block}%</Stat>}
          {base.kind === 'weapon' && <Stat label="Speed">{base.speed}</Stat>}
          {base.kind === 'armor' && base.speed !== 0 && <Stat label="Run/Walk">{formatArmorRunWalk(base.speed)}</Stat>}
          {base.range !== undefined && (
            <Stat label="Range">
              <span title="weapons.txt rangeadder">+{base.range}</span>
            </Stat>
          )}
          {!base.indestructible && base.durability > 0 && <Stat label="Durability">{base.durability}</Stat>}
          <Stat label="Required">{requirements.length > 0 ? requirements.join(' · ') : 'None'}</Stat>
          {bonuses.length > 0 && <Stat label="Dmg bonus">{bonuses.join(' · ')}</Stat>}
          <Stat label="Sockets">{formatSocketCaps(base.socketCaps, thresholds)}</Stat>
          <Stat label="Quality lvl">{base.qlvl}</Stat>
          {base.staffMods !== undefined && (
            <Stat label="Staffmods">
              <span title="itemtypes.txt StaffMods: the game can add bonuses to random skills of this class">
                + to random {className(base.staffMods)} skills
              </span>
            </Stat>
          )}
          {hasFamily && (
            <Stat label="Family">
              <span className="flex flex-wrap gap-x-2">
                {base.family.map((code, index) => {
                  if (code === '') return null;
                  const member = baseByCode.get(code);
                  const label = FAMILY_LABELS[index];
                  if (code === base.code) {
                    return (
                      <span key={label} className="font-medium">
                        {label}: {base.name}
                      </span>
                    );
                  }
                  if (member === undefined) {
                    return (
                      <span key={label} className="text-muted-foreground" title="Not a spawnable base">
                        {label}: {code}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={label}
                      type="button"
                      className="text-left text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        onSearch(`"${member.name}"`);
                      }}
                    >
                      {label}: {member.name}
                    </button>
                  );
                })}
              </span>
            </Stat>
          )}
        </dl>
        {automods !== null && <AutomodSection view={automods} group={base.autoGroup} />}
        {superior !== null && <SuperiorRollsSection superior={superior} base={base} />}
        {masteries !== null && <WeaponMasterySection masteries={masteries} base={base} />}
        <Link
          to={`/affixes?${new URLSearchParams({ [GAME_DATA_URL_PARAM_KEYS.BASE]: base.code }).toString()}`}
          className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
        >
          What can roll
        </Link>
      </CardContent>
    </Card>
  );
}
