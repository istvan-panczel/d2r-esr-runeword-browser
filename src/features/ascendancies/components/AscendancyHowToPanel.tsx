import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AscendancyChallenge, AscendancySection } from '@/core/db';
import { ESR_BASE_URL } from '@/core/api';
import { DROP_FINDER_URL } from '@/core/navigation/navConfig';
import { usePersistentState } from '@/core/hooks/usePersistentState';
import { ExternalLink } from '@/components/ExternalLink';
import { campaignMapAreaPath } from '@/features/campaign-map/utils/urlState';
import { cubeFamilyHref } from '@/features/game-data/utils/materials';
import { ASCENDANCY_CUBE_FAMILY, ORB_LOCATIONS, ORB_OF_CREATION } from '../data/orbLocations';
import { useAscendancyChallenges } from '../hooks/useAscendancyChallenges';
import { useAscendancySections } from '../hooks/useAscendancySections';
import { findDropFinderTerm } from '../utils/dropFinder';
import { DropFinderLink, DropFinderText } from './DropFinderText';
import { AMBER_HEADING_CLASS, LINK_CLASS } from './styles';

/** localStorage key of the panel's open state (per viewer; open by default) */
const OPEN_STORAGE_KEY = 'ascendancies.howToOpen';
const OFFICIAL_CHALLENGES_URL = `${ESR_BASE_URL}/ascendancies.htm#challenge`;

const MORE_LINK_CLASS = 'inline-flex items-center gap-1.5 text-primary hover:underline';
const CHIP_CLASS = 'rounded border bg-muted/50 px-1.5 py-0.5 text-xs';
/** Below the `page` container's @3xl step (768 px) the orb table stacks one orb per block (literal classes for Tailwind) */
const ORB_CELL_CLASS = '@3xl/page:table-cell @3xl/page:py-2 @3xl/page:pr-3';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * "How to unlock an ascendancy and its tiers": a fixed summary (since ESR 3.3.04 the Orb of Creation unlocks the
 * ascendancy panel and the later tiers unlock on the kills, no stone or cube recipe), where the five orbs drop (a
 * static, in-game checked table), the Tier 1–5 challenges and the other sections (the Lich King Bonus) parsed from the
 * official page. Collapsible, open by default; when the page had no readable challenge section only the summary, the
 * orb part and the links show.
 */
export function AscendancyHowToPanel() {
  const challenges = useAscendancyChallenges();
  const sections = useAscendancySections();
  const [open, setOpen] = usePersistentState(OPEN_STORAGE_KEY, true, isBoolean);
  const headingId = useId();
  const bodyId = useId();

  return (
    <section aria-labelledby={headingId} className="mb-6 rounded-xl border bg-card shadow-sm">
      <h2 id={headingId}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-semibold hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6"
        >
          <ChevronRight className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
          How to unlock an ascendancy and its tiers
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="space-y-6 border-t px-4 pt-4 pb-4 sm:px-6 sm:pb-6">
        <p className="text-sm">
          Cube the five orbs into an <span className="font-medium">{ORB_OF_CREATION}</span>, use it to unlock the ascendancy panel on the
          character sheet and pick an ascendancy there. Tiers 2–5 then unlock by themselves when you finish their challenges, in any order:
          there is no stone and nothing to cube.
        </p>
        <div className="grid gap-6 @8xl/page:grid-cols-2">
          <OrbLocations />
          {(challenges.length > 0 || sections.length > 0) && (
            <div className="min-w-0 space-y-6">
              {challenges.length > 0 && <TierSteps challenges={challenges} />}
              {sections.map((section) => (
                <PageSection key={section.title} section={section} />
              ))}
            </div>
          )}
        </div>
        <PanelLinks />
      </div>
    </section>
  );
}

