import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RuneBadge } from './RuneBadge';
import type { Runeword } from '@/core/db/models';

interface RunewordCardProps {
  readonly runeword: Runeword;
}

export function RunewordCard({ runeword }: RunewordCardProps) {
  const { name, sockets, runes, allowedItems, excludedItems, affixes } = runeword;

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg text-amber-700 dark:text-amber-400">{name}</CardTitle>
          <Badge variant="secondary">{sockets} Socket</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Rune sequence */}
        <div className="flex flex-wrap gap-1">
          {runes.map((rune, index) => (
            <RuneBadge key={`${rune}-${String(index)}`} runeName={rune} />
          ))}
        </div>

        {/* Allowed items */}
        <div>
          <p className="font-medium text-muted-foreground mb-1">Items:</p>
          <p className="text-sm">{allowedItems.join(', ')}</p>
          {excludedItems.length > 0 && <p className="text-sm text-muted-foreground mt-1">Excluded: {excludedItems.join(', ')}</p>}
        </div>

        {/* Affixes */}
        {affixes.length > 0 && (
          <div className="text-center">
            <p className="font-medium text-muted-foreground mb-1">Bonuses:</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {affixes.map((affix, index) => (
                <li key={`${String(index)}-${affix.rawText}`}>{affix.rawText}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
