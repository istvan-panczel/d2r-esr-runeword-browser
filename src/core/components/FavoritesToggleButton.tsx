import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FavoritesToggleButtonProps {
  readonly favoriteCount: number;
  readonly showFavoritesOnly: boolean;
  readonly onToggle: () => void;
}

/** "Favorites only" list toggle shared by the recipe screens. */
export function FavoritesToggleButton({ favoriteCount, showFavoritesOnly, onToggle }: FavoritesToggleButtonProps) {
  return (
    <Button
      type="button"
      variant={showFavoritesOnly ? 'default' : 'outline'}
      size="sm"
      disabled={favoriteCount === 0 && !showFavoritesOnly}
      onClick={onToggle}
    >
      <Star className={cn('size-4', showFavoritesOnly && 'fill-current')} />
      Favorites only
      {favoriteCount > 0 && <span className="text-xs opacity-80">({favoriteCount})</span>}
    </Button>
  );
}
