import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { brickSummary, filterCorruptionOutcomes, formatRate, missingQualities, qualityList } from '../utils/enhance';
import { BonusLines, ComputedRate, NoMatches, Pills } from './EnhanceParts';
import { LIST_CARD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';
import { IngredientIcons } from './CellIcon';

interface EnhanceCorruptionProps {
  readonly bundle: EnhanceBundle;
  readonly slot: string;
  readonly search: string;
  readonly onSlot: (slot: string) => void;
}

export function EnhanceCorruption({ bundle, slot: slotId, search, onSlot }: EnhanceCorruptionProps) {
  const { corruption, corruptionSlots } = bundle;
  const slot = corruptionSlots.find((entry) => entry.slot === slotId) ?? corruptionSlots.at(0);
  if (slot === undefined) return null;
  const all = bundle.corruptionOutcomes.filter((outcome) => outcome.slot === slot.slot);
  const outcomes = filterCorruptionOutcomes(all, search);
  const brick = brickSummary(slot.brick.results);
  const missing = missingQualities(slot);

  return (
    <div className="space-y-4">
      <Pills
        label="Item slot"
        value={slot.slot}
        onChange={onSlot}
        options={corruptionSlots.map((entry) => ({ value: entry.slot, label: entry.label, count: entry.outcomes }))}
      />

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <IngredientIcons
              items={[
                { kind: 'type', code: slot.typeCode },
                { kind: 'item', code: corruption.reagent.code },
              ]}
            />
            {slot.label} + {corruption.reagent.name}
          </CardTitle>
          <p className="text-sm">
            {slot.outcomes} outcomes ·{' '}
            <ComputedRate>
              {formatRate(slot.successRate)} success, {formatRate(slot.brick.rate)} brick
            </ComputedRate>{' '}
            → {brick.main}
            {brick.exceptions.length > 0 && ` (${brick.exceptions.join('; ')})`}
          </p>
        </CardHeader>
        <CardContent className="space-y-1 px-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Corruptible:</span> {qualityList(slot.qualities)}.
            {missing.length > 0 && ` No recipe rows for ${qualityList(missing)}.`}
          </p>
          {slot.rollOnlyQualities.length > 0 && (
            <p>
              {qualityList(slot.rollOnlyQualities)}: the shard roll row exists, but there are no outcome rows for it, so the item is stuck
              with a pending roll.
            </p>
          )}
          <p>
            Cube the item with the shard, then cube the item again on its own: one of {slot.rollRange} rolls picks an outcome below or a
            brick.
          </p>
          {corruption.notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5">
              {corruption.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {search !== '' && (
        <p className="text-sm text-muted-foreground">
          {outcomes.length} of {all.length} outcomes match
        </p>
      )}
      {outcomes.length === 0 ? (
        <NoMatches />
      ) : (
        <ol className={cn('divide-y', LIST_CARD_CLASS, ROW_LIST_COLUMNS)}>
          {outcomes.map((outcome) => (
            <li key={outcome.roll} className="flex gap-3 px-3 py-2 text-sm">
              <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground" title="Roll">
                #{outcome.roll}
              </span>
              <div className="min-w-0 space-y-1">
                <BonusLines lines={outcome.lines} />
                {outcome.variants?.map((variant) => (
                  <div key={variant.qualities.join(',')} className="text-xs text-muted-foreground">
                    <span>{qualityList(variant.qualities)}: </span>
                    <span className="text-blue-700 dark:text-blue-400">{variant.lines.join(', ')}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
