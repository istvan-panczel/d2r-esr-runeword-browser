import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LevelStepper } from '@/features/skills/components/LevelInput';
import type { AppliedBuff, AvailableBuff, BuffSelection } from '../../engine/sheet/types';
import {
  buffFormText,
  buffGroups,
  canShapeShift,
  castSetText,
  chooseInGroup,
  chosenInGroup,
  isBuffOn,
  setBuffLevel,
  splitExclusive,
  swapCastNote,
  toggleBuff,
  type BuffChoice,
} from '../../engine/sheetView';
import { BuffedBadge } from './BuffedBadge';
import { SheetCard, type ItemNamer } from './SheetParts';

const LINK_CLASS =
  'rounded font-medium text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring';

interface BuffRowProps {
  readonly buff: AvailableBuff;
  readonly selections: readonly BuffSelection[];
  readonly applied: AppliedBuff | undefined;
  /** "Not counted: it needs Werewolf form.": why the switched-on buff does not count in the character's form */
  readonly blocked: string | null;
  /** The character has a shape-shift among its buffs */
  readonly shifter: boolean;
  readonly itemName: ItemNamer;
  readonly onChange: (selections: readonly BuffSelection[]) => void;
}

/** "from Thunder Star, Crusader Gauntlets": the items that cast the skill (a proc), or that also cast it (an own skill) */
function itemsText(buff: AvailableBuff, itemName: ItemNamer): string | null {
  const indices = buff.items ?? (buff.item === undefined ? [] : [buff.item]);
  const names = indices.map((index) => itemName(index) ?? 'an item');
  if (names.length === 0) return null;
  const list = [...new Set(names)].join(', ');
  return buff.kind === 'proc' ? `from ${list}` : `also cast by ${list}`;
}

interface BuffTextProps {
  readonly buff: AvailableBuff;
  readonly level: number;
  /** The weapon set the level comes from when it is the other one (the applied buff's once it counts) */
  readonly castSet: 1 | 2 | undefined;
  readonly shifter: boolean;
  readonly itemName: ItemNamer;
}

/** The name, level, weapon set, chance and items of a buff (the label of its switch) */
function BuffText({ buff, level, castSet, shifter, itemName }: BuffTextProps) {
  const items = itemsText(buff, itemName);
  const chance = buff.kind === 'proc' && buff.chance !== undefined ? `${String(buff.chance)}% chance` : null;
  const detail = [chance, items, buffFormText(buff, shifter)].filter((part) => part !== null).join(', ');
  const where = castSetText(castSet);
  return (
    <span>
      <span className="font-medium">{buff.name}</span>{' '}
      <span className="text-muted-foreground tabular-nums">
        level {level}
        {where !== null && `, ${where}`}
      </span>
      {detail !== '' && <span className="block text-xs text-muted-foreground">{detail}</span>}
    </span>
  );
}

/** The level stepper of a switched-on cast skill or aura (a proc keeps its item's level) and "Your level" */
function LevelControls({
  buff,
  selections,
  level,
  onChange,
}: Pick<BuffRowProps, 'buff' | 'selections' | 'onChange'> & { readonly level: number }) {
  const chosen = selections.find((entry) => entry.skillId === buff.skillId)?.level;
  if (buff.kind === 'proc') return null;
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <LevelStepper
        label={`${buff.name} level`}
        value={level}
        min={1}
        max={99}
        onCommit={(next) => {
          onChange(setBuffLevel(selections, buff, next));
        }}
      />
      {chosen !== undefined && (
        <button
          type="button"
          className={LINK_CLASS}
          onClick={() => {
            onChange(setBuffLevel(selections, buff, null));
          }}
        >
          Your level
        </button>
      )}
    </span>
  );
}

const levelOf = (buff: AvailableBuff, selections: readonly BuffSelection[], applied: AppliedBuff | undefined) =>
  applied?.level ?? selections.find((entry) => entry.skillId === buff.skillId)?.level ?? buff.level;

/** Where the level comes from: the counted buff's set once it is on (a chosen level has none), else the listed one */
const castSetOf = (buff: AvailableBuff, applied: AppliedBuff | undefined) => (applied === undefined ? buff.castSet : applied.castSet);

const BLOCKED_CLASS = 'basis-full text-xs text-amber-700 dark:text-amber-400';

function BuffSwitch({ buff, selections, applied, blocked, shifter, itemName, onChange }: BuffRowProps) {
  const id = useId();
  const on = isBuffOn(selections, buff.skillId);
  const level = levelOf(buff, selections, applied);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1">
      <Label htmlFor={id} className="min-w-0 cursor-pointer items-start font-normal">
        <Checkbox
          id={id}
          className="mt-0.5"
          checked={on}
          onCheckedChange={(checked) => {
            onChange(toggleBuff(selections, buff, checked === true));
          }}
        />
        <BuffText buff={buff} level={level} castSet={castSetOf(buff, applied)} shifter={shifter} itemName={itemName} />
      </Label>
      {on && <LevelControls buff={buff} selections={selections} level={level} onChange={onChange} />}
      {on && blocked !== null && <span className={BLOCKED_CLASS}>{blocked}</span>}
    </li>
  );
}

