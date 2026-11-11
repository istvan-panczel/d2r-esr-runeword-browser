import type { ReactNode } from 'react';
import { Calculator } from 'lucide-react';
import type { CharacterFile } from '../parser/types';

interface ComputedSheetPanelProps {
  readonly character: CharacterFile;
  /**
   * SEAM for the stats engine: the computed totals (final attributes, life, mana, resistances, …) of `character`, rendered
   * by the engine's own component. Omitted until the engine is wired: the panel then shows a short "coming" state.
   */
  readonly totals?: ReactNode;
}

/** The Overview's computed character sheet: totals with gear, skills and bonuses applied, which the save itself does not store. */
export function ComputedSheetPanel({ character, totals }: ComputedSheetPanelProps) {
  return (
    <section aria-labelledby="character-computed" className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 id="character-computed" className="mb-2 font-semibold">
        Totals with gear
      </h3>
      {totals ?? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Calculator className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Coming soon: {character.name}&apos;s final attributes, life, mana and resistances with gear, skills and bonuses counted. The
            save stores only the base values shown here.
          </span>
        </p>
      )}
    </section>
  );
}
