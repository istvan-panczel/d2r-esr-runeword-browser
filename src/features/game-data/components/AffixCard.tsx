import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Affix } from '../engine/schema';
import { AFFIX_KIND_LABELS } from '../constants/affixes';
import { affixDisplayName, affixTypeNames, formatAffixLevel, formatWeight } from '../utils/filterAffixes';
import { SkillRefText } from '@/features/skills/components/SkillRefText';

const KIND_BADGE_CLASS: Record<Affix['kind'], string> = {
  p: 'border-sky-600/50 text-sky-700 dark:text-sky-400',
  s: 'border-emerald-600/50 text-emerald-700 dark:text-emerald-400',
  a: 'border-purple-600/50 text-purple-700 dark:text-purple-400',
};

interface AffixCardProps {
  readonly affix: Affix;
  readonly typeNames: ReadonlyMap<string, string>;
  readonly classNames: ReadonlyMap<string, string>;
  /** Chance within its kind (what-can-roll mode) */
  readonly weight?: number;
}

export function AffixCard({ affix, typeNames, classNames, weight }: AffixCardProps) {
  const types = affixTypeNames(affix, typeNames);
  const className = (code: string) => classNames.get(code) ?? code;
  const meta = [
    formatAffixLevel(affix),
    `req lvl ${String(affix.reqLvl)}`,
    affix.reqCls !== null && `${className(affix.reqCls)} req lvl ${String(affix.clsReqLvl)}`,
    `group ${String(affix.group)}`,
    `freq ${String(affix.freq)}`,
  ].filter(Boolean);

  return (
    <Card className="h-full gap-2 py-3">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-base">{affixDisplayName(affix)}</CardTitle>
          {weight !== undefined && (
            <span className="shrink-0 font-mono text-sm" title="Chance among the eligible affixes of this kind">
              {formatWeight(weight)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Badge variant="outline" className={KIND_BADGE_CLASS[affix.kind]}>
            {AFFIX_KIND_LABELS[affix.kind]}
          </Badge>
          {affix.rare && <Badge variant="outline">Rare</Badge>}
          {affix.cls !== null && <Badge variant="secondary">{className(affix.cls)} only</Badge>}
          <span>{meta.join(' · ')}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5 px-4 text-sm">
        <ul className="space-y-0.5 text-blue-700 dark:text-blue-400">
          {affix.text.map((line, index) => (
            // Lines can repeat (e.g. identical stats on several mods); the index keeps keys unique
            <li key={`${String(index)}-${line}`}>
              <SkillRefText line={line} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Can appear on: {types.on.join(', ') || 'nothing'}
          {types.except.length > 0 && `; except ${types.except.join(', ')}`}
        </p>
      </CardContent>
    </Card>
  );
}