function OrbLocations() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3">
      <h3 id={headingId} className={AMBER_HEADING_CLASS}>
        Orb locations (Hell)
      </h3>
      <p className="text-sm text-muted-foreground">
        Each elemental orb drops from one superunique on Hell. The official page does not say where; these spots were checked in game.
      </p>
      <table className="block w-full text-sm @3xl/page:table">
        <thead className="hidden text-left text-xs text-muted-foreground @3xl/page:table-header-group">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">
              Orb
            </th>
            <th scope="col" className="py-1 pr-3 font-medium">
              Act
            </th>
            <th scope="col" className="py-1 pr-3 font-medium">
              Area
            </th>
            <th scope="col" className="py-1 pr-3 font-medium">
              Where
            </th>
            <th scope="col" className="py-1 font-medium">
              Superunique
            </th>
          </tr>
        </thead>
        <tbody className="block @3xl/page:table-row-group">
          {ORB_LOCATIONS.map((location) => (
            <tr key={location.orb} className="block border-t py-2 @3xl/page:table-row @3xl/page:py-0">
              <th scope="row" className={cn('block text-left font-medium', ORB_CELL_CLASS)}>
                <DropFinderLink>{location.orb}</DropFinderLink>
              </th>
              <td className={cn('inline', ORB_CELL_CLASS)}>
                Act {location.act}
                <span className="@3xl/page:hidden" aria-hidden>
                  {' · '}
                </span>
              </td>
              <td className={cn('inline', ORB_CELL_CLASS)}>
                <Link to={campaignMapAreaPath(location.areaId)} className={LINK_CLASS}>
                  {location.area}
                </Link>
              </td>
              <td className={cn('block text-muted-foreground @3xl/page:text-foreground', ORB_CELL_CLASS)}>{location.where}</td>
              <td className="block @3xl/page:table-cell @3xl/page:py-2">
                <span className="text-muted-foreground @3xl/page:hidden">Superunique: </span>
                {location.superunique}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        <span>Cube the five orbs together</span>
        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">gives</span>
        <span className={cn(CHIP_CLASS, 'font-medium')}>{ORB_OF_CREATION}</span>
      </p>
    </section>
  );
}

function TierSteps({ challenges }: { readonly challenges: readonly AscendancyChallenge[] }) {
  const headingId = useId();
  const first = challenges[0].tier;
  const last = challenges[challenges.length - 1].tier;
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3">
      <h3 id={headingId} className={AMBER_HEADING_CLASS}>
        {first === last ? `Tier ${String(first)}` : `Tiers ${String(first)}–${String(last)}`}
      </h3>
      <ol className="space-y-4">
        {challenges.map((challenge) => (
          <TierStep key={challenge.tier} challenge={challenge} />
        ))}
      </ol>
    </section>
  );
}

function TierStep({ challenge }: { readonly challenge: AscendancyChallenge }) {
  const linkAt = challenge.description.findIndex((paragraph) => findDropFinderTerm(paragraph) !== null);
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-600/40 text-sm font-semibold text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
        <span className="sr-only">Tier </span>
        {challenge.tier}
      </span>
      <div className="min-w-0 space-y-1.5 text-sm">
        {challenge.description.map((paragraph, index) => (
          <p key={`${String(challenge.tier)}-${String(index)}`}>
            <DropFinderText text={paragraph} link={index === linkAt} />
          </p>
        ))}
      </div>
    </li>
  );
}

/** Another section of the page's challenge part, e.g. the Lich King Bonus, under its own heading */
function PageSection({ section }: { readonly section: AscendancySection }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-1.5 text-sm">
      <h3 id={headingId} className={AMBER_HEADING_CLASS}>
        {section.title}
      </h3>
      {section.description.map((paragraph, index) => (
        <p key={`${section.title}-${String(index)}`}>{paragraph}</p>
      ))}
    </section>
  );
}

function PanelLinks() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-sm">
      <li>
        <ExternalLink href={OFFICIAL_CHALLENGES_URL} className={MORE_LINK_CLASS} iconClassName="size-3.5">
          Official docs
        </ExternalLink>
      </li>
      <li>
        <ExternalLink href={DROP_FINDER_URL} className={MORE_LINK_CLASS} iconClassName="size-3.5">
          Drop Finder (official)
        </ExternalLink>
      </li>
      <li>
        <Link to={cubeFamilyHref(ASCENDANCY_CUBE_FAMILY)} className={MORE_LINK_CLASS}>
          <ArrowRight className="size-3.5" aria-hidden />
          Cube recipe
        </Link>
      </li>
    </ul>
  );
}
