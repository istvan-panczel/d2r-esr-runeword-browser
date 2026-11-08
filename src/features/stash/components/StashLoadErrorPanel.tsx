import type { ReactNode } from 'react';
import { LoadErrorPanel, type LoadErrorRow } from './shared/LoadErrorPanel';
import { STASH_FILE_NAME, type StashLoadError } from '../engine/readStash';
import type { StashParseErrorDetails } from '../parser/errors';

interface StashLoadErrorPanelProps {
  readonly error: StashLoadError;
  /** File name, for an error of a remembered file */
  readonly fileName?: string;
  readonly onDismiss?: () => void;
  /** Shown under the message, e.g. "Forget stored file" */
  readonly action?: ReactNode;
}

const TITLES: Readonly<Record<StashLoadError['kind'], string>> = {
  'wrong-type': 'Not a shared stash file',
  unsupported: 'This stash file is not supported',
  parse: 'Could not read the stash',
  storage: 'Could not read the remembered stash',
  unexpected: 'Something went wrong',
};

/** What to do next; null when the message already says it (a wrong file type, the legacy stash) */
function hint(error: StashLoadError): string | null {
  switch (error.kind) {
    case 'wrong-type':
      return null;
    case 'unsupported':
      return error.reason === 'legacy'
        ? null
        : `Upload ${STASH_FILE_NAME} from the ESR save folder (the stash ESR saves through D2RLoader).`;
    case 'parse':
      return 'The file may be from a newer ESR version than this page knows, or it was saved while the game was writing it. Try again after leaving the game; if it keeps failing, please report it with the details below (they contain no item data).';
    case 'storage':
      return 'The browser storage could not be read (a private window or blocked site data). Upload the file again.';
    case 'unexpected':
      return 'Try uploading the file again.';
  }
}

/** ESR's stash has 1000 pages (sections 0–999), then the materials tab and the Chronicle tab */
const PAGE_SECTIONS = 1000;

/** "12 (page 13)", "1000 (materials tab)" */
function sectionLabel(section: number): string {
  if (section < PAGE_SECTIONS) return `${String(section)} (page ${String(section + 1)})`;
  if (section === PAGE_SECTIONS) return `${String(section)} (materials tab)`;
  return section === PAGE_SECTIONS + 1 ? `${String(section)} (Chronicle tab)` : String(section);
}

function parseRows(details: StashParseErrorDetails): LoadErrorRow[] {
  const rows: LoadErrorRow[] = [];
  if (details.section !== null) rows.push(['Section', sectionLabel(details.section)]);
  if (details.item !== null) rows.push(['Item', `${String(details.item + 1)} in the section's list (index ${String(details.item)})`]);
  if (details.path !== null) rows.push(['Path', details.path]);
  if (details.code !== null) rows.push(['Item code', details.code]);
  if (details.itemBitOffset !== null) rows.push(['Item starts at bit', String(details.itemBitOffset)]);
  rows.push(['Failed at bit', `${String(details.bitOffset)} (byte ${String(Math.floor(details.bitOffset / 8))})`]);
  return rows;
}

/** A failed upload or remembered file: what went wrong, what to do, and the parser's position for a parse error. */
export function StashLoadErrorPanel({ error, fileName, onDismiss, action }: StashLoadErrorPanelProps) {
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
