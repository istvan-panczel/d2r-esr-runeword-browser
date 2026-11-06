import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RuneBadge } from './RuneBadge';
import { GemBadge } from '@/core/components/GemBadge';
import { RunewordPointsDisplay } from './RunewordPointsDisplay';
import { RunewordSocketRow } from './RunewordSocketRow';
import { hasJewelSlots } from '../utils/socketSlots';
import { FavoriteButton } from '@/core/components/FavoriteButton';
import { SocketableLookupScope } from '@/core/components/SocketableLookupScope';
import { useSocketableLookup } from '@/core/hooks/useSocketableLookup';
import { aggregateBonusTexts, resolveRune } from '@/core/utils/socketableLookup';
import { RecipeAffixes, SocketableBonusesSection } from '@/core/components/RecipeBonuses';
import { getRelevantCategories } from '@/core/utils/itemCategoryMapping';
import { isGemName } from '@/features/data-sync/parsers/gemsParser';
import { runewordIsLod } from '@/features/data-sync/parsers/runewordsParser';
import type { Runeword } from '@/core/db/models';

/** Best Base finder link (game-data feature; plain path so the runewords chunk does not import it). */
function bestBasePath(runeword: Pick<Runeword, 'name' | 'variant'>): string {
  return `/game-data/best-base?${new URLSearchParams({ rw: runeword.name, v: String(runeword.variant) }).toString()}`;
}

interface RunewordCardProps {
  readonly runeword: Runeword;
  readonly isFavorite?: boolean;
  readonly favoriteCount?: number;
  readonly favoritePending?: boolean;
  readonly onToggleFavorite?: (runeword: Runeword) => void;
}

export function RunewordCard(props: RunewordCardProps) {
  // Reuses the screen-level rune/gem lookup, or loads one when rendered on its own (e.g. builds)
  return (
    <SocketableLookupScope>
      <RunewordCardContent {...props} />
    </SocketableLookupScope>
  );
}

function RunewordCardContent({
  runeword,
  isFavorite = false,
  favoriteCount = 0,
  favoritePending = false,
  onToggleFavorite,
}: RunewordCardProps) {
  const { name, sockets, runes, allowedItems, excludedItems, affixes, tierPointTotals } = runeword;
  // Handle backwards compatibility for cached runewords without reqLevel
  const reqLevel = 'reqLevel' in runeword ? runeword.reqLevel : undefined;
  const isLod = runewordIsLod(runeword);
  const gems = 'gems' in runeword ? runeword.gems : undefined;
  const jewelInfo = 'jewelInfo' in runeword ? runeword.jewelInfo : undefined;
  // Recipes with optional jewels show a socket range on the ESR site, e.g. "(2-3 Socket)"
  const socketsMax = 'socketsMax' in runeword ? runeword.socketsMax : undefined;
  const socketLabel = socketsMax === undefined ? String(sockets) : `${String(sockets)}-${String(socketsMax)}`;
  const ingredientsList = 'ingredients' in runeword && runeword.ingredients.length > 0 ? runeword.ingredients : runes;
  const lookup = useSocketableLookup();
  const runeBonuses = lookup
    ? aggregateBonusTexts([
        ...runes.flatMap((rune) => resolveRune(lookup, rune, isLod)?.rune.bonuses ?? []),
        ...(gems ?? []).flatMap((gem) => lookup.gems.get(gem)?.bonuses ?? []),
      ])
    : undefined;
  const relevantCategories = getRelevantCategories(allowedItems);

  // Old cached runewords may lack per-column affixes
  const columnAffixes = 'columnAffixes' in runeword ? runeword.columnAffixes : undefined;

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-lg text-amber-700 dark:text-amber-400">{name}</CardTitle>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              to={bestBasePath(runeword)}
              className="inline-flex h-8 items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Find best base"
              aria-label={`Find best base for ${name}`}
            >
              <Hammer className="size-4" />
            </Link>
            {onToggleFavorite && (
              <FavoriteButton
                isFavorite={isFavorite}
                count={favoriteCount}
                pending={favoritePending}
                label={name}
                onToggle={() => {
                  onToggleFavorite(runeword);
                }}
              />
            )}
            <Badge variant="secondary">{socketLabel} Socket</Badge>
            {reqLevel !== undefined && <Badge variant="outline">Lvl {reqLevel}</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {/* Required and optional jewel sockets, then the sockets with the ingredient icons */}
          <RunewordSocketRow runeword={runeword} isLod={isLod} />

          {/* Jewels first (as in the sockets and on the site), then the runes + gems in original order */}
          <div className="flex flex-wrap gap-1">
            {jewelInfo && <Badge variant="outline">{jewelInfo}</Badge>}
            {ingredientsList.map((item, index) =>
              isGemName(item) ? (
                <GemBadge key={`${item}-${String(index)}`} gemName={item} />
              ) : (
                <RuneBadge key={`${item}-${String(index)}`} runeName={item} isLod={isLod} />
              )
            )}
          </div>

          {/* ESR has a runes.txt row per jewel count, each with plain Jewels (jew) and with Mythical Jewels (mjw) */}
          {hasJewelSlots(runeword) && (
            <p className="text-xs text-muted-foreground">Jewels or Mythical Jewels (not mixed); jewels go in the first sockets.</p>
          )}
        </div>

        {/* Tier point totals - check with 'in' for backwards compatibility with old cached data */}
        {'tierPointTotals' in runeword && tierPointTotals.length > 0 && <RunewordPointsDisplay tierTotals={tierPointTotals} />}

        {/* Allowed items */}
        <div>
          <p className="font-medium text-muted-foreground mb-1">Items:</p>
          <p className="text-sm">{allowedItems.join(', ')}</p>
          {excludedItems.length > 0 && <p className="text-sm text-muted-foreground mt-1">Excluded: {excludedItems.join(', ')}</p>}
        </div>

        <RecipeAffixes
          affixes={affixes}
          columnAffixes={columnAffixes}
          allowedItems={allowedItems}
          categories={relevantCategories}
          skillItem={{ kind: 'runeword', name }}
        />

        <SocketableBonusesSection
          title="Socketable Bonuses:"
          bonuses={runeBonuses}
          allowedItems={allowedItems}
          categories={relevantCategories}
        />
      </CardContent>
    </Card>
  );
}
