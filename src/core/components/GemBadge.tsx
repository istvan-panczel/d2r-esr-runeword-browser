import { useLiveQuery } from 'dexie-react-hooks';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { db } from '@/core/db';
import { GemTooltip } from './GemTooltip';
import { GEM_BG_COLORS } from '../constants/gemColors';

interface GemBadgeProps {
  readonly gemName: string;
}

export function GemBadge({ gemName }: GemBadgeProps) {
  const gem = useLiveQuery(() => db.gems.get(gemName), [gemName]);

  const bgColorClass = gem ? (GEM_BG_COLORS[gem.color] ?? '') : '';

  return (
    <GemTooltip gemName={gemName}>
      <Badge variant="outline" className={cn('cursor-pointer opacity-100 hover:opacity-75', bgColorClass)}>
        {gemName}
      </Badge>
    </GemTooltip>
  );
}
