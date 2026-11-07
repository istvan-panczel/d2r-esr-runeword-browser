import { Link } from 'react-router-dom';
import { Compass, FlaskConical, PackageSearch, Shield, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuideBundle } from '../engine/schema';
import { startCardHref, visibleStartCards, type StartCardId } from '../utils/guideHome';
import { FOCUS_RING, GUIDE_PROSE_FONT } from './styles';

const CARD_ICONS: Record<StartCardId, LucideIcon> = {
  'found-item': PackageSearch,
  cube: FlaskConical,
  next: Compass,
  'best-base': Shield,
};

interface GuideStartCardsProps {
  readonly bundle: GuideBundle;
}

/**
 * NOT RENDERED (kept on purpose, 2026-11-07): `/guide` became a single overview of every note, without entry cards.
 *
 * Task-shaped entry cards that sat at the top of `/guide`: the questions new players arrive with, each linked to a note or page. */
export function GuideStartCards({ bundle }: GuideStartCardsProps) {
  const cards = visibleStartCards(bundle);
  if (cards.length === 0) return null;

  return (
    <nav aria-label="Common questions">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.id];
          return (
            <li key={card.id} className="flex">
              <Link
                to={startCardHref(card.target)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/40',
                  FOCUS_RING
                )}
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-semibold">{card.question}</span>
                  <span className={cn('mt-0.5 block text-sm text-muted-foreground', GUIDE_PROSE_FONT)}>{card.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
