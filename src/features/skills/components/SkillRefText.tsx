import { Link } from 'react-router-dom';
import { useModifierRefIndex } from '@/features/modifiers/hooks/useModifierRefIndex';
import { encodeModifierRef, MODIFIER_REF_ATTRIBUTE } from '@/features/modifiers/utils/modifierRefData';
import { findModifierRef, modifierRefUrl } from '@/features/modifiers/utils/modifierRefs';
import { useSkillRefIndex } from '../hooks/useSkillRefIndex';
import { findSkillRefs, skillRefLevel, skillRefUrl, type SkillRefItem } from '../utils/skillRefs';
import { encodeSkillRef, SKILL_REF_ATTRIBUTE } from '../utils/skillRefData';

interface SkillRefTextProps {
  /** One item property line */
  readonly line: string;
  /** The line's item (picks between same-name skills by what the item grants); omit when unknown */
  readonly item?: SkillRefItem;
}

/**
 * An item property line whose skill name ("+3 to Fire Ball", "Level 15 Fanaticism Aura When Equipped", …) links to the
 * Skills page and opens the skill peek, or, when the whole line is a modifier ("+20% Deadly Strike", "Fire Resist +30%"),
 * links to the Modifiers page and opens the modifier peek (`SkillPeekLayer`, one popover for the whole page, found
 * through `data-skill-ref` / `data-mod-ref`). A skill name wins; the two never nest. Plain text until the skill names /
 * modifier templates are loaded, and for every other line. The links are not tab stops (`tabIndex -1`): keyboard users
 * keep the item flow; see docs/features/SKILLS.md and MODIFIERS.md.
 */
export function SkillRefText({ line, item }: SkillRefTextProps) {
  const index = useSkillRefIndex();
  const modifiers = useModifierRefIndex();
  const segments = index === null ? null : findSkillRefs(line, index, item);
  if (index === null || segments === null) {
    const modifier = modifiers === null ? null : findModifierRef(line, modifiers);
    if (modifier === null) return line;
    return (
      <Link
        to={modifierRefUrl(modifier.key)}
        {...{ [MODIFIER_REF_ATTRIBUTE]: encodeModifierRef(modifier) }}
        // Not a tab stop (most lines of an item page are modifiers); still a link for pointers and screen readers
        tabIndex={-1}
        aria-haspopup="dialog"
        // Fainter than a skill name's underline: most lines get one
        className="underline decoration-current/25 decoration-dotted underline-offset-[3px] hover:decoration-current/70"
      >
        {line}
      </Link>
    );
  }
  return segments.map((segment, i) => {
    const key = `${String(i)}:${segment.text}`;
    const skill = segment.ref === undefined ? undefined : index.byId.get(segment.ref.id);
    if (segment.ref === undefined || skill === undefined) return <span key={key}>{segment.text}</span>;
    const { urlLevel } = skillRefLevel(segment.ref, skill);
    return (
      <Link
        key={key}
        to={skillRefUrl(skill, urlLevel)}
        {...{ [SKILL_REF_ATTRIBUTE]: encodeSkillRef(segment.ref) }}
        // Not a tab stop (a uniques page has ~1,500 of these); still a link for pointers and screen readers' link lists
        tabIndex={-1}
        aria-haspopup="dialog"
        className="underline decoration-current/50 decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        {segment.text}
      </Link>
    );
  });
}
