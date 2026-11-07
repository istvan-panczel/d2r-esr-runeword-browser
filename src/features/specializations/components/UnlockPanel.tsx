import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExternalLink } from '@/components/ExternalLink';
import { usePersistentState } from '@/core/hooks/usePersistentState';
import { AMBER_HEADING_CLASS, EXTERNAL_ICON_CLASS, LINK_CLASS } from '@/features/ascendancies/components/styles';
import { campaignMapAreaPath } from '@/features/campaign-map/utils/urlState';
import type { SpecializationRules } from '@/features/game-data/engine/schema';
import { cubeFamilyHref } from '@/features/game-data/utils/materials';
import { officialDocsUrl } from '@/features/guide/engine/linkSchemes';
import { percentText, SPECIALIZATIONS_GUIDE_PATH, tokenPointsByLevel } from '../utils/specializationsView';

/** localStorage key of the panel's open state (per viewer; open by default) */
const OPEN_STORAGE_KEY = 'specializations.howToOpen';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

const listText = (values: readonly number[]) =>
  values.length <= 1 ? values.join('') : `${values.slice(0, -1).join(', ')} and ${String(values.at(-1))}`;

/**
 * "How to unlock and respec": the Mystical Shard → Tesseract recipe, the points by level, who drops the shards, the
 * one-tree and one-perk-per-row rules and the unlearn cost, all from specializations.json `rules`. Collapsible, open
 * by default.
 */
export function UnlockPanel({ rules }: { readonly rules: SpecializationRules }) {
  const [open, setOpen] = usePersistentState(OPEN_STORAGE_KEY, true, isBoolean);
  const headingId = useId();
  const bodyId = useId();
  const { shard, token, respecToken } = rules;
  const bands = tokenPointsByLevel(rules);

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card shadow-sm">
      <h2 id={headingId}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-semibold hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-6"
        >
          <ChevronRight className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
          How to unlock and respec
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="space-y-6 border-t px-4 pt-4 pb-4 sm:px-6 sm:pb-6">
        <div className="grid gap-6 @5xl/page:grid-cols-2">
          <section className="min-w-0 space-y-3 text-sm">
            <h3 className={AMBER_HEADING_CLASS}>Unlock</h3>
            <p>
              Transmute{' '}
              <strong>
                {token.shards ?? 'the'} {shard.name}s
              </strong>{' '}
              in the Horadric Cube to make a <strong>{token.name}</strong>
              {token.family !== undefined && (
                <>
                  {' '}
                  (
                  <Link to={cubeFamilyHref(token.family)} className={LINK_CLASS}>
                    recipe
                  </Link>
                  )
                </>
              )}
              . Using it unlocks specializations and gives {rules.unlockPoints} point
              {rules.unlockPoints === 1 ? '' : 's'}; one more point comes at each of the character levels {listText(rules.pointLevels)}, up
              to {rules.maxPoints} in all. Used later, the {token.name} also gives the points of the levels already passed:
            </p>
            <table className="text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 pr-4 font-medium">
                    Used at level
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band.from} className="border-t">
                    <td className="py-1 pr-4">{band.to === null ? `${String(band.from)}+` : `${String(band.from)}–${String(band.to)}`}</td>
                    <td className="py-1">{band.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rules.shardsOnlyBeforeUnlock && (
              <p className="text-muted-foreground">
                {shard.name}s only drop for a character that has not used a {token.name} yet.
              </p>
            )}
          </section>
          {rules.shardDrops.length > 0 && (
            <section className="min-w-0 space-y-3 text-sm">
              <h3 className={AMBER_HEADING_CLASS}>Who drops the {shard.name}s</h3>
              <p className="text-muted-foreground">Chance per kill (one player), from the treasure classes.</p>
              <ul className="space-y-1">
                {rules.shardDrops.map((drop) => (
                  <li key={drop.name} className="flex flex-wrap items-baseline gap-x-2 border-t pt-1">
                    <span className="font-medium">{drop.name}</span>
                    <span className="tabular-nums">{percentText(drop.chance)}</span>
                    {drop.areas !== undefined && (
                      <span className="text-muted-foreground">
                        {drop.areas.map((area, i) => (
                          <span key={area.id}>
                            {i > 0 && ', '}
                            <Link to={campaignMapAreaPath(area.id)} className={LINK_CLASS}>
                              {area.name}
                            </Link>
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <section className="space-y-2 text-sm">
          <h3 className={AMBER_HEADING_CLASS}>Perks and respec</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Each point learns one perk. The first perk you learn picks the specialization: the other trees stay locked.</li>
            <li>Each row of a tree holds {rules.perksPerRow} perks and you learn one of them: one point per row.</li>
            {rules.unlearnCost !== undefined && (
              <li>
                Shift + click a learned perk to unlearn it: it costs {rules.unlearnCost} respec points
                {respecToken !== undefined && (
                  <>
                    {' '}
                    ({rules.unlearnCost} {respecToken.name}s
                    {respecToken.recipe !== undefined && (
                      <>
                        , {respecToken.recipe.qty} {respecToken.recipe.name}s each: {rules.unlearnCost * respecToken.recipe.qty}{' '}
                        {respecToken.recipe.name}s
                      </>
                    )}
                    )
                  </>
                )}{' '}
                and gives the point back. To switch trees, unlearn every perk of the old one first.
              </li>
            )}
          </ul>
        </section>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link to={SPECIALIZATIONS_GUIDE_PATH} className={LINK_CLASS}>
            Guide: Specializations
          </Link>
          <ExternalLink href={officialDocsUrl('specializations.htm')} className={LINK_CLASS} iconClassName={EXTERNAL_ICON_CLASS}>
            Official Specializations page
          </ExternalLink>
        </p>
      </div>
    </section>
  );
}
