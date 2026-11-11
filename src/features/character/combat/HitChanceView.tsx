import { useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { CombatBundle } from '@/features/game-data/engine/schema';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { Pills } from '@/features/game-data/components/EnhanceParts';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { CombatDetails } from './CombatDetails';
import { CombatTable } from './CombatTable';
import {
  COMBAT_KINDS,
  DIFFICULTY_NAMES,
  buildCombatSections,
  editedFor,
  prepareCombatData,
  type CombatKind,
  type CombatPlayer,
  type CombatRow,
  type CombatSection,
  type InputEdit as Edit,
} from './combatRows';
import type { CombatDifficulty } from './monsterStats';

export interface HitChanceViewProps {
  /** The character's attack rating against monsters (the inputs start from it and can be changed) */
  readonly attackRating?: number;
  readonly defense?: number;
  /** Shown only: ESR's hit formula has no level term */
  readonly characterLevel?: number;
  readonly ignoreTargetDefense?: boolean;
  /** "−x% Target Defense" as a positive number */
  readonly targetDefenseReductionPercent?: number;
  /** The difficulty shown, when the page owns it (the My Character page's chosen difficulty); default Hell, local */
  readonly difficulty?: CombatDifficulty;
  readonly onDifficultyChange?: (difficulty: CombatDifficulty) => void;
}

const COMBAT_FILES = ['combat'] as const;
const VALUE_LIMIT = 1_000_000_000;
/** The series colours (dataviz reference palette slots 1 and 2, validated in both themes against the card surface) */
const SERIES_COLORS = '[--combat-hit:#2a78d6] [--combat-behit:#eb6834] dark:[--combat-hit:#3987e5] dark:[--combat-behit:#d95926]';
const CARD_CLASS = 'rounded-xl border bg-card p-4 shadow-sm';
const DIFFICULTY_OPTIONS = DIFFICULTY_NAMES.map((label, value) => ({ value: String(value), label }));
const KIND_OPTIONS = COMBAT_KINDS.map(({ kind, label }) => ({ value: kind, label }));

/**
 * Chance to hit and to be hit across the areas, endgame maps and bosses for an attack rating and a defense: a table of
 * every area and boss, the curve with the selected one marked, and what a chance would take. Self-contained (loads
 * combat.json); the props only seed the inputs.
 */
export function HitChanceView(props: HitChanceViewProps) {
  const gameData = useGameData(COMBAT_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return <HitChanceContent bundle={gameData.data.combat} {...props} />;
}

/** A whole number from an input, or undefined when blank / not a number; clamped to 0..max */
function parseInput(text: string, max: number): number | undefined {
  if (text.trim() === '') return undefined;
  const value = Number(text);
  if (!Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

const inputText = (value: number | undefined) => (value === undefined ? '' : String(value));

const rowsByKey = (sections: readonly CombatSection[]) =>
  new Map(sections.flatMap((section) => section.groups.flatMap((group) => group.rows.map((row) => [row.key, row] as const))));

function HitChanceContent({ bundle, ...props }: HitChanceViewProps & { readonly bundle: CombatBundle }) {
  // Edited inputs; null = follow the prop (the character's value). An edit lasts while its prop stays the same.
  const [arEdit, setArEdit] = useState<Edit<string> | null>(null);
  const [defEdit, setDefEdit] = useState<Edit<string> | null>(null);
  const [reductionEdit, setReductionEdit] = useState<Edit<string> | null>(null);
  const [ignoreEdit, setIgnoreEdit] = useState<Edit<boolean> | null>(null);
  const arText = editedFor(arEdit, props.attackRating);
  const defText = editedFor(defEdit, props.defense);
  const reductionText = editedFor(reductionEdit, props.targetDefenseReductionPercent);
  const ignoreDefense = editedFor(ignoreEdit, props.ignoreTargetDefense);
  const setArText = (value: string) => {
    setArEdit({ value, over: props.attackRating });
  };
  const setDefText = (value: string) => {
    setDefEdit({ value, over: props.defense });
  };
  const setReductionText = (value: string) => {
    setReductionEdit({ value, over: props.targetDefenseReductionPercent });
  };
  const setIgnoreDefense = (value: boolean) => {
    setIgnoreEdit({ value, over: props.ignoreTargetDefense });
  };
  const [ownDifficulty, setOwnDifficulty] = useState<CombatDifficulty>(2);
  const difficulty = props.difficulty ?? ownDifficulty;
  const setDifficulty = (value: CombatDifficulty) => {
    setOwnDifficulty(value);
    props.onDifficultyChange?.(value);
  };
  const [kind, setKind] = useState<CombatKind>('regular');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const data = prepareCombatData(bundle);
  const arValue = arText ?? inputText(props.attackRating);
  const defValue = defText ?? inputText(props.defense);
  const reductionValue = reductionText ?? inputText(props.targetDefenseReductionPercent);
  const player: CombatPlayer = {
    attackRating: parseInput(arValue, VALUE_LIMIT),
    defense: parseInput(defValue, VALUE_LIMIT),
    targetDefenseReductionPercent: parseInput(reductionValue, 100),
    ignoreTargetDefense: ignoreDefense ?? props.ignoreTargetDefense ?? false,
  };
  const edited = arText !== null || defText !== null || reductionText !== null || ignoreDefense !== null;
  const hasCharacter = props.attackRating !== undefined || props.defense !== undefined;

  const sections = buildCombatSections(data, player, { difficulty, kind });
  const rows = rowsByKey(sections);
  // Champion / unique medians under each regular row
  const champions = kind === 'regular' ? rowsByKey(buildCombatSections(data, player, { difficulty, kind: 'champion' })) : null;
  const uniques = kind === 'regular' ? rowsByKey(buildCombatSections(data, player, { difficulty, kind: 'unique' })) : null;
  const fallbackRow: CombatRow | undefined =
    sections.find((section) => section.key === 'maps')?.groups[0]?.rows[0] ?? rows.values().next().value;
  const selected = (selectedKey === null ? undefined : rows.get(selectedKey)) ?? fallbackRow;

  const select = (key: string) => {
    setSelectedKey(key);
    // Below the two-column layout the details come after the table: bring them into view
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches)
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = () => {
    setArEdit(null);
    setDefEdit(null);
    setReductionEdit(null);
    setIgnoreEdit(null);
  };

  return (
    <div className={`space-y-4 ${SERIES_COLORS}`}>
      <section className={`${CARD_CLASS} space-y-3`} aria-label="Your attack rating and defense, and what to show">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(3,minmax(0,11rem))_auto] sm:items-end">
          <NumberField id="combat-ar" label="Attack rating" value={arValue} onChange={setArText} />
          <NumberField id="combat-def" label="Defense" value={defValue} onChange={setDefText} />
          <NumberField id="combat-td" label="−% Target defense" value={reductionValue} onChange={setReductionText} max={100} />
          <Label htmlFor="combat-itd" className="h-9 cursor-pointer font-normal">
            <Checkbox
              id="combat-itd"
              checked={player.ignoreTargetDefense === true}
              onCheckedChange={(checked) => {
                setIgnoreDefense(checked === true);
              }}
            />
            Ignore Target&apos;s Defense
          </Label>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Pills
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={String(difficulty)}
            onChange={(value) => {
              setDifficulty(Number(value) as CombatDifficulty);
            }}
          />
          <Pills
            label="Monster kind"
            options={KIND_OPTIONS}
            value={kind}
            onChange={(value) => {
              setKind(value as CombatKind);
            }}
          />
          {hasCharacter && edited && (
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              Use the character&apos;s values
            </Button>
          )}
        </div>
        {props.characterLevel !== undefined && (
          <p className="text-xs text-muted-foreground">
            Level {props.characterLevel}: your level does not change these chances, ESR&apos;s hit formula has no level term.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {player.attackRating === undefined && player.defense === undefined
            ? 'Enter an attack rating and a defense to fill in the chances. '
            : ''}
          Select an area or boss to see it on the curve with what a better chance would take.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className={`${CARD_CLASS} space-y-6`}>
          {sections.map((section) => (
            <CombatTable
              key={section.key}
              section={section}
              kind={kind}
              champions={champions}
              uniques={uniques}
              selectedKey={selected?.key ?? null}
              onSelect={select}
            />
          ))}
        </div>
        <div ref={detailsRef} className={`${CARD_CLASS} scroll-mt-20 lg:sticky lg:top-20`}>
          {selected === undefined ? (
            <p className="text-sm text-muted-foreground">No area has monsters in this difficulty.</p>
          ) : (
            <CombatDetails data={data} row={selected} player={player} difficulty={difficulty} kind={kind} />
          )}
        </div>
      </div>

      <CombatNotes />
    </div>
  );
}

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly max?: number;
}

function NumberField({ id, label, value, onChange, max = VALUE_LIMIT }: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="tabular-nums"
      />
    </div>
  );
}

/** What the numbers include and what they do not */
function CombatNotes() {
  return (
    <section className={`${CARD_CLASS} space-y-2 text-sm`} aria-labelledby="combat-notes">
      <h3 id="combat-notes" className="font-semibold">
        How these are worked out
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          ESR uses one hit curve for every attacker and defender: the chance depends only on attack rating ÷ defense (50% at 5×, 75% at 8×),
          with no level term, from 0% to 100%. The game shows these chances only after you hit a monster type; here they come from the game
          files.
        </li>
        <li>
          Chance to be hit is the hit roll only. Block and Dodge / Avoid / Evade come after it, so you are hit less often than shown. Spells
          and skills that always hit do not roll at all; areas whose monsters only cast show no chance to be hit.
        </li>
        <li>
          −% Target Defense lowers the monster&apos;s defense, halved against uniques and superuniques (the attack rating plugin&apos;s
          rule); it is also halved against bosses here, which is an assumption. Ignore Target&apos;s Defense makes every attack hit; whether
          it fails on bosses, as it did in the original game, is unknown.
        </li>
        <li>
          Monster levels: Nightmare and Hell use the area level, Normal the monster&apos;s own level. Champions are 2 levels higher with
          +75% attack rating, uniques 3 levels with +100% (game engine rules and monumod.txt; the level offsets are inferred). Normal
          champion and unique values are approximate.
        </li>
        <li>
          Each row is the area&apos;s median regular monster type, with the range of its types beside it. Treasure goblins, the Corrupted
          Zakarum special spawns and bosses are left out of the areas; bosses have their own rows. Terror zones raise monster levels and are
          not shown.
        </li>
      </ul>
    </section>
  );
}
