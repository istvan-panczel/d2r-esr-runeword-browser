import { Swords } from 'lucide-react';
import type { CharacterFile } from '../../parser/types';

/**
 * SEAM for the combat pass: the Combat tab. Today a short empty state; the monster hit-chance chart (features/character/
 * combat/) replaces the body of this component and gets the character from its props.
 */
export function CombatTab({ character }: { readonly character: CharacterFile }) {
  return (
    <section
      aria-labelledby="character-combat"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-10 text-center"
    >
      <Swords className="size-8 text-muted-foreground" aria-hidden />
      <h3 id="character-combat" className="font-semibold">
        Combat is coming
      </h3>
      <p className="max-w-prose text-sm text-muted-foreground">
        This tab will show how often {character.name} hits the monsters of each area and difficulty, from the attack rating and the
        monsters&apos; defense at your level. It needs the totals with gear, which the save does not store, so it arrives with them.
      </p>
    </section>
  );
}
