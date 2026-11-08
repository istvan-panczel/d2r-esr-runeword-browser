import type { ReactNode } from 'react';
import type { MercenaryBand } from '@/features/game-data/engine/schema';
import {
  damageText,
  goldText,
  hasDexterityTypo,
  MERCENARY_DIFFICULTY_LABELS,
  resistsText,
  VANILLA_WEAPONS,
  VANILLA_WEAPONS_NOTE,
  type MercenaryTableRow,
} from '../utils/mercenariesView';
import { TYPO_MARK, TYPO_NOTE } from './MercenaryCard';
import { MercenarySkillName } from './MercenarySkillName';

const TABLE = 'w-full min-w-max border-collapse text-sm';
const TH = 'border-b px-2 py-1 text-left text-xs font-medium text-muted-foreground';
const TD = 'border-b border-border/50 px-2 py-1 align-top';

/** One line per level band, so the numbers of a row line up across its stat columns */
function BandLines({ bands, value }: { readonly bands: readonly MercenaryBand[]; readonly value: (band: MercenaryBand) => ReactNode }) {
  return (
    <ul className="tabular-nums">
      {bands.map((band) => (
        <li key={band.level}>{value(band)}</li>
      ))}
    </ul>
  );
}

const dexterityText = (band: MercenaryBand) => (band.dexterityTypo === true ? `${String(band.dexterity)}${TYPO_MARK}` : band.dexterity);

/** One row per variant; a row's level bands stack inside its cells */
export function MercenaryTable({ rows }: { readonly rows: readonly MercenaryTableRow[] }) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Hireling</th>
              <th className={TH}>Gold (file value)</th>
              <th className={TH}>Weapons</th>
              <th className={TH}>Level</th>
              <th className={TH}>Life</th>
              <th className={TH}>Defense</th>
              <th className={TH}>Str</th>
              <th className={TH}>Dex</th>
              <th className={TH}>AR</th>
              <th className={TH}>Damage</th>
              <th className={TH}>Resists</th>
              <th className={TH}>Skills (level per band)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className={TD}>
                  <div className="font-medium">{row.hireling.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.type.name} · {row.difficulty === null ? 'all difficulties' : MERCENARY_DIFFICULTY_LABELS[row.difficulty]} · Act{' '}
                    {row.hireling.act}
                  </div>
                </td>
                <td className={TD}>
                  <ul className="tabular-nums">
                    {row.view.gold.map(({ difficulty, gold }) => (
                      <li key={difficulty}>
                        {row.view.gold.length > 1 && (
                          <span className="text-xs text-muted-foreground">{MERCENARY_DIFFICULTY_LABELS[difficulty]}: </span>
                        )}
                        {goldText(gold)}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={`${TD} max-w-24 whitespace-normal`}>{VANILLA_WEAPONS[row.hireling.slug]}</td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={(band) => band.level} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={(band) => band.life} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={(band) => band.defense} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={(band) => band.strength} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={dexterityText} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={(band) => band.attackRating} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={damageText} />
                </td>
                <td className={TD}>
                  <BandLines bands={row.view.bands} value={resistsText} />
                </td>
                <td className={TD}>
                  <ul className="space-y-0.5">
                    {row.view.skills.map((skill) => (
                      <li key={skill.id} className="flex items-center justify-between gap-3">
                        <MercenarySkillName skill={skill} />
                        <span className="text-muted-foreground tabular-nums">{skill.levels.join(' / ')}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Weapons column: {VANILLA_WEAPONS_NOTE}.</p>
      {rows.some((row) => hasDexterityTypo(row.view.bands)) && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {TYPO_MARK} Dexterity {TYPO_NOTE}.
        </p>
      )}
    </div>
  );
}
