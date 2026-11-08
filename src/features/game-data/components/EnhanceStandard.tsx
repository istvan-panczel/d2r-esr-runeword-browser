import { Link } from 'react-router-dom';
import { ExternalLink } from '@/components/ExternalLink';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DROP_FINDER_URL } from '@/core/navigation/navConfig';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { STANDARD_CUBE_HREF, filterStandardOutcomes } from '../utils/enhance';
import { CellIcon, IngredientIcons } from './CellIcon';
import { BonusLines, NoMatches } from './EnhanceParts';
import { LIST_CARD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';

const LINK_CLASS = 'text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

interface EnhanceStandardProps {
  readonly bundle: EnhanceBundle;
  readonly search: string;
}

export function EnhanceStandard({ bundle, search }: EnhanceStandardProps) {
  const { standardOfHeroes, standardOfHeroesOutcomes: all } = bundle;
  const outcomes = filterStandardOutcomes(all, search);
  const { reagent } = standardOfHeroes;

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <IngredientIcons
              items={[
                { kind: 'type', code: 'char' },
                { kind: 'item', code: reagent.code },
              ]}
            />
            Unique Charm + {reagent.name}
          </CardTitle>
          <p className="text-sm">{all.length} unique charms, one fixed bonus each: no roll table and no brick rows.</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 text-sm text-muted-foreground">
          <p>
            Cube a unique charm with {reagent.name}: the charm keeps its stats and adds the bonus listed for it.
            {standardOfHeroes.once && ' A charm can only be upgraded once.'}
          </p>
          <p>
            ESR&apos;s configs say the uber bosses (Uber Mephisto, Uber Diablo, Uber Baal) drop it; the{' '}
            <ExternalLink href={DROP_FINDER_URL} className={LINK_CLASS} iconClassName="ml-0.5 inline size-[0.9em] align-[-0.1em]">
              Drop Finder
            </ExternalLink>{' '}
            may show no rows for it.
          </p>
          <p>
            <Link to={STANDARD_CUBE_HREF} className={LINK_CLASS}>
              These recipes on the Cube Recipes page
            </Link>
          </p>
        </CardContent>
      </Card>

      {search !== '' && (
        <p className="text-sm text-muted-foreground">
          {outcomes.length} of {all.length} charms match
        </p>
      )}
      {outcomes.length === 0 ? (
        <NoMatches />
      ) : (
        <ul className={cn('divide-y', LIST_CARD_CLASS, ROW_LIST_COLUMNS)}>
          {outcomes.map((outcome) => (
            <li key={outcome.charm.code} className="flex flex-col gap-1.5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-4">
              <div className="flex shrink-0 items-center gap-1.5 font-medium sm:w-80">
                <CellIcon item={{ kind: 'unique', name: outcome.charm.name }} />
                <span className="min-w-0">{outcome.charm.name}</span>
              </div>
              <BonusLines lines={outcome.lines} className="min-w-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
