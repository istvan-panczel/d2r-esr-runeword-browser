import { Link } from 'react-router-dom';
import { defaultContext, evaluateSkill, skillTable, type SkillCalcIndex } from '@/features/game-data/engine/skillCalc';
import type { SkillCalcSkill } from '@/features/game-data/engine/schema';
import { useSkillCalc } from '../hooks/useSkillCalc';
import { useSkillRefIndex } from '../hooks/useSkillRefIndex';
import { headlineKeys, headlineTexts, QUICK_LEVELS } from '../utils/skillLevels';
import { disambiguation } from '../utils/skills';
import { CLASS_NAMES, skillRefLevel, skillRefText, skillRefUrl, type SkillRef } from '../utils/skillRefs';
import { SkillIcon } from './SkillIcon';

/** The first one or two per-level lines that vary (mana left out) at a level, as the Skills page's "Granted by" shows them */
function headlineValues(record: SkillCalcSkill, index: SkillCalcIndex, level: number, hardPoints: number | undefined): string[] {
  const options = hardPoints === undefined ? {} : { hardPoints };
  const keys = headlineKeys(skillTable(record, index, QUICK_LEVELS, options));
  if (keys.length === 0) return [];
  return headlineTexts(evaluateSkill(record, index, defaultContext(record, { ...options, level })), keys);
}

/**
 * The skill peek of an item line: icon, name, class, what the line gives, the headline values at its level (the
 * calculator; skillcalc.json loads with the first peek) and a link to the Skills page at that level (`newTab`: in a new
 * tab, for names inside a form whose edits would be lost).
 */
export function SkillPeekCard({ skillRef, newTab = false }: { readonly skillRef: SkillRef; readonly newTab?: boolean }) {
  const index = useSkillRefIndex();
  const calc = useSkillCalc();
  const skill = index?.byId.get(skillRef.id);
  if (index === null || skill === undefined) return <p className="text-muted-foreground">Loading the skill…</p>;

  const suffix = disambiguation(skill, index.duplicates);
  const at = skillRefLevel(skillRef, skill);
  const record = calc.index?.record(skill.id);
  // Item grants give levels, never hard points; a +levels line on a class skill is shown as a maxed skill (the default)
  const hardPoints = skillRef.kind === 'plus' ? undefined : 0;
  const values = calc.index === undefined || record === undefined ? [] : headlineValues(record, calc.index, at.level, hardPoints);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5">
        <SkillIcon icon={skill.icon} size={36} />
        <div className="min-w-0">
          <p className="font-semibold leading-tight">
            {skill.name}
            {suffix !== null && <span className="font-normal text-muted-foreground"> · {suffix}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{skill.cls === null ? 'Item skill' : CLASS_NAMES[skill.cls]}</p>
        </div>
      </div>
      <p className="text-xs">{skillRefText(skillRef)}</p>
      {calc.status === 'loading' && <p className="text-xs text-muted-foreground">Loading the values…</p>}
      {values.length > 0 && (
        <div className="text-xs">
          <p className="text-muted-foreground">{at.label}:</p>
          <ul className="text-blue-700 dark:text-blue-400">
            {values.map((value, i) => (
              <li key={`${String(i)}:${value}`}>{value}</li>
            ))}
          </ul>
        </div>
      )}
      <Link
        to={skillRefUrl(skill, at.urlLevel)}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Open in Skills {newTab ? '(new tab) ' : ''}→
      </Link>
    </div>
  );
}
