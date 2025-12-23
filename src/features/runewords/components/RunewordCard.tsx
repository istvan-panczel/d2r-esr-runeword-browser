import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RuneBadge } from './RuneBadge';
import type { Runeword } from '@/core/db/models';

interface RunewordCardProps {
  readonly runeword: Runeword;
}

export function RunewordCard({ runeword }: RunewordCardProps) {
  const { name, sockets, runes, allowedItems, affixes } = runeword;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-[#908858]">{name}</CardTitle>
          <Badge variant="secondary">{sockets} Socket</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Rune sequence */}
        <div className="flex flex-wrap gap-1">
          {runes.map((rune, index) => (
            <RuneBadge key={`${rune}-${String(index)}`} runeName={rune} />
          ))}
        </div>

        {/* Allowed items */}
        <div>
          <p className="font-medium text-muted-foreground mb-1">Items:</p>
          <p className="text-xs">{allowedItems.join(', ')}</p>
        </div>

        {/* Affixes */}
        {affixes.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Bonuses:</p>
            <ul className="space-y-0.5 text-xs">
              {affixes.map((affix) => (
                <li key={affix.rawText}>{affix.rawText}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
