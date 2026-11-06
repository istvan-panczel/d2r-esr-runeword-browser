import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { ANOINTMENT_EXTRA_POOLS, filterAnointmentOutcomes, qualityList } from '../utils/enhance';
import { BonusLines, NoMatches, Pills } from './EnhanceParts';
import { LIST_CARD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';

interface EnhanceAnointmentProps {
  readonly bundle: EnhanceBundle;
  readonly pool: string;
  readonly search: string;
  readonly onPool: (pool: string) => void;
}

export function EnhanceAnointment({ bundle, pool, search, onPool }: EnhanceAnointmentProps) {
  const { anointment, anointmentSlots, vesselRecipes } = bundle;
  const count = (name: string) => bundle.anointmentOutcomes.filter((outcome) => outcome.pool === name).length;
  const all = bundle.anointmentOutcomes.filter((outcome) => outcome.pool === pool);
  const outcomes = filterAnointmentOutcomes(all, search);
  const slot = anointmentSlots.find((entry) => entry.slot === pool);
  const vesselRecipe = vesselRecipes.find((recipe) => recipe.anointmentRolls !== undefined);
  // Socketed items roll a shorter range, so the last outcome(s) cannot roll on them
  const socketedMax = slot?.socketedRollRange ?? null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">Equipment</p>
        <Pills
          label="Equipment slot"
          value={pool}
          onChange={onPool}
          options={anointmentSlots.map((entry) => ({ value: entry.slot, label: entry.label, count: count(entry.slot) }))}
        />
        <p className="pt-1 text-xs font-medium text-muted-foreground uppercase">Other pools</p>
        <Pills
          label="Other anointment pools"
          value={pool}
          onChange={onPool}
          options={ANOINTMENT_EXTRA_POOLS.map((entry) => ({ value: entry.pool, label: entry.label, count: count(entry.pool) }))}
        />
      </div>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">
            {slot !== undefined && `${slot.label} + ${anointment.reagent.name}`}
            {pool === 'charm' && `Unique Charm + ${anointment.charmReagents.map((reagent) => reagent.name).join(' + ')}`}
            {pool === 'vessel' && `${anointment.vesselItem} (tier 4 recipe)`}
          </CardTitle>
          <p className="text-sm">{all.length} outcomes, one per roll; every roll is a success (no brick rows).</p>
        </CardHeader>
        <CardContent className="space-y-1 px-4 text-sm text-muted-foreground">
          {slot !== undefined && (
            <ul className="list-disc space-y-0.5 pl-5">
              {anointment.blockedQualities.length > 0 && <li>Not on {qualityList(anointment.blockedQualities)} items.</li>}
              {anointment.noRunewords && <li>Not on runewords.</li>}
              {socketedMax !== null && socketedMax < slot.rollRange && (
                <li>
                  Socketed items roll 1–{socketedMax} of {slot.rollRange}, so they cannot get the last{' '}
                  {slot.rollRange - socketedMax === 1 ? 'outcome' : `${String(slot.rollRange - socketedMax)} outcomes`} (marked below).
                </li>
              )}
              <li>Cube the item with the orb, then cube the item again on its own. An item is anointed once.</li>
            </ul>
          )}
          {pool === 'charm' && <p>Cube the unique charm with the three organs, then cube the charm again on its own.</p>}
          {pool === 'vessel' && (
            <p>
              The Vessel's tier 4 anointment recipe ({vesselRecipe?.materials.map((material) => material.name).join(' + ')},{' '}
              {vesselRecipe?.soulCost} souls) rolls one of these {vesselRecipe?.anointmentRolls ?? all.length}.
            </p>
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
          {outcomes.map((outcome) => {
            const notSocketed = socketedMax !== null && outcome.roll > socketedMax;
            return (
              <li key={outcome.roll} className="flex gap-3 px-3 py-2 text-sm">
                <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground" title="Roll">
                  #{outcome.roll}
                </span>
                <div className="min-w-0 space-y-0.5">
                  {(outcome.label !== undefined || notSocketed) && (
                    <p className="text-xs text-muted-foreground">
                      {outcome.label}
                      {notSocketed && <span className="ml-2 rounded border px-1">not on socketed items</span>}
                    </p>
                  )}
                  <BonusLines lines={outcome.lines} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
