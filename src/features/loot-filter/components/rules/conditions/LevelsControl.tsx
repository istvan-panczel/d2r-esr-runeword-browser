import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { levelName } from '../../../engine/text';
import type { FilterLevel } from '../../../engine/types';
import { focusAfterRemoval } from '../../pickers/focusAfterRemoval';

interface LevelsControlProps {
  readonly id: string;
  readonly levels: readonly FilterLevel[];
  readonly value: readonly number[] | undefined;
  /** `undefined` = active at every level. */
  readonly onChange: (value: readonly number[] | undefined) => void;
}

/** "Every level" or a tick per filter level; ids the filter has no level for are listed with a remove button. */
export function LevelsControl({ id, levels, value, onChange }: LevelsControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const everyId = `${id}-every`;
  const levelIds = new Set(levels.map((level) => level.id));
  const unknown = (value ?? []).filter((levelId) => !levelIds.has(levelId));

  if (levels.length === 0 && value === undefined) {
    return <p className="text-sm text-muted-foreground">The filter has no levels (Settings tab), so the rule is always active.</p>;
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={everyId}
          data-focus-fallback
          checked={value === undefined}
          onCheckedChange={(checked) => {
            onChange(checked === true ? undefined : levels.map((level) => level.id));
          }}
        />
        <Label htmlFor={everyId} className="font-normal">
          Every level
        </Label>
      </div>
      {value !== undefined && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pl-1">
          {levels.map((level) => {
            const checkboxId = `${id}-${String(level.id)}`;
            return (
              <div key={level.id} className="flex items-center gap-1.5">
                <Checkbox
                  id={checkboxId}
                  checked={value.includes(level.id)}
                  onCheckedChange={(checked) => {
                    onChange(
                      checked === true ? [...value, level.id].sort((a, b) => a - b) : value.filter((levelId) => levelId !== level.id)
                    );
                  }}
                />
                <Label htmlFor={checkboxId} className="font-normal">
                  <span className="text-muted-foreground">{level.id}</span> {levelName(level)}
                </Label>
              </div>
            );
          })}
          {unknown.map((levelId, position) => (
            <span key={`unknown-${String(levelId)}`} className="flex items-center gap-1 text-sm text-destructive">
              unknown level {levelId}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6"
                aria-label={`Remove unknown level ${String(levelId)}`}
                data-remove
                onClick={() => {
                  onChange(value.filter((current) => current !== levelId));
                  focusAfterRemoval(containerRef.current, position);
                }}
              >
                <X />
              </Button>
            </span>
          ))}
          {value.length === 0 && (
            <p className="w-full text-xs text-amber-700 dark:text-amber-400">No level ticked: the rule is never active.</p>
          )}
        </div>
      )}
    </div>
  );
}
