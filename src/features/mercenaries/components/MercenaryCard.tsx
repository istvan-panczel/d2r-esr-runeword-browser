import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LINK_CLASS } from '@/features/ascendancies/components/styles';
import type { MercenaryBand } from '@/features/game-data/engine/schema';
import { setFocusParams } from '@/features/game-data/utils/sets';
import {
  damageText,
  goldText,
  hasDexterityTypo,
  HIRELING_SETS,
  resistsText,
  VANILLA_WEAPONS,
  VANILLA_WEAPONS_NOTE,
  type MercenaryCardEntry,
} from '../utils/mercenariesView';
import { MercenarySkillName } from './MercenarySkillName';

/** Marks a value that looks like an ESR typo; the note under the card or table explains it */
export const TYPO_MARK = '*';
export const TYPO_NOTE = 'looks like an ESR typo: the other Desert Mercenaries reach 158 at level 85';

const TH = 'px-2 py-1 text-right text-xs font-medium text-muted-foreground';
const LABEL = 'py-1 pr-2 text-left text-xs font-medium text-muted-foreground';
const CELL = 'px-2 py-1 text-right tabular-nums';

interface StatRow {
  readonly label: string;
  readonly value: (band: MercenaryBand) => ReactNode;
}

const STAT_ROWS: readonly StatRow[] = [
  { label: 'Life', value: (band) => band.life },
  { label: 'Defense', value: (band) => band.defense },
  { label: 'Strength', value: (band) => band.strength },
  {
    label: 'Dexterity',
    value: (band) => (band.dexterityTypo === true ? `${String(band.dexterity)}${TYPO_MARK}` : band.dexterity),
  },
  { label: 'Attack rating', value: (band) => band.attackRating },
  { label: 'Damage', value: damageText },
  { label: 'Resists', value: resistsText },
];

/** One hireling and type at the chosen difficulty: gold, weapons, then stats and skill levels with one column per band */
export function MercenaryCard({ entry }: { readonly entry: MercenaryCardEntry }) {
  const { hireling, type, view } = entry;
  const weapons = VANILLA_WEAPONS[hireling.slug];
  const setName = HIRELING_SETS[hireling.slug];
  return (
    <article className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {hireling.name} <span className="font-normal text-muted-foreground">· {type.name}</span>
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground">Act {hireling.act}</span>
      </header>

      {view === null ? (
        <p className="text-muted-foreground">Not offered at this difficulty.</p>
      ) : (
        <>
          <p>
            <span className="text-muted-foreground">Gold (file value): </span>
            <span className="tabular-nums">{view.gold.map(({ gold }) => goldText(gold)).join(' / ')}</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={LABEL}>
                    Level
                  </th>
                  {view.bands.map((band) => (
                    <th key={band.level} scope="col" className={TH}>
                      {band.level}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-border/50">
                    <th scope="row" className={LABEL}>
                      {row.label}
                    </th>
                    {view.bands.map((band) => (
                      <td key={band.level} className={CELL}>
                        {row.value(band)}
                      </td>
                    ))}
                  </tr>
                ))}
                {view.skills.map((skill) => (
                  <tr key={skill.id} className="border-t border-border/50">
                    <th scope="row" className="py-1 pr-2 text-left font-normal">
                      <MercenarySkillName skill={skill} />
                    </th>
                    {view.bands.map((band, index) => (
                      <td key={band.level} className={CELL}>
                        {skill.levels.at(index)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasDexterityTypo(view.bands) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {TYPO_MARK} Dexterity {TYPO_NOTE}.
            </p>
          )}
        </>
      )}

      {weapons !== undefined && (
        <p>
          <span className="text-muted-foreground">Weapons: </span>
          {weapons} <span className="text-xs text-muted-foreground italic">({VANILLA_WEAPONS_NOTE})</span>
        </p>
      )}
      {setName !== undefined && (
        <p>
          <span className="text-muted-foreground">Set: </span>
          <Link to={`/sets?${setFocusParams({ name: setName }).toString()}`} className={LINK_CLASS}>
            {setName}
          </Link>
        </p>
      )}
    </article>
  );
}
