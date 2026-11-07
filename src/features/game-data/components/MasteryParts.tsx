import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { encodeSkillRef, SKILL_REF_ATTRIBUTE } from '@/features/skills/utils/skillRefData';
import { skillRefUrl } from '@/features/skills/utils/skillRefs';
import type { MasteryEffect, WeaponMastery } from '../engine/schema';
import { masteryRecipe, namesOneSkill } from '../utils/masteries';
import { IconList } from './CellIcon';

/** A skill name that links to the Skills page and opens the skill peek (the app shell's peek layer) */
function SkillName({ id, name }: { readonly id: string; readonly name: string }) {
  return (
    <Link
      to={skillRefUrl({ id }, null)}
      {...{ [SKILL_REF_ATTRIBUTE]: encodeSkillRef({ id, kind: 'mention', level: [1, 1] }) }}
      aria-haspopup="dialog"
      className="underline decoration-current/50 decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {name}
    </Link>
  );
}

/** "Awakened Weapon Mastery Token + Spider's Silk + Anvil Stone", each with its icon */
export function MasteryRecipe({
  mastery,
  names,
  className,
}: {
  readonly mastery: WeaponMastery;
  readonly names: Readonly<Record<string, string>>;
  readonly className?: string;
}) {
  return <IconList items={masteryRecipe(mastery, names)} className={cn('text-xs', className)} />;
}

/**
 * One effect of a mastery: its skills line (the skill names linked; a group line such as "Curses" with the skills it
 * covers after it) and the effect sentences.
 */
export function MasteryEffectText({
  effect,
  skillNames,
}: {
  readonly effect: MasteryEffect;
  readonly skillNames: Readonly<Record<string, string>>;
}) {
  const single = namesOneSkill(effect, skillNames);
  return (
    <div className="space-y-0.5">
      <p className="font-medium">
        {single ? (
          <SkillName id={effect.skills[0]} name={effect.heading} />
        ) : (
          <>
            {effect.heading}
            {effect.skills.length > 0 && (
              <span className="font-normal text-muted-foreground">
                {' ('}
                {effect.skills.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <SkillName id={id} name={skillNames[id] ?? id} />
                  </span>
                ))}
                {')'}
              </span>
            )}
          </>
        )}
      </p>
      {effect.text.map((sentence) => (
        <p key={sentence}>{sentence}</p>
      ))}
    </div>
  );
}
