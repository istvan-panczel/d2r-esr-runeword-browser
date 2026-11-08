import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExternalLink } from '@/components/ExternalLink';
import { usePersistentState } from '@/core/hooks/usePersistentState';
import { AMBER_HEADING_CLASS, EXTERNAL_ICON_CLASS, LINK_CLASS } from '@/features/ascendancies/components/styles';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import type { MasteriesBundle } from '@/features/game-data/engine/schema';
import { specializationHref } from '@/features/game-data/engine/specializationLinks';
import { MASTERY_GUIDE_PATH } from '@/features/game-data/utils/masteries';
import { cubeFamilyHref } from '@/features/game-data/utils/materials';
import { officialDocsUrl } from '@/features/guide/engine/linkSchemes';

/** localStorage key of the panel's open state (per viewer; open by default) */
const OPEN_STORAGE_KEY = 'weaponMasteries.howToOpen';
/** The Cube page family of the awaken, apply and remove rows */
const CUBE_FAMILY = 'weapon-mastery';
/** The Thawing Potion's item code (three remove a mastery) */
const THAWING_POTION = 'wms';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function Step({ number, title, children }: { readonly number: number; readonly title: string; readonly children: ReactNode }) {
  return (
    <li className="min-w-0 space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
      <h3 className={AMBER_HEADING_CLASS}>
        {number}. {title}
      </h3>
      {children}
    </li>
  );
}

/**
 * How a mastery works: the four cube steps, the rules, the drop odds (the official page's) and True Master.
 * Collapsible, open by default.
 */
export function HowItWorks({ bundle }: { readonly bundle: MasteriesBundle }) {
  const [open, setOpen] = usePersistentState(OPEN_STORAGE_KEY, true, isBoolean);
  const headingId = useId();
  const bodyId = useId();
  const { pageRules, anyWeaponPerk, noRunewords, token, names } = bundle;
  const tokenName = names[token] ?? 'Weapon Mastery Token';
  const hasChance = pageRules.mapBossChance !== undefined || pageRules.zakarumChance !== undefined;

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
          How weapon mastery works
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="space-y-4 border-t px-4 pt-4 pb-4 sm:px-6 sm:pb-6">
        <ol className="grid gap-3 sm:grid-cols-2 @5xl/page:grid-cols-4">
          <Step number={1} title="Find a token">
            <p className="flex items-start gap-2">
              <ItemIcon item={{ kind: 'item', code: token }} size={28} />
              <span>
                A {tokenName} drops from endgame map bosses
                {pageRules.mapBossChance !== undefined && ` (${String(pageRules.mapBossChance)}%)`} and from Corrupted Zakarum
                {pageRules.zakarumChance !== undefined && ` (up to ${String(pageRules.zakarumChance)}%)`}.
                {hasChance && ' The chances are not scaled by /players (official page).'}
              </span>
            </p>
          </Step>
          <Step number={2} title="Awaken it">
            <p>
              Cube the token with a class weapon. The weapon does not change; you get an awakened token for that weapon. An awakened token
              cubed alone turns back into a plain token.
            </p>
          </Step>
          <Step number={3} title="Apply it">
            <p>
              Cube the weapon with its awakened token and the ingredients on its card below.
              {noRunewords && ' The weapon cannot be a runeword.'}
            </p>
          </Step>
          <Step number={4} title="Remove it">
            <p className="flex items-start gap-2">
              <ItemIcon item={{ kind: 'item', code: THAWING_POTION }} size={28} />
              <span>
                Cube the weapon with the item named on its card and 3 {names[THAWING_POTION] ?? 'Thawing Potion'}s. The mastery goes away
                and the token is lost.
              </span>
            </p>
          </Step>
        </ol>
        <section className="space-y-2 text-sm">
          <h3 className={AMBER_HEADING_CLASS}>Rules</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Masteries change how your skills work; they are not meant to add raw power.</li>
            <li>A weapon takes one mastery, on any tier: normal, exceptional, elite or mythical.</li>
            <li>Masteries do not stack when dual wielding, unless the text says so.</li>
            <li>Orb, Claw and Void Blade offer two masteries; the gem in the recipe picks which one you get.</li>
            {anyWeaponPerk !== undefined && (
              <li>
                With the {anyWeaponPerk.tree} perk{' '}
                <Link to={specializationHref(anyWeaponPerk.tree, anyWeaponPerk.title)} className={LINK_CLASS}>
                  {anyWeaponPerk.title}
                </Link>
                , any weapon can take any mastery.
              </li>
            )}
          </ul>
        </section>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link to={MASTERY_GUIDE_PATH} className={LINK_CLASS}>
            Guide: Weapon Mastery
          </Link>
          <Link to={cubeFamilyHref(CUBE_FAMILY)} className={LINK_CLASS}>
            All mastery cube recipes
          </Link>
          <ExternalLink href={officialDocsUrl('weapon_mastery.html')} className={LINK_CLASS} iconClassName={EXTERNAL_ICON_CLASS}>
            Official Weapon Mastery page
          </ExternalLink>
        </p>
      </div>
    </section>
  );
}
