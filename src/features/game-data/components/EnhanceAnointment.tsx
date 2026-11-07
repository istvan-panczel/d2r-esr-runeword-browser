import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { specializationHref } from '../engine/specializationLinks';
import { ANOINTMENT_EXTRA_POOLS, anointmentGroups, filterAnointmentOutcomes, qualityList } from '../utils/enhance';
import { BonusLines, NoMatches, Pills } from './EnhanceParts';
import { LIST_CARD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';
import { IngredientIcons } from './CellIcon';

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
  const groups = anointmentGroups(anointmentSlots);
  const group = groups.find((entry) => entry.group === slot?.group);
  const groupCount = (slots: readonly { slot: string }[]) => slots.reduce((sum, entry) => sum + count(entry.slot), 0);
  const vesselRecipe = vesselRecipes.find((recipe) => recipe.anointmentRolls !== undefined);
  // Socketed items roll a shorter range, so the last outcome(s) cannot roll on them
  const socketedMax = slot?.socketedRollRange ?? null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">Equipment</p>
        <Pills
          label="Equipment slot"
          value={group?.group ?? ''}
          onChange={(value) => {
            const first = groups.find((entry) => entry.group === value)?.slots[0];
            if (first !== undefined) onPool(first.slot);
          }}
          options={groups.map((entry) => ({ value: entry.group, label: entry.label, count: groupCount(entry.slots) }))}
        />
        {group !== undefined && group.slots.length > 1 && (
          <>
            <p className="pt-1 text-xs font-medium text-muted-foreground uppercase">{group.label}: item type</p>
            <Pills
              label={`${group.label} item type`}
              value={pool}
              onChange={onPool}
              options={group.slots.map((entry) => ({ value: entry.slot, label: entry.label, count: count(entry.slot) }))}
            />
          </>
        )}
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
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <IngredientIcons
              items={
                slot !== undefined
                  ? [
                      { kind: 'type', code: slot.typeCode },
                      { kind: 'item', code: anointment.reagent.code },
                    ]
                  : pool === 'charm'
                    ? [
                        { kind: 'type', code: 'char' },
                        ...anointment.charmReagents.map((reagent) => ({ kind: 'item' as const, code: reagent.code })),
                      ]
                    : [{ kind: 'unique', name: anointment.vesselItem }]
              }
            />
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
              <li>
                Each item type has its own pool; an item rolls the first pool its type belongs to, so class items use their class pool (an
                Amazon Javelin the Amazon Javelin pool, not the Javelin one).
              </li>
              <li>
                Cube the item with the orb, then cube the item again on its own. An item is anointed once
                {slot.secondPerk !== undefined && (
                  <>
                    ; with the {slot.secondPerk.tree} perk{' '}
                    <Link
                      to={specializationHref(slot.secondPerk.tree, slot.secondPerk.title)}
                      className="underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                    >
                      {slot.secondPerk.title}
                    </Link>
                    , a second time
                  </>
                )}
                .
              </li>
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
