import { Link } from 'react-router-dom';
import type { BaseItem } from '../engine/schema';
import { inputText, MASTERY_GUIDE_PATH, masterySummary, type MasteryIndex } from '../utils/masteries';
import { MasteryEffectText, MasteryRecipe } from './MasteryParts';

interface WeaponMasterySectionProps {
  readonly masteries: MasteryIndex;
  readonly base: BaseItem;
}

/**
 * Collapsed "Weapon mastery" panel of a class weapon's base card: the specialisation(s) an awakened Weapon Mastery Token
 * gives this base (Orb, Claw and Void Blade take one of two), with the recipe, the effects and the removal.
 */
export function WeaponMasterySection({ masteries, base }: WeaponMasterySectionProps) {
  const own = masteries.byBase.get(base.code) ?? [];
  if (own.length === 0) return null;
  const { names, skillNames } = masteries.bundle;
  const [first] = own;
  const remove = first.remove.map((input) => inputText(input, names)).join(' + ');

  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted-foreground" title="Cube an awakened Weapon Mastery Token into this weapon">
        Weapon mastery: {masterySummary(own)}
      </summary>
      <div className="mt-1 space-y-2">
        {own.map((mastery) => (
          <div key={mastery.value} className="space-y-1 border-l-2 border-muted pl-2">
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {own.length > 1 && <span className="font-medium text-foreground">Option {own.indexOf(mastery) + 1}:</span>}
              <span>Weapon +</span>
              <MasteryRecipe mastery={mastery} names={names} />
            </div>
            {mastery.effects.map((effect) => (
              <MasteryEffectText key={effect.heading} effect={effect} skillNames={skillNames} />
            ))}
            {mastery.mods !== undefined && <p className="text-blue-700 dark:text-blue-400">{mastery.mods.join(' · ')}</p>}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          One mastery per weapon, on any tier; the weapon cannot be a runeword when you apply it. Tokens drop from Corrupted Zakarum and map
          bosses; awaken one by cubing it with this weapon.
          {remove !== '' && <> Weapon + {remove} removes the mastery; the token is lost.</>}
          {first.noRemove?.includes(base.code) === true && <> No remove recipe takes this base (an ESR data slip).</>}{' '}
          <Link to={MASTERY_GUIDE_PATH} className="text-primary underline-offset-2 hover:underline">
            Weapon mastery guide
          </Link>
        </p>
      </div>
    </details>
  );
}
