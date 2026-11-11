import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LevelStepper } from '@/features/skills/components/LevelInput';
import type { AppliedBuff, AvailableBuff, BuffSelection } from '../../engine/sheet/types';
import { buffGroups, isBuffOn, setBuffLevel, toggleBuff } from '../../engine/sheetView';
import { BuffedBadge } from './BuffedBadge';
import { SheetCard, type ItemNamer } from './SheetParts';

interface BuffSwitchProps {
  readonly buff: AvailableBuff;
  readonly selections: readonly BuffSelection[];
  readonly applied: AppliedBuff | undefined;
  readonly itemName: ItemNamer;
  readonly onChange: (selections: readonly BuffSelection[]) => void;
}

function BuffSwitch({ buff, selections, applied, itemName, onChange }: BuffSwitchProps) {
  const id = useId();
  const on = isBuffOn(selections, buff.skillId);
  const chosen = selections.find((entry) => entry.skillId === buff.skillId)?.level;
  const level = applied?.level ?? chosen ?? buff.level;
  const source = buff.item === undefined ? null : itemName(buff.item);
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
        <span>
          <span className="font-medium">{buff.name}</span> <span className="text-muted-foreground tabular-nums">level {level}</span>
          {buff.kind === 'proc' && (
            <span className="block text-xs text-muted-foreground">
              {buff.chance === undefined ? '' : `${String(buff.chance)}% chance`}
              {source === null ? '' : `${buff.chance === undefined ? '' : ', '}from ${source}`}
            </span>
          )}
        </span>
      </Label>
      {on && buff.kind !== 'proc' && (
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
              className="rounded font-medium text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                onChange(setBuffLevel(selections, buff, null));
              }}
            >
              Your level
            </button>
          )}
        </span>
      )}
    </li>
  );
}

interface BuffsPanelProps {
  readonly available: readonly AvailableBuff[];
  readonly selections: readonly BuffSelection[];
  readonly applied: readonly AppliedBuff[];
  readonly itemName: ItemNamer;
  readonly onChange: (selections: readonly BuffSelection[]) => void;
}

/**
 * The buff switches: the character's own cast skills and auras and its items' self-buff procs that would change a
 * number. Off by default (the sheet is the unbuffed character); a switched-on buff recomputes every tab.
 */
export function BuffsPanel({ available, selections, applied, itemName, onChange }: BuffsPanelProps) {
  const groups = buffGroups(available);
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
              className="rounded text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
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
            Switch on what you would have up in a fight. Changed numbers show the unbuffed value struck through and the ? mark: buffed
            numbers are worked out from the skill data and have not been checked in game yet. Remembered for this browser tab.
          </p>
          <div className="grid gap-x-6 gap-y-3 @3xl/page:grid-cols-3">
            {groups.map((group) => (
              <div key={group.kind} className="min-w-0">
                <h4 className="text-sm font-medium">{group.title}</h4>
                <p className="text-xs text-muted-foreground">{group.hint}</p>
                <ul className="divide-y">
                  {group.buffs.map((buff) => (
                    <BuffSwitch
                      key={`${buff.kind}:${String(buff.skillId)}`}
                      buff={buff}
                      selections={selections}
                      applied={applied.find((entry) => entry.skillId === buff.skillId)}
                      itemName={itemName}
                      onChange={onChange}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </SheetCard>
  );
}
