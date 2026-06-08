import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  /** Whether the signed-in user has favourited this item. */
  readonly isFavorite: boolean;
  /** Public favourite count across all users. Hidden when 0. */
  readonly count: number;
  /** True while a toggle is in flight — disables the control. */
  readonly pending?: boolean;
  /** Item name, used for the accessible label. */
  readonly label: string;
  readonly onToggle: () => void;
}

/**
 * Star toggle + public favourite count, shared by the runeword / gemword /
 * unique item cards. Always rendered (even signed out); the caller decides what
 * a click does (the favourites hook prompts sign-in when not authenticated).
 */
export function FavoriteButton({ isFavorite, count, pending = false, label, onToggle }: FavoriteButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 gap-1 px-2"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      disabled={pending}
      onClick={onToggle}
    >
      <Star className={cn('size-4', isFavorite && 'fill-amber-400 text-amber-500')} />
      {count > 0 && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Button>
  );
}
