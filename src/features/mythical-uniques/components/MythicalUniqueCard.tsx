import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MythicalUnique } from '@/core/db';
import { ESR_BASE_URL } from '@/core/api';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { ItemSourceLine } from '@/features/game-data/components/ItemSourceLine';
import type { SourceIndex } from '@/features/game-data/engine/sourceLookup';
import { SkillRefText } from '@/features/skills/components/SkillRefText';

interface MythicalUniqueCardProps {
  readonly item: MythicalUnique;
  /** Name index of the game-data sources bundle (from `useItemSources()`); omitted → no source line */
  readonly sourceIndex?: SourceIndex | null;
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'Mythical Unique Weapons': 'Weapons',
  'Mythical Unique Armor': 'Armor',
  'Mythical Unique Jewelry': 'Jewelry',
  'Dedicated Drops Mythical Uniques': 'Dedicated Drops',
};

function getCategoryDisplayName(category: string): string {
  return CATEGORY_DISPLAY_NAMES[category] ?? category;
}

function resolveImageUrl(relativeUrl: string): string {
  // Convert "./images/..." to absolute URL
  return `${ESR_BASE_URL}/${relativeUrl.replace(/^\.\//, '')}`;
}

export function MythicalUniqueCard({ item, sourceIndex }: MythicalUniqueCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {/* The site's own picture (below) already shows the art; the icon covers mythicals without one */}
            {!item.imageUrl && <ItemIcon item={{ kind: 'unique', name: item.name }} size={48} className="rounded-md bg-muted/50" />}
            <div className="min-w-0 space-y-1">
              <CardTitle className="break-words text-lg text-amber-700 dark:text-amber-400">{item.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{item.baseItem}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Badge variant="secondary">{getCategoryDisplayName(item.category)}</Badge>
            <Badge variant="outline">Lvl {item.reqLevel}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Item image */}
        {item.imageUrl && (
          <div className="flex justify-center">
            <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="max-h-24 object-contain" loading="lazy" />
          </div>
        )}

        {/* Special properties (orange/amber) */}
        {item.specialProperties.length > 0 && (
          <div className="text-center">
            <ul className="space-y-0.5 text-amber-500 dark:text-amber-300">
              {item.specialProperties.map((prop, idx) => (
                <li key={`special-${String(idx)}-${prop}`}>
                  <SkillRefText line={prop} item={{ kind: 'unique', name: item.name }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Regular properties (blue) */}
        {item.properties.length > 0 && (
          <div className="text-center">
            <ul className="space-y-0.5 text-[#8080E6]">
              {item.properties.map((prop, idx) => (
                <li key={`${String(idx)}-${prop}`}>
                  <SkillRefText line={prop} item={{ kind: 'unique', name: item.name }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {item.notes.length > 0 && (
          <div className="text-center border-t pt-2">
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {item.notes.map((note, idx) => (
                <li key={`note-${String(idx)}-${note}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <ItemSourceLine index={sourceIndex} name={item.name} kind="unique" />
      </CardContent>
    </Card>
  );
}