interface BuffChoiceGroupProps {
  readonly choice: BuffChoice;
  readonly selections: readonly BuffSelection[];
  readonly applied: readonly AppliedBuff[];
  readonly itemName: ItemNamer;
  readonly onChange: (selections: readonly BuffSelection[]) => void;
}

/**
 * A single-choice group (own auras, shape-shifts): native radio buttons with a "None" option, so it can never show two
 * as on and the arrow keys move between them, as in any radio group
 */
function BuffChoiceGroup({ choice, selections, applied, itemName, onChange }: BuffChoiceGroupProps) {
  const name = useId();
  const chosen = chosenInGroup(selections, choice);
  const radio = 'mt-0.5 size-4 shrink-0 accent-primary';
  return (
    <fieldset className="py-1">
      <legend className="text-xs text-muted-foreground">{choice.title}</legend>
      <ul className="divide-y">
        <li className="py-1">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name={name}
              className={radio}
              checked={chosen === null}
              onChange={() => {
                onChange(chooseInGroup(selections, choice, null));
              }}
            />
            <span className="text-muted-foreground">None</span>
          </label>
        </li>
        {choice.buffs.map((buff) => {
          const on = chosen?.skillId === buff.skillId;
          const counted = applied.find((entry) => entry.skillId === buff.skillId);
          const level = levelOf(buff, selections, counted);
          return (
            <li key={buff.skillId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1">
              <label className="flex min-w-0 cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={name}
                  className={radio}
                  checked={on}
                  onChange={() => {
                    onChange(chooseInGroup(selections, choice, buff));
                  }}
                />
                <BuffText buff={buff} level={level} castSet={castSetOf(buff, counted)} shifter itemName={itemName} />
              </label>
              {on && <LevelControls buff={buff} selections={selections} level={level} onChange={onChange} />}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

interface BuffsPanelProps {
  readonly available: readonly AvailableBuff[];
  readonly selections: readonly BuffSelection[];
  readonly applied: readonly AppliedBuff[];
  /** Why a switched-on buff does not count in the character's form ("Not counted: …"), else null */
  readonly blocked: (skillId: number) => string | null;
  readonly itemName: ItemNamer;
  readonly onChange: (selections: readonly BuffSelection[]) => void;
}

/**
 * The buff switches: the character's own cast skills and auras and its items' self-buff procs that would change a
 * number. Off by default (the sheet is the unbuffed character); a switched-on buff recomputes every tab. Own auras and
 * shape-shifts are single choice (the engine counts one of each).
 */
export function BuffsPanel({ available, selections, applied, blocked, itemName, onChange }: BuffsPanelProps) {
  const groups = buffGroups(available);
  const swapNote = swapCastNote(available);
  const shifter = canShapeShift(available);
  return (
    <SheetCard
      id="character-buffs"
      title="Buffs"
      actions={
        selections.length > 0 ? (
          <span className="flex flex-wrap items-center gap-2">
            <BuffedBadge />
            <button
              type="button"
              className={`${LINK_CLASS} text-xs`}
              onClick={() => {
                onChange([]);
              }}
            >
              Switch all off
            </button>
          </span>
        ) : undefined
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No buff of this character changes a number on the sheet.</p>
      ) : (
        <>
          <p className="mb-2 max-w-prose text-xs text-muted-foreground">
            Switch on what you would have up in a fight. Only buffs that change a number shown here are listed. Changed numbers show the
            unbuffed value struck through and the ? mark: buffed numbers are worked out from the skill data and have not been checked in
            game yet.{shifter && ' A shape-shifted form allows only its own skills and the ones every form can use.'} Remembered for this
            browser tab.
          </p>
          {swapNote !== null && <p className="mb-2 max-w-prose text-xs text-muted-foreground">{swapNote}</p>}
          <div className="grid gap-x-6 gap-y-3 @3xl/page:grid-cols-3">
            {groups.map((group) => {
              const { singles, choices } = splitExclusive(group.buffs);
              return (
                <div key={group.kind} className="min-w-0">
                  <h4 className="text-sm font-medium">{group.title}</h4>
                  <p className="text-xs text-muted-foreground">{group.hint}</p>
                  {singles.length > 0 && (
                    <ul className="divide-y">
                      {singles.map((buff) => (
                        <BuffSwitch
                          key={`${buff.kind}:${String(buff.skillId)}`}
                          buff={buff}
                          selections={selections}
                          applied={applied.find((entry) => entry.skillId === buff.skillId)}
                          blocked={blocked(buff.skillId)}
                          shifter={shifter}
                          itemName={itemName}
                          onChange={onChange}
                        />
                      ))}
                    </ul>
                  )}
                  {choices.map((choice) => (
                    <BuffChoiceGroup
                      key={choice.group}
                      choice={choice}
                      selections={selections}
                      applied={applied}
                      itemName={itemName}
                      onChange={onChange}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </SheetCard>
  );
}
