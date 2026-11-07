import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, CircleQuestionMark } from 'lucide-react';
import type { SkillComboBonus, SkillComboSkill } from '@/features/game-data/engine/schema';
import { cn } from '@/lib/utils';
import { comboSegments, comboStatus, type ComboStatus } from '../utils/comboBonuses';
import { descriptionParagraphs, keyed } from '../utils/skills';

interface SkillComboBonusesProps {
  readonly combos: readonly SkillComboBonus[];
  /** The skill whose tooltip lists the bonuses: its name is plain text, the others go through `renderSkill` */
  readonly skillId: string;
  /** A named skill (the card: a link that selects it); default: plain text */
  readonly renderSkill?: (skill: SkillComboSkill & { readonly id: string }) => ReactNode;
  /** A build's hard points per skill id: each bonus says whether the build reaches it */
  readonly pointsOf?: (id: string) => number;
  /** Smaller text (the skill peek) */
  readonly compact?: boolean;
}

/**
 * The tooltip's "If both A and B have 20 levels:" bonuses in an amber box: the condition (other skills as links), the
 * bonus, on a build whether it is reached. ESR's formulas read the skills' hard points (docs/features/SKILLS.md).
 */
export function SkillComboBonuses({ combos, skillId, renderSkill, pointsOf, compact = false }: SkillComboBonusesProps) {
  return (
    <section
      aria-label={combos.length === 1 ? 'Combo bonus' : 'Combo bonuses'}
      className={cn('space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2', compact ? 'text-xs' : 'text-sm')}
    >
      {keyed(combos, (combo) => combo.condition).map(({ key, value: combo }, i) => (
        <div key={key} className={cn('space-y-0.5', i > 0 && 'border-t border-amber-500/30 pt-2')}>
          <p className="text-amber-900 dark:text-amber-200">
            {comboSegments(combo).map((segment, j) => {
              const { skill } = segment;
              const id = skill?.id;
              const content =
                skill === undefined ? (
                  segment.text
                ) : id === undefined || id === skillId || renderSkill === undefined ? (
                  <span className="font-semibold">{segment.text}</span>
                ) : (
                  renderSkill({ ...skill, id })
                );
              return <span key={`${String(j)}:${segment.text}`}>{content}</span>;
            })}
            :
          </p>
          {keyed(descriptionParagraphs(combo.text), String).map(({ key: line, value }) => (
            <p key={line} className="font-medium text-foreground">
              {value}
            </p>
          ))}
          {pointsOf !== undefined && <BuildStatus status={comboStatus(combo, pointsOf)} level={combo.level} />}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Hard points only: +skills from items do not count.</p>
    </section>
  );
}

const STATUS = {
  active: { icon: CircleCheck, label: 'Active in this build', className: 'text-green-700 dark:text-green-400' },
  inactive: { icon: CircleDashed, label: 'Not active in this build', className: 'text-muted-foreground' },
  unknown: { icon: CircleQuestionMark, label: 'Not checked', className: 'text-muted-foreground' },
} as const;

/** "Active in this build · Splintering Javelin 20/20 · Eagle Eye 20/20" */
function BuildStatus({ status, level }: { readonly status: ComboStatus; readonly level: number }) {
  const { icon: Icon, label, className } = STATUS[status.state];
  const unchecked = status.skills.filter((skill) => skill.points === null).map((skill) => skill.name);
  return (
    <p className="flex items-start gap-1.5 pt-0.5 text-xs">
      <Icon className={cn('mt-px size-3.5 shrink-0', className)} aria-hidden />
      <span>
        <span className={cn('font-medium', className)}>{label}</span>
        {unchecked.length > 0 && <span className="text-muted-foreground"> ({unchecked.join(', ')} is not one skill)</span>}
        {status.skills.map((skill) =>
          skill.points === null ? null : (
            <span key={skill.name} className="text-muted-foreground">
              {' · '}
              {skill.name}{' '}
              <span className="text-foreground tabular-nums">
                {skill.points}/{level}
              </span>
            </span>
          )
        )}
      </span>
    </p>
  );
}
