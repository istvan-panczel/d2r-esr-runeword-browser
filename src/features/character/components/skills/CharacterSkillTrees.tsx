import { useState } from 'react';
import type { SkillDetail } from '@/features/game-data/engine/schema';
import { SkillPointsCounter } from '@/features/builds/components/SkillPointControls';
import { LevelStepper } from '@/features/skills/components/LevelInput';
import { SkillClassTrees } from '@/features/skills/components/SkillClassTrees';
import { SkillDetailCard } from '@/features/skills/components/SkillDetailCard';
import type { SkillLevelsConfig } from '@/features/skills/components/SkillLevelValues';
import type { SkillTileDecoration } from '@/features/skills/components/SkillTile';
import { SkillTreesLayout } from '@/features/skills/components/SkillTreesLayout';
import { useDetailScroll } from '@/features/skills/hooks/useDetailScroll';
import { useMythicalNames } from '@/features/skills/hooks/useMythicalNames';
import { MAX_LEVEL } from '@/features/skills/utils/skillLevels';
import { selectionMarks, type SkillClassView, type SkillsView } from '@/features/skills/utils/skills';
import type { SkillBonus } from '../../engine/sheetView';

interface CharacterSkillTreesProps {
  readonly view: SkillsView;
  readonly cls: SkillClassView;
  /** Hard points by skills.json id */
  readonly hardPoints: Readonly<Record<string, number>>;
  /** Effective levels from the computed sheet by skills.json id */
  readonly levels: ReadonlyMap<string, SkillBonus>;
  /** Points per tab, in tab order */
  readonly tabCounts: readonly number[];
  readonly characterLevel: number;
}

/**
 * The character's class tree, read-only: each tile's badge is the skill's level with every bonus (hard points +
 * skills from items, sets, auras and the buffs switched on), dimmed without one, as in game. The detail card opens at
 * that level with the character's level and its hard points in the synergies; the level can be stepped for a "what if".
 */
export function CharacterSkillTrees({ view, cls, hardPoints, levels, tabCounts, characterLevel }: CharacterSkillTreesProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState(cls.tabs[0]?.page ?? 1);
  /** A level picked on the card (null: the sheet's) */
  const [picked, setPicked] = useState<number | null>(null);
  const [charLevel, setCharLevel] = useState(characterLevel);
  const [synergy, setSynergy] = useState<'max' | readonly number[] | null>(null);
  const mythicals = useMythicalNames();
  const { ref, requestScroll } = useDetailScroll(selected);
  const detail = selected === null ? undefined : view.byId.get(selected);
  const current = detail !== undefined && detail.cls === cls.code ? detail : undefined;
  const markOf = selectionMarks(view, current?.id ?? null);
  const hardOf = (id: string) => hardPoints[id] ?? 0;
  const levelOf = (id: string) => levels.get(id)?.level ?? hardOf(id);

  const select = (id: string) => {
    const target = view.byId.get(id);
    if (target === undefined || target.cls !== cls.code) return;
    requestScroll();
    setSelected(id);
    setPicked(null);
    if (synergy !== 'max') setSynergy(null);
    if (target.page !== null) setTab(target.page);
  };
  const tileProps = (skill: SkillDetail): SkillTileDecoration => {
    const level = levelOf(skill.id);
    return { badge: level > 0 ? String(level) : undefined, badgeWarning: hardOf(skill.id) > skill.maxLevel, dimmed: level === 0 };
  };

  const levelsOf = (skill: SkillDetail): SkillLevelsConfig => {
    const hard = hardOf(skill.id);
    const own = levelOf(skill.id);
    const level = Math.max(1, Math.min(MAX_LEVEL, picked ?? own));
    return {
      state: { level, charLevel, synergy: synergy ?? hardPoints },
      hardPoints: hard > 0 ? hard : undefined,
      onChange: (patch) => {
        if (patch.level !== undefined) setPicked(patch.level);
        if (patch.charLevel !== undefined) setCharLevel(patch.charLevel);
        if (patch.synergy !== undefined) setSynergy(patch.synergy);
      },
      levelControl: (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <LevelStepper label="skill level" value={level} min={1} max={MAX_LEVEL} onCommit={setPicked} />
          <span>
            {own > 0 ? (
              <>
                This character: level <span className="font-semibold text-foreground tabular-nums">{own}</span> = {hard} hard + {own - hard}{' '}
                from bonuses
              </>
            ) : (
              'Not learned by this character'
            )}
          </span>
          {picked !== null && picked !== own && own > 0 && (
            <button
              type="button"
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              onClick={() => {
                setPicked(null);
              }}
            >
              Back to the character&apos;s level
            </button>
          )}
        </div>
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
          comboPoints={hardOf}
        >
          <p>
            <span className="text-muted-foreground">Hard points: </span>
            <SkillPointsCounter points={hardOf(current.id)} maxLevel={current.maxLevel} />
          </p>
        </SkillDetailCard>
      </div>
    );

  return (
    <SkillTreesLayout aside={card} placeholder="Pick a skill to see its details at the character's level.">
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
