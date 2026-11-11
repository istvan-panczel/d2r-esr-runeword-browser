import { hitChance } from '@/features/modifiers/utils/modifierMath';
import { HitCurveChart } from './HitCurveChart';
import {
  DIFFICULTY_NAMES,
  neededValues,
  ratio,
  reducedDefense,
  type CombatData,
  type CombatKind,
  type CombatPlayer,
  type CombatRow,
} from './combatRows';
import { withAttackBonus, type CombatDifficulty } from './monsterStats';

const NUMBER = new Intl.NumberFormat();
const format = (value: number | null) => (value === null ? 'out of reach' : NUMBER.format(value));

interface CombatDetailsProps {
  readonly data: CombatData;
  readonly row: CombatRow;
  readonly player: CombatPlayer;
  readonly difficulty: CombatDifficulty;
  readonly kind: CombatKind;
}

/** The selected area or boss: its numbers, its place on the curve and what reaching a chance would take */
export function CombatDetails({ data, row, player, difficulty, kind }: CombatDetailsProps) {
  const { target } = row;
  const kindLabel = target.boss ? 'boss' : `${kind} monsters`;
  const reduction = player.targetDefenseReductionPercent ?? 0;
  const halved = target.boss || kind === 'unique';
  const defense = reducedDefense(target.defense[1], reduction, halved);
  const attackRating = player.attackRating;
  const playerDefense = player.defense;
  const monsterAttack = target.attack?.[1] ?? null;
  const hitRatio = attackRating === undefined ? null : ratio(attackRating, defense);
  const beHitRatio = monsterAttack === null || playerDefense === undefined ? null : ratio(monsterAttack, playerDefense);
  const needed = neededValues(data, target, player, kind);
  const bonus = target.randomBonus;
  const boostedAttack = bonus === null || monsterAttack === null ? null : withAttackBonus(monsterAttack, bonus[1]);
  const boostedChance = boostedAttack === null || playerDefense === undefined ? null : hitChance(boostedAttack, playerDefense, data.facts);

  return (
    <div className="space-y-4">
      <header>
        <h3 className="font-semibold">{row.name}</h3>
        <p className="text-sm text-muted-foreground">
          {DIFFICULTY_NAMES[difficulty]} · {kindLabel} · monster level{' '}
          {target.levelRange === undefined ? target.level : `${String(target.levelRange[0])}–${String(target.levelRange[1])}`}
          {target.boss ? '' : ` · ${String(target.monsters)} monster type${target.monsters === 1 ? '' : 's'}`}
        </p>
      </header>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 text-sm">
        <dt className="text-muted-foreground">Defense{target.boss ? '' : ' (typical)'}</dt>
        <dd className="text-right tabular-nums">
          {NUMBER.format(target.defense[1])}
          {!target.boss && target.defense[0] !== target.defense[2] && (
            <span className="text-muted-foreground">
              {' '}
              ({NUMBER.format(target.defense[0])}–{NUMBER.format(target.defense[2])})
            </span>
          )}
        </dd>
        {reduction > 0 && (
          <>
            <dt className="text-muted-foreground">
              After −{reduction}% target defense{halved ? ' (halved)' : ''}
            </dt>
            <dd className="text-right tabular-nums">{NUMBER.format(defense)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Attack rating{target.boss ? '' : ' (typical)'}</dt>
        <dd className="text-right tabular-nums">
          {target.attack === null ? (
            'spells only'
          ) : (
            <>
              {NUMBER.format(target.attack[1])}
              {!target.boss && target.attack[0] !== target.attack[2] && (
                <span className="text-muted-foreground">
                  {' '}
                  ({NUMBER.format(target.attack[0])}–{NUMBER.format(target.attack[2])})
                </span>
              )}
            </>
          )}
        </dd>
        {target.casters > 0 && !target.boss && target.attack !== null && (
          <>
            <dt className="text-muted-foreground">Spell casters only</dt>
            <dd className="text-right tabular-nums">{target.casters}</dd>
          </>
        )}
      </dl>

      <HitCurveChart
        facts={data.facts}
        targetName={row.name}
        hit={
          player.ignoreTargetDefense === true || hitRatio === null || row.hit === null ? null : { ratio: hitRatio, chance: row.hit.median }
        }
        beHit={beHitRatio === null || row.beHit === null ? null : { ratio: beHitRatio, chance: row.beHit.median }}
      />
      {player.ignoreTargetDefense === true && (
        <p className="text-xs text-muted-foreground">
          Ignore Target&apos;s Defense: your attacks always hit{target.boss ? ' (whether it works on bosses in ESR is unknown)' : ''}.
        </p>
      )}

      <section aria-label="What it takes" className="space-y-2 text-sm">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What it takes</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-1 font-medium">
                Goal
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                {target.boss ? 'Needed' : 'Typical'}
              </th>
              {!target.boss && (
                <th scope="col" className="pb-1 text-right font-medium">
                  Toughest
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {needed.attackRating.map((entry) => (
              <tr key={`ar${String(entry.chance)}`}>
                <th scope="row" className="py-0.5 text-left font-normal">
                  Attack rating for {entry.chance}% to hit
                </th>
                <td className="py-0.5 text-right tabular-nums">{format(entry.typical)}</td>
                {!target.boss && <td className="py-0.5 text-right tabular-nums">{format(entry.toughest)}</td>}
              </tr>
            ))}
            {needed.defense.map((entry) => (
              <tr key={`def${String(entry.chance)}`}>
                <th scope="row" className="py-0.5 text-left font-normal">
                  Defense for {entry.chance}% to be hit
                </th>
                <td className="py-0.5 text-right tabular-nums">{format(entry.typical)}</td>
                {!target.boss && <td className="py-0.5 text-right tabular-nums">{format(entry.toughest)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!target.boss && (
          <p className="text-xs text-muted-foreground">
            Typical: the median monster type of the area; toughest: its highest defense or attack rating.
          </p>
        )}
      </section>

      {bonus !== null && monsterAttack !== null && (
        <p className="text-xs text-muted-foreground">
          About {bonus[0]}% of these monsters spawn with +{bonus[1]}% attack rating (monprop.txt random bonus; that it adds attack rating is
          inferred){boostedChance === null ? '' : `: they hit you ${String(boostedChance)}% of the time`}.
        </p>
      )}
    </div>
  );
}
