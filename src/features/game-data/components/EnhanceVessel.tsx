import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { VESSEL_COMPLETION, filterVesselRecipes, filterVesselTransforms, materialText } from '../utils/enhance';
import { BonusLines, NoMatches, Pills } from './EnhanceParts';
import { LIST_CARD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';

interface EnhanceVesselProps {
  readonly bundle: EnhanceBundle;
  readonly tier: string;
  readonly search: string;
  readonly onTier: (tier: string) => void;
}

const VESSEL_ANOINTMENTS_LINK = `/game-data/enhance?${GAME_DATA_URL_PARAM_KEYS.TAB}=anointment&${GAME_DATA_URL_PARAM_KEYS.SLOT}=vessel`;

export function EnhanceVessel({ bundle, tier, search, onTier }: EnhanceVesselProps) {
  const { vessel, vesselTiers, vesselRecipes, vesselTransforms } = bundle;
  const tierInfo = vesselTiers.find((entry) => String(entry.tier) === tier);
  const options = [
    ...vesselTiers.map((entry) => ({
      value: String(entry.tier),
      label: `Tier ${String(entry.tier)}`,
      count: vesselRecipes.filter((recipe) => recipe.tier === entry.tier).length,
    })),
    { value: VESSEL_COMPLETION, label: 'Completion', count: vesselTransforms.length },
  ];

  return (
    <div className="space-y-4">
      <Pills label="Vessel tier" value={tier} onChange={onTier} options={options} />
      <p className="text-sm text-muted-foreground">
        The {vessel.item} starts with {vessel.startSouls} souls. Each recipe spends souls; a tier is done when its souls are used up, and
        the next tier only opens then. At 0 souls it can be turned into a mythical weapon.
      </p>
      {tierInfo !== undefined ? (
        <VesselTierList bundle={bundle} tier={tierInfo.tier} search={search} />
      ) : (
        <VesselCompletion transforms={vesselTransforms} item={vessel.item} search={search} />
      )}
    </div>
  );
}

function VesselTierList({ bundle, tier, search }: { readonly bundle: EnhanceBundle; readonly tier: number; readonly search: string }) {
  const info = bundle.vesselTiers.find((entry) => entry.tier === tier);
  const all = bundle.vesselRecipes.filter((recipe) => recipe.tier === tier);
  const recipes = filterVesselRecipes(all, search);
  const costs = [...new Set(all.map((recipe) => recipe.soulCost))].sort((a, b) => a - b);
  if (info === undefined) return null;

  return (
    <div className="space-y-3">
      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">
            Tier {tier}: {info.startSouls} → {info.endSouls} souls
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {all.length} recipes costing {costs.join(', ')} souls. Every recipe is the {bundle.vessel.item} plus the materials listed;
            {all.some((recipe) => recipe.maxTimes !== undefined) && ' some bonuses can only be taken a limited number of times;'} the last
            use of the tier must leave exactly {info.endSouls} souls.
          </p>
        </CardHeader>
      </Card>

      {search !== '' && (
        <p className="text-sm text-muted-foreground">
          {recipes.length} of {all.length} recipes match
        </p>
      )}
      {recipes.length === 0 ? (
        <NoMatches />
      ) : (
        <ul className={cn('divide-y', LIST_CARD_CLASS, ROW_LIST_COLUMNS)}>
          {recipes.map((recipe) => (
            <li
              key={`${recipe.materials.map(materialText).join('+')}|${recipe.lines.join('|')}`}
              className="flex flex-col gap-1.5 px-3 py-2 text-sm sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:w-72">
                <Badge variant="secondary" title="Souls spent">
                  {recipe.soulCost} souls
                </Badge>
                {recipe.maxTimes !== undefined && (
                  <Badge variant="outline" title="From the recipe's cap row">
                    max {recipe.maxTimes}×
                  </Badge>
                )}
                <span className="text-muted-foreground">{recipe.materials.map(materialText).join(' + ')}</span>
              </div>
              <div className="min-w-0">
                {recipe.anointmentRolls !== undefined ? (
                  <p>
                    Rolls one of the{' '}
                    <Link to={VESSEL_ANOINTMENTS_LINK} className="text-primary underline underline-offset-2">
                      {recipe.anointmentRolls} Vessel of Souls anointments
                    </Link>
                  </p>
                ) : (
                  <BonusLines lines={recipe.lines} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface VesselCompletionProps {
  readonly transforms: EnhanceBundle['vesselTransforms'];
  readonly item: string;
  readonly search: string;
}

function VesselCompletion({ transforms, item, search }: VesselCompletionProps) {
  const shown = filterVesselTransforms(transforms, search);
  return (
    <div className="space-y-3">
      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Completion: 0 souls</CardTitle>
          <p className="text-sm text-muted-foreground">
            {transforms.length} transforms: the {item} plus three Blemished gems turns into the mythical weapon the gems pick
            {transforms.every((transform) => transform.keepsMods) && ', keeping its Vessel bonuses'}.
          </p>
        </CardHeader>
      </Card>
      {shown.length === 0 ? (
        <NoMatches />
      ) : (
        <ul className={cn('divide-y', LIST_CARD_CLASS, ROW_LIST_COLUMNS)}>
          {shown.map((transform) => (
            <li key={transform.output.code} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:gap-4">
              <span className="text-muted-foreground sm:w-72 sm:shrink-0">{transform.materials.map(materialText).join(' + ')}</span>
              <span className="font-medium">→ {transform.output.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
