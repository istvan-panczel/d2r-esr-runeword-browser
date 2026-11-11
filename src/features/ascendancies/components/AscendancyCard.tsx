import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Ascendancy } from '@/core/db';
import { ESR_BASE_URL } from '@/core/api';
import { SkillRefText } from '@/features/skills/components/SkillRefText';

interface AscendancyCardProps {
  readonly item: Ascendancy;
}

function resolveImageUrl(relativeUrl: string): string {
  return `${ESR_BASE_URL}/${relativeUrl.replace(/^\.\//, '')}`;
}

export function AscendancyCard({ item }: AscendancyCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        {/* Image */}
        {item.imageUrl && (
          <div className="flex justify-center mb-2">
            <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="max-h-32 object-contain" loading="lazy" />
          </div>
        )}

        <CardTitle className="text-lg text-amber-700 dark:text-amber-400 text-center">{item.name} Ascendancy</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Tiers */}
        {item.tiers.map((tier) => (
          <div key={tier.tier} className="text-center">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">Tier {tier.tier}</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {tier.bonuses.map((bonus, idx) => (
                <li key={`${String(tier.tier)}-${String(idx)}`}>
                  <SkillRefText line={bonus} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Footnotes */}
        {item.footnotes.length > 0 && (
          <div className="border-t pt-2">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {item.footnotes.map((fn, idx) => (
                <li key={`fn-${String(idx)}`}>{fn}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
