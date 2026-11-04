/**
 * The top of the guide's spine screen (`/guide`): task-shaped entry cards and the strip of official docs pages.
 * Kept in code, not in content/guide: the cards mix note and app-page targets, and the docs strip is a fixed list of
 * official pages; both are checked by guideHome.test.ts (note slugs against the committed bundle, docs files against the
 * ESR clone).
 */
import { officialDocsUrl } from '../engine/linkSchemes';
import type { GuideBundle } from '../engine/schema';

export type StartCardId = 'found-item' | 'cube' | 'next' | 'best-base';

export type StartCardTarget = { readonly kind: 'note'; readonly slug: string } | { readonly kind: 'page'; readonly path: string };

export interface StartCard {
  readonly id: StartCardId;
  readonly question: string;
  readonly description: string;
  readonly target: StartCardTarget;
}

export const START_CARDS: readonly StartCard[] = [
  {
    id: 'found-item',
    question: 'I found an item, what is it?',
    description: 'Which ESR drops to keep, stock or sell, and where each one goes next.',
    target: { kind: 'note', slug: 'loot-triage' },
  },
  {
    id: 'cube',
    question: 'What can I make in the cube?',
    description: 'How ESR uses the Horadric Cube and why a recipe can silently fail.',
    target: { kind: 'note', slug: 'cube-basics' },
  },
  {
    id: 'next',
    question: 'Where do I go next?',
    description: 'What changes from vanilla D2R and how the five steps below lead to the endgame.',
    target: { kind: 'note', slug: 'start-here' },
  },
  {
    id: 'best-base',
    question: 'Which base for my runeword?',
    description: 'Pick a runeword and your stats to see the bases you can use, best first.',
    target: { kind: 'page', path: '/game-data/best-base' },
  },
];

/** App path of a card's target (note slugs become `/guide/<slug>`). */
export function startCardHref(target: StartCardTarget): string {
  return target.kind === 'note' ? `/guide/${target.slug}` : target.path;
}

/** The cards whose target exists: a card pointing at a note missing from the bundle is left out rather than shown broken. */
export function visibleStartCards(bundle: Pick<GuideBundle, 'notes'>, cards: readonly StartCard[] = START_CARDS): StartCard[] {
  const slugs = new Set(bundle.notes.map((note) => note.slug));
  return cards.filter((card) => card.target.kind === 'page' || slugs.has(card.target.slug));
}

export interface OfficialReference {
  readonly label: string;
  /** File name in the ESR repository's docs/ folder (served at the site root) */
  readonly file: string;
  readonly description: string;
}

/** The official ESR documentation pages, in reading order; the changelog last. */
export const OFFICIAL_REFERENCES: readonly OfficialReference[] = [
  {
    label: 'Cube Recipes',
    file: 'Eastern Sun Resurrected Cube Recipes.html',
    description: 'Every cube formula, as published by the mod author.',
  },
  {
    label: 'Maps',
    file: 'Eastern Sun Resurrected Maps.html',
    description: 'Special dungeons and areas, and where teleporting is blocked.',
  },
  { label: 'Endgame Maps', file: 'endgame_maps.htm', description: 'How to open map zones, the map tiers and their bosses.' },
  { label: 'Kill Ledger', file: 'kill_ledger.htm', description: 'The book that counts your kills: milestone and map boss bonuses.' },
  { label: 'Weapon Mastery', file: 'weapon_mastery.html', description: 'How a Weapon Mastery Token changes class weapons and skills.' },
  { label: 'Skill Information', file: 'skill_information.htm', description: "Every mercenary type's skills, and how oskills work." },
  {
    label: 'Ascendancies',
    file: 'ascendancies.htm',
    description: 'Ascendancy Stones: how to unlock them and the challenges that upgrade them.',
  },
  {
    label: 'Frame Table',
    file: 'ias-calculator.html',
    description: 'Attack and cast speed breakpoints (IAS and FCR) per class, shapeshift form, skill and weapon.',
  },
  {
    label: 'Changelog',
    file: 'changelogs.html',
    description: 'Release history up to 3.2.02 (August 2026); later patch notes are on the ESR GitHub.',
  },
];

export function officialReferenceHref(reference: OfficialReference): string {
  return officialDocsUrl(reference.file);
}
