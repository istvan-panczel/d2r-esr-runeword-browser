import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MythicalUnique } from '@/core/db';
import { ESR_BASE_URL } from '@/core/api';

interface MythicalUniqueCardProps {
  readonly item: MythicalUnique;
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

export function MythicalUniqueCard({ item }: MythicalUniqueCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg text-amber-700 dark:text-amber-400">{item.name}</CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary">{getCategoryDisplayName(item.category)}</Badge>
            <Badge variant="outline">Lvl {item.reqLevel}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{item.baseItem}</p>
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
                <li key={`special-${String(idx)}-${prop}`}>{prop}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Regular properties (blue) */}
        {item.properties.length > 0 && (
          <div className="text-center">
            <ul className="space-y-0.5 text-[#8080E6]">
              {item.properties.map((prop, idx) => (
                <li key={`${String(idx)}-${prop}`}>{prop}</li>
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
      </CardContent>
    </Card>
  );
}
