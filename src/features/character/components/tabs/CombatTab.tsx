import { useState } from 'react';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { Pills } from '@/features/game-data/components/EnhanceParts';
import { HitChanceView } from '../../combat';
import { attackChoices } from '../../engine/sheetView';
import { useCharacterSheet } from '../../hooks/useCharacterSheet';
import type { CharacterFile } from '../../parser/types';
import { BuffedBadge, UnbuffedBadge } from '../overview/BuffedBadge';
import { SheetFailedPanel } from '../SheetFailedPanel';
import { CARD_CLASS, NUMBER_FORMAT } from './tabClasses';

/**
 * Combat: the hit-chance view seeded with the computed sheet (defense, −% target defense, Ignore Target's Defense and
 * the attack rating of a chosen hand skill), following the page's difficulty and buffs. The inputs stay editable for a
 * "what if"; the view's "Use the character's values" goes back.
 */
export function CombatTab({ character }: { readonly character: CharacterFile }) {
  const state = useCharacterSheet(character);
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  if (state.status === 'loading') return <GameDataLoading />;
  if (state.status === 'error') return <GameDataError error={state.error} onRetry={state.retry} />;
  if (state.status === 'failed') return <SheetFailedPanel message={state.message} />;
  const { sheet } = state;
  const choices = attackChoices(sheet, NUMBER_FORMAT);
  const choice = choices.find((entry) => entry.key === choiceKey) ?? choices[0];
  const buffed = sheet.buffs.length > 0;

  return (
    <div className="space-y-4">
      <section aria-labelledby="character-combat" className={`${CARD_CLASS} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="character-combat" className="font-semibold">
            {character.name}&apos;s numbers
          </h3>
          {buffed ? <BuffedBadge /> : <UnbuffedBadge />}
        </div>
        {choices.length > 1 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Attack rating of</p>
            <Pills
              label="Attack rating of"
              options={choices.map((entry) => ({ value: entry.key, label: entry.label }))}
              value={choice.key}
              onChange={setChoiceKey}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          From the computed sheet: the attack rating of the skill on that mouse button, defense {NUMBER_FORMAT.format(sheet.defense.value)}
          {sheet.offense.targetDefense.value === 0 ? '' : `, −${String(sheet.offense.targetDefense.value)}% target defense`}
          {sheet.offense.ignoreTargetDefense.value > 0 ? ", Ignore Target's Defense" : ''}. Change the inputs below to try other values; the
          difficulty is the one the Overview&apos;s resistances use.
        </p>
      </section>
      <HitChanceView
        attackRating={choice.attackRating}
        defense={sheet.defense.value}
        characterLevel={sheet.level}
        ignoreTargetDefense={sheet.offense.ignoreTargetDefense.value > 0}
        targetDefenseReductionPercent={sheet.offense.targetDefense.value}
        difficulty={state.difficulty}
        onDifficultyChange={state.setDifficulty}
      />
    </div>
  );
}
