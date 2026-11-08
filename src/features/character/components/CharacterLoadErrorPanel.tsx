import type { ReactNode } from 'react';
import { LoadErrorPanel, type LoadErrorRow } from '@/features/stash/components/shared/LoadErrorPanel';
import type { CharacterLoadError } from '../engine/readCharacter';
import type { CharacterParseErrorDetails } from '../parser/errors';

interface CharacterLoadErrorPanelProps {
  readonly error: CharacterLoadError;
  /** File name, for an error of a remembered file */
  readonly fileName?: string;
  readonly onDismiss?: () => void;
  readonly action?: ReactNode;
}

const TITLES: Readonly<Record<CharacterLoadError['kind'], string>> = {
  'wrong-type': 'Not a character save',
  parse: 'Could not read the save',
  storage: 'Could not read the remembered save',
  unexpected: 'Something went wrong',
};

function hint(error: CharacterLoadError): string | null {
  switch (error.kind) {
    case 'wrong-type':
      return null;
    case 'parse':
      return 'The file may be from an ESR version this page does not know, or it was saved while the game was writing it. Try again after leaving the game; if it keeps failing, please report it with the details below (they contain no item data).';
    case 'storage':
      return 'The browser storage could not be read (a private window or blocked site data). Upload the file again.';
    case 'unexpected':
      return 'Try uploading the file again.';
  }
}

/** The failure point: section, list position, bit and byte offsets, no item data */
function parseRows(details: CharacterParseErrorDetails): LoadErrorRow[] {
  const rows: LoadErrorRow[] = [['Section', details.section]];
  if (details.item !== null) rows.push(['Item', `${String(details.item + 1)} in the list (index ${String(details.item)})`]);
  if (details.path !== null) rows.push(['Path', details.path]);
  if (details.code !== null) rows.push(['Item code', details.code]);
  if (details.byteOffset !== null) rows.push(['Failed at byte', String(details.byteOffset)]);
  if (details.bitOffset !== null) rows.push(['Failed at bit', String(details.bitOffset)]);
  if (details.unverified !== null) rows.push(['Unverified part of the format', details.unverified]);
  return rows;
}

/** A failed upload or remembered save, in the My Stash error panel */
export function CharacterLoadErrorPanel({ error, fileName, onDismiss, action }: CharacterLoadErrorPanelProps) {
  return (
    <LoadErrorPanel
      title={TITLES[error.kind]}
      message={error.message}
      hint={hint(error)}
      fileName={fileName}
      onDismiss={onDismiss}
      action={action}
      details={error.kind === 'parse' ? parseRows(error.details) : null}
    />
  );
}
