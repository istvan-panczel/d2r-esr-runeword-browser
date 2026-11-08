import { Link } from 'react-router-dom';
import { LINK_CLASS } from '@/features/ascendancies/components/styles';
import type { MercenarySkill } from '@/features/game-data/engine/schema';
import { SkillIcon } from '@/features/skills/components/SkillIcon';
import { skillPageUrl } from '@/features/skills/utils/skills';

/** A skill's icon and name, linked to its card on the Skills page, with an aura / passive badge */
export function MercenarySkillName({ skill }: { readonly skill: MercenarySkill }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <SkillIcon icon={skill.icon} size={20} />
      <Link to={skillPageUrl(skill)} className={LINK_CLASS}>
        {skill.name}
      </Link>
      {skill.type !== undefined && (
        <span className="rounded-sm border px-1 text-[0.65rem] leading-4 text-muted-foreground capitalize">{skill.type}</span>
      )}
    </span>
  );
}
