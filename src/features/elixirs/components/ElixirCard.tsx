import { Link } from 'react-router-dom';
import { Clock, FlaskConical, Hammer, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import type { ElixirInfo, ElixirPerk } from '@/features/game-data/engine/schema';
import { elixirHref, materialsHref, oddsText, perkHref, type ElixirValues } from '../utils/elixirsView';

const BADGE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-tight';
const LINK = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

/** Name colours: the game's potion white for regular elixirs, gold for greater ones, orange for the special one */
const NAME_CLASS: Record<ElixirInfo['variant'], string> = {
  regular: 'text-foreground',
  greater: 'text-amber-700 dark:text-amber-300',
  special: 'text-orange-700 dark:text-orange-400',
};

export function PerkLink({ perk }: { readonly perk: ElixirPerk }) {
  return (
    <Link to={perkHref(perk)} className={LINK} title={`${perk.tree} perk (row ${String(perk.row)}): ${perk.description}`}>
      {perk.title}
    </Link>
  );
}

interface ElixirCardProps {
  readonly elixir: ElixirInfo;
  readonly values: ElixirValues;
  readonly maxLevel: number;
  /** Chance among elixir drops with the chosen perks; null when no treasure class drops it */
  readonly chance: number | null;
  readonly perks: ReadonlyMap<string, ElixirPerk>;
  readonly pairName: string | null;
  readonly pairSlug: string | null;
  readonly highlighted: boolean;
}

export function ElixirCard({ elixir, values, maxLevel, chance, perks, pairName, pairSlug, highlighted }: ElixirCardProps) {
  const dropPerks = (elixir.dropPerks ?? []).flatMap((key) => perks.get(key) ?? []);
  const ownPerk = elixir.perk === undefined ? undefined : perks.get(elixir.perk);
  return (
    <Card id={elixir.slug} className={cn('gap-0 overflow-hidden py-0', highlighted && 'ring-2 ring-amber-500/60')} aria-label={elixir.name}>
      <div className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3">
        <ItemIcon item={{ kind: 'item', code: elixir.code }} size={40} className="rounded-md bg-muted/60" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className={cn('leading-tight font-semibold', NAME_CLASS[elixir.variant])}>
            <Link to={elixirHref(elixir.slug)} className="hover:underline">
              {elixir.name}
            </Link>
          </h3>
          <div className="flex flex-wrap gap-1">
            {elixir.variant === 'greater' && (
              <span className={cn(BADGE, 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300')}>Greater</span>
            )}
            {elixir.variant === 'special' && (
              <span className={cn(BADGE, 'border-orange-500/50 bg-orange-500/10 text-orange-800 dark:text-orange-300')}>Special</span>
            )}
            {elixir.dropPerks?.length === 0 && (
              <span className={cn(BADGE, 'border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300')}>
                Drops for everyone
              </span>
            )}
            {values.seconds !== null && (
              <span className={cn(BADGE, 'text-muted-foreground')} title="Effect length">
                <Clock className="size-3" aria-hidden />
                {values.seconds} s
              </span>
            )}
            <span className={cn(BADGE, 'font-mono text-muted-foreground')} title="Item code">
              {elixir.code}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="text-muted-foreground italic">{values.tooltip}</p>

        {values.lines.length > 0 && (
          <ul className="space-y-1">
            {values.lines.map((line, index) => (
              <li key={`${line.text}-${String(index)}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-blue-700 dark:text-sky-300">{line.text}</span>
                {line.range !== null && (
                  <span className="text-xs text-muted-foreground tabular-nums" title={`At character level 1 and ${String(maxLevel)}`}>
                    lvl 1: {line.range[0]} · lvl {maxLevel}: {line.range[1]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <dl className="space-y-1.5 text-xs">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">Drops</dt>
            <dd className="min-w-0">
              {elixir.dropPerks === undefined ? (
                <span>Never drops.</span>
              ) : chance === null || chance <= 0 ? (
                <span>Not with the perks chosen above.</span>
              ) : (
                <span>
                  {oddsText(chance)} of the elixirs that drop
                  {dropPerks.length > 0 && (
                    <>
                      {' '}
                      · needs{' '}
                      {dropPerks.map((perk, index) => (
                        <span key={perk.key}>
                          {index > 0 && ' and '}
                          <PerkLink perk={perk} />
                        </span>
                      ))}
                    </>
                  )}
                </span>
              )}
            </dd>
          </div>
          {ownPerk !== undefined && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">
                <Sparkles className="mr-1 inline size-3" aria-hidden />
                Perk
              </dt>
              <dd className="min-w-0">
                Comes with the {ownPerk.tree} perk <PerkLink perk={ownPerk} />
                {elixir.recipes === undefined && ': no cube recipe in the game files makes it (see the perk below).'}
              </dd>
            </div>
          )}
          {elixir.recipes !== undefined && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">
                <Hammer className="mr-1 inline size-3" aria-hidden />
                Cube
              </dt>
              <dd className="min-w-0">
                <a href="#elixir-recipes" className={LINK}>
                  {elixir.recipes.length === 1 ? 'One recipe' : `${String(elixir.recipes.length)} recipes`}
                </a>{' '}
                can make it (a random {elixir.variant} elixir).
              </dd>
            </div>
          )}
          {elixir.usageCondition !== undefined && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">Use</dt>
              <dd className="min-w-0">Only while its effect is not running and its cooldown is over.</dd>
            </div>
          )}
          {pairName !== null && pairSlug !== null && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">
                <FlaskConical className="mr-1 inline size-3" aria-hidden />
                {elixir.variant === 'greater' ? 'Regular' : 'Greater'}
              </dt>
              <dd className="min-w-0">
                <Link to={elixirHref(pairSlug)} className={LINK}>
                  {pairName}
                </Link>{' '}
                <span className="text-muted-foreground" title={`states.txt ${elixir.state}`}>
                  (runs as the same effect, state {elixir.state})
                </span>
              </dd>
            </div>
          )}
        </dl>

        <p className="text-xs">
          <Link to={materialsHref(elixir.name)} className={LINK}>
            On the Materials page
          </Link>
        </p>
      </div>
    </Card>
  );
}
