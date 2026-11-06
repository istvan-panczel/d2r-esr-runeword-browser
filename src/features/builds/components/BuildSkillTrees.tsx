import { useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import type { SkillDetail } from '@/features/game-data/engine/schema';
import { LevelInput } from '@/features/skills/components/LevelInput';
import { SkillClassTrees } from '@/features/skills/components/SkillClassTrees';
import { SkillDetailCard } from '@/features/skills/components/SkillDetailCard';
import type { SkillLevelsConfig } from '@/features/skills/components/SkillLevelValues';
import type { SkillTileDecoration } from '@/features/skills/components/SkillTile';
import { SkillTreesLayout } from '@/features/skills/components/SkillTreesLayout';
import { useDetailScroll } from '@/features/skills/hooks/useDetailScroll';
import { useMythicalNames } from '@/features/skills/hooks/useMythicalNames';
import {
  buildSkillLevel,
  DEFAULT_CHAR_LEVEL,
  DEFAULT_SKILL_LEVEL,
  gearForLevel,
  MAX_LEVEL,
  type SynergySetting,
} from '@/features/skills/utils/skillLevels';
import { selectionMarks, type SkillClassView, type SkillsView } from '@/features/skills/utils/skills';
import type { SkillPoints } from '../utils/skillTree';
import { SkillPointControls, SkillPointsCounter } from './SkillPointControls';

interface BuildSkillTreesProps {
  readonly view: SkillsView;
  readonly cls: SkillClassView;
  readonly skillPoints: SkillPoints;
  /** Points per tab, in tab order */
  readonly tabCounts: readonly number[];
  /** Omitted on the read-only detail page */
  readonly onChange?: (id: string, points: number) => void;
  readonly disabled?: boolean;
}

const LINK = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

/**
 * A build's skill allocation as the Skills page trees: icon tiles with a point badge (amber above the skill's max
 * level), the selected skill's detail card beside them with the point controls (editor) or the counter (read-only).
 * Without `onChange`, skills without points are dimmed like in game. The selection is local state.
 *
 * The card's values per level follow the build: level = allocated points + "+skills from gear" (local, not saved),
 * synergy points = the build's points in each synergy until changed (local, "Reset to build"). A skill without points
 * gets the free level input instead.
 */
export function BuildSkillTrees({ view, cls, skillPoints, tabCounts, onChange, disabled = false }: BuildSkillTreesProps) {
  const readOnly = onChange === undefined;
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState(cls.tabs[0]?.page ?? 1);
  const mythicals = useMythicalNames();
  const { ref, requestScroll } = useDetailScroll(selected);
  const gearId = useId();
  const [gear, setGear] = useState(0);
  const [freeLevel, setFreeLevel] = useState(DEFAULT_SKILL_LEVEL);
  const [charLevel, setCharLevel] = useState(DEFAULT_CHAR_LEVEL);
  /** null = the build's own points in the synergies */
  const [synergy, setSynergy] = useState<'max' | readonly number[] | null>(null);
  // The editor remounts on a class change; a selection from another class is dropped all the same.
  const detail = selected === null ? undefined : view.byId.get(selected);
  const current = detail !== undefined && detail.cls === cls.code ? detail : undefined;
  const markOf = selectionMarks(view, current?.id ?? null);
  const pointsOf = (id: string) => skillPoints[id] ?? 0;

  const select = (id: string) => {
    const target = view.byId.get(id);
    if (target === undefined || target.cls !== cls.code) return;
    requestScroll();
    setSelected(id);
    // Synergy points belong to one skill; the max mode stays
    if (synergy !== 'max') setSynergy(null);
    if (target.page !== null) setTab(target.page);
  };
  const tileProps = (skill: SkillDetail): SkillTileDecoration => {
    const points = pointsOf(skill.id);
    return { badge: points > 0 ? String(points) : undefined, badgeWarning: points > skill.maxLevel, dimmed: readOnly && points === 0 };
  };

  const levelsOf = (skill: SkillDetail): SkillLevelsConfig => {
    const points = pointsOf(skill.id);
    const learned = points > 0;
    // More points lower the gear's cap; the shown gear follows it (the state keeps the typed value)
    const gearMax = Math.max(0, MAX_LEVEL - points);
    const shownGear = Math.min(gear, gearMax);
    const level = learned ? buildSkillLevel(points, shownGear) : freeLevel;
    const setting: SynergySetting = synergy ?? skillPoints;
    return {
      state: { level, charLevel, synergy: setting },
      hardPoints: learned ? points : undefined,
      // gear cannot lower the level below the allocated points
      minPickLevel: learned ? points : undefined,
      onChange: (patch) => {
        if (patch.level !== undefined) {
          if (learned) setGear(gearForLevel(points, patch.level));
          else setFreeLevel(patch.level);
        }
        if (patch.charLevel !== undefined) setCharLevel(patch.charLevel);
        if (patch.synergy !== undefined) setSynergy(patch.synergy);
      },
      levelControl: learned ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Label htmlFor={gearId} className="shrink-0 text-xs font-normal text-muted-foreground">
            +Skills from gear
          </Label>
          <LevelInput id={gearId} value={shownGear} min={0} max={gearMax} onCommit={setGear} />
          <span className="text-xs text-muted-foreground">
            Level <span className="font-semibold text-foreground tabular-nums">{level}</span> = {points} hard point{points === 1 ? '' : 's'}{' '}
            + {shownGear}
          </span>
        </div>
      ) : undefined,
      note: learned ? undefined : (
        <p className="text-xs text-muted-foreground">Not learned in this build: the level below is not tied to the build.</p>
      ),
      synergyAction:
        synergy === null ? undefined : (
          <button
            type="button"
            className={`${LINK} text-xs`}
            onClick={() => {
              setSynergy(null);
            }}
          >
            Reset to build
          </button>
        ),
    };
  };

  const card =
    current === undefined ? null : (
      <div ref={ref} className="scroll-mt-20">
        <SkillDetailCard
          key={current.id}
          view={view}
          skill={current}
          mythicals={mythicals}
          onSelect={select}
          onClose={() => {
            setSelected(null);
          }}
          levels={levelsOf(current)}
        >
          {onChange === undefined ? (
            <p>
              <span className="text-muted-foreground">Points: </span>
              <SkillPointsCounter points={pointsOf(current.id)} maxLevel={current.maxLevel} />
            </p>
          ) : (
            <SkillPointControls
              skill={current}
              points={pointsOf(current.id)}
              disabled={disabled}
              onChange={(points) => {
                onChange(current.id, points);
              }}
            />
          )}
        </SkillDetailCard>
      </div>
    );

  return (
    <SkillTreesLayout aside={card} placeholder={readOnly ? 'Pick a skill to see its details.' : 'Pick a skill to allocate points.'}>
      <SkillClassTrees
        cls={cls}
        tab={tab}
        onTabChange={setTab}
        markOf={markOf}
        onSelect={select}
        tabCounts={tabCounts}
        tileProps={tileProps}
      />
    </SkillTreesLayout>
  );
}
