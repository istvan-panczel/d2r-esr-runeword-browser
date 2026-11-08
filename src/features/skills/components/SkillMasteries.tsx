import { Link } from 'react-router-dom';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { MasteryRecipe } from '@/features/game-data/components/MasteryParts';
import { useMasteries } from '@/features/game-data/hooks/useMasteries';
import { anyWeaponPerkText, MASTERY_GUIDE_PATH, masteryBasesUrl, WEAPON_MASTERIES_PATH } from '@/features/game-data/utils/masteries';

const LINK = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

/**
 * About tab: the weapon mastery specialisations that change the skill (masteries.json, loaded with the first card):
 * the class weapon (its Bases page entry), the recipe, the effect and the apply rows' other mods. Nothing while the
 * bundle loads or when no mastery names the skill.
 */
export function SkillMasteries({ skillId, skillName }: { readonly skillId: string; readonly skillName: string }) {
  const index = useMasteries();
  const entries = index?.bySkill.get(skillId) ?? [];
  if (index === null || entries.length === 0) return null;
  const { names } = index.bundle;

  return (
    <section aria-label="Weapon mastery" className="space-y-1.5">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Weapon mastery</h3>
      <ul className="space-y-2">
        {entries.map(({ mastery, effects }) => {
          const firstBase = mastery.bases.at(0);
          return (
            <li key={mastery.property} className="space-y-1 border-l-2 border-muted pl-2">
              <div className="flex items-center gap-1.5">
                {firstBase !== undefined && <ItemIcon item={{ kind: 'base', code: firstBase }} size={28} />}
                <Link to={masteryBasesUrl(mastery)} className={LINK}>
                  {mastery.label}
                </Link>
              </div>
              <MasteryRecipe mastery={mastery} names={names} className="text-muted-foreground" />
              {effects.map((effect) => (
                <div key={effect.heading} className="space-y-0.5">
                  {effect.heading.toLowerCase() !== skillName.toLowerCase() && (
                    <p className="text-xs text-muted-foreground">{effect.heading}</p>
                  )}
                  {effect.text.map((sentence) => (
                    <p key={sentence}>{sentence}</p>
                  ))}
                </div>
              ))}
              {mastery.mods !== undefined && <p className="text-blue-700 dark:text-blue-400">{mastery.mods.join(' · ')}</p>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        One mastery per weapon; the token is lost when you remove it. {anyWeaponPerkText(index.bundle)}{' '}
        <Link to={MASTERY_GUIDE_PATH} className="text-primary underline-offset-2 hover:underline">
          How to get one
        </Link>
        {' · '}
        <Link to={WEAPON_MASTERIES_PATH} className="text-primary underline-offset-2 hover:underline">
          All weapon masteries
        </Link>
      </p>
    </section>
  );
}
