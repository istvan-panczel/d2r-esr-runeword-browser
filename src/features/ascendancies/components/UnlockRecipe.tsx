import { Fragment } from 'react';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { splitCount } from '../utils/recipes';
import { AMBER_HEADING_CLASS } from './styles';

/** Side of the gem icons in the unlock line, in px */
const GEM_ICON_SIZE = 16;

interface UnlockRecipeProps {
  /** The Tier 1 Challenge inputs, e.g. ["Orb of Creation", "2 Blemished Sapphire", "2 Blemished Obsidian"] */
  readonly inputs: readonly string[];
}

/** "Unlock: Orb of Creation + 2 Blemished Sapphire + 2 Blemished Obsidian", the gems with their small icon */
export function UnlockRecipe({ inputs }: UnlockRecipeProps) {
  return (
    <p className="text-center text-sm">
      <span className={AMBER_HEADING_CLASS}>Unlock:</span>{' '}
      {inputs.map((input, index) => {
        const { name } = splitCount(input);
        return (
          <Fragment key={`${String(index)}-${input}`}>
            {index > 0 && <span className="text-muted-foreground"> + </span>}
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap align-middle">
              {name.startsWith('Blemished ') && <ItemIcon item={{ kind: 'misc', name }} size={GEM_ICON_SIZE} />}
              {input}
            </span>
          </Fragment>
        );
      })}
    </p>
  );
}
