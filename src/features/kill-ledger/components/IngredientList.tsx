import { CellIcon } from '@/features/game-data/components/CellIcon';
import type { KillLedgerIngredient } from '@/features/game-data/engine/schema';
import { ingredientIcon, ingredientText } from '../utils/killLedgerView';

/** The items of a transmute, one per line with its icon */
export function IngredientList({ ingredients }: { readonly ingredients: readonly KillLedgerIngredient[] }) {
  return (
    <ul className="space-y-1">
      {ingredients.map((ingredient) => (
        <li key={ingredient.name} className="flex items-center gap-1.5">
          <CellIcon item={ingredientIcon(ingredient)} />
          <span>{ingredientText(ingredient)}</span>
        </li>
      ))}
    </ul>
  );
}
