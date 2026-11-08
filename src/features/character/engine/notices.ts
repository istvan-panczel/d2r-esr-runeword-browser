/** The banners of the My Character page: warnings that never block what could be read. */
import type { CharacterSidecar } from '../db/characterDb';
import type { CharacterSectionName } from '../parser/errors';
import type { CharacterIncomplete } from '../parser/types';
import type { SaveAge } from '../parser/saveAge';

export type NoticeTone = 'info' | 'warning';

export interface SaveNotice {
  readonly key: string;
  readonly tone: NoticeTone;
  readonly title: string;
  readonly text: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateText = (iso: string) => DATE_FORMAT.format(new Date(iso));

const SIDECAR_HINT = 'The save itself does not say which version wrote it; upload its .d2rl with it for the exact version.';

/** The save-age banner of `assessSaveAge`'s result. */
export function saveAgeNotice(age: SaveAge): SaveNotice {
  switch (age.status) {
    case 'same-version':
      return {
        key: 'age',
        tone: 'info',
        title: `Saved with ESR ${age.savedVersion}.`,
        text: `That is the version this site's data is for (read from the matching .d2rl).`,
      };
    case 'different-version':
      return {
        key: 'age',
        tone: 'warning',
        title: `Saved with ESR ${age.savedVersion}.`,
        text: `This site's data is for ESR ${age.bundleVersion}: names and computed text use the current tables, so older items can read differently from the game (read from the matching .d2rl).`,
      };
    case 'saved-before-release':
      return {
        key: 'age',
        tone: 'warning',
        title: `This save may be older than ESR ${age.bundleVersion}.`,
        text: `It was last saved before that version's release (${dateText(age.bundleDate)}). ${SIDECAR_HINT}`,
      };
    case 'saved-after-release':
      return {
        key: 'age',
        tone: 'info',
        title: `Last saved after ESR ${age.bundleVersion} came out.`,
        text: SIDECAR_HINT,
      };
    case 'unknown':
      return { key: 'age', tone: 'info', title: 'ESR version not known.', text: SIDECAR_HINT };
  }
}

/** The banner of a .d2rl that was uploaded but not used; null otherwise. */
export function sidecarNotice(sidecar: CharacterSidecar): SaveNotice | null {
  if (sidecar.status !== 'rejected') return null;
  return {
    key: 'sidecar',
    tone: 'info',
    title: `${sidecar.name} was not used.`,
    text:
      sidecar.reason === 'mismatch'
        ? 'It belongs to another save or an older copy of this one, so the save age comes from the last-saved date.'
        : 'It could not be read, so the save age comes from the last-saved date.',
  };
}

/** The parts after the player items, in file order, with what the page calls them */
const TAIL_PARTS: readonly (readonly [CharacterSectionName, string])[] = [
  ['corpses', 'corpse items'],
  ['merc-items', 'mercenary gear'],
  ['golem', 'golem item'],
  ['bound-demon', 'bound demon'],
  ['summons', 'saved summons'],
];

/** The bound demon is never stored or shown, so it cannot "stay empty" */
const EMPTY_LABELS: ReadonlySet<string> = new Set(['corpse items', 'mercenary gear', 'golem item', 'saved summons']);

function joinList(parts: readonly string[]): string {
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

/** The banner of a save the parser could read only partly: what could not be read and what stays empty. */
export function incompleteNotice(incomplete: CharacterIncomplete): SaveNotice {
  const index = TAIL_PARTS.findIndex(([section]) => section === incomplete.section);
  const label = index === -1 ? undefined : TAIL_PARTS[index]?.[1];
  const stopped = label === undefined ? 'part of the save' : `the ${label}`;
  const empty = index === -1 ? [] : TAIL_PARTS.slice(index).flatMap(([, label]) => (EMPTY_LABELS.has(label) ? [label] : []));
  const rest = empty.length === 0 ? '' : ` On this page, ${joinList(empty)} stay empty.`;
  return {
    key: 'incomplete',
    tone: 'warning',
    title: `Could not read ${stopped}.`,
    text: `No real save has shown this part of the format yet, so reading stopped there; the character and the player's items above it are complete.${rest}`,
  };
}

/** The banner of a save holding corpses: the gear may be on the corpse. Inferred: no real save with a corpse has been seen. */
export function corpseNotice(corpses: number): SaveNotice | null {
  if (corpses === 0) return null;
  return {
    key: 'corpse',
    tone: 'warning',
    title: corpses === 1 ? 'This character has a corpse.' : `This character has ${String(corpses)} corpses.`,
    text: 'The equipped gear may be on the corpse, so the slots below can be empty (a best guess: no real save with a corpse has been seen).',
  };
}
