/**
 * Is a save older than the bundles? The .d2s carries no ESR version (0x44520005 is the save-format revision), so the
 * answer is the sidecar's version when the user gave a matching one, else a day-level guess from the last-saved time
 * against the bundle's ESR release date (manifest.esrDate). A guess misses someone who stayed on an old install past a
 * release. Either way this only feeds a warning: an old save is never rejected.
 */
export interface SaveAgeInput {
  /** Character `lastSavedAt` (Unix seconds) */
  lastSavedAt: number;
  /** The sidecar, when one was given and verified against this save with d2rlMatchesSave */
  sidecarVersion: string | null;
  /** The bundle's ESR version (manifest.esrVersion) */
  bundleVersion: string;
  /** The ESR release date of the bundle (manifest.esrDate, ISO 8601); null or missing on older manifests */
  bundleDate: string | null | undefined;
}

export type SaveAge =
  | { status: 'same-version'; source: 'sidecar'; savedVersion: string; bundleVersion: string }
  | { status: 'different-version'; source: 'sidecar'; savedVersion: string; bundleVersion: string }
  | { status: 'saved-before-release'; source: 'last-saved'; lastSavedAt: number; bundleDate: string; bundleVersion: string }
  | { status: 'saved-after-release'; source: 'last-saved'; lastSavedAt: number; bundleDate: string; bundleVersion: string }
  | { status: 'unknown'; source: 'none'; bundleVersion: string };

export function assessSaveAge(input: SaveAgeInput): SaveAge {
  const { lastSavedAt, sidecarVersion, bundleVersion, bundleDate } = input;
  if (sidecarVersion !== null) {
    const status = sidecarVersion === bundleVersion ? 'same-version' : 'different-version';
    return { status, source: 'sidecar', savedVersion: sidecarVersion, bundleVersion };
  }
  if (bundleDate === null || bundleDate === undefined || Number.isNaN(Date.parse(bundleDate))) {
    return { status: 'unknown', source: 'none', bundleVersion };
  }
  return {
    status: lastSavedAt * 1000 < Date.parse(bundleDate) ? 'saved-before-release' : 'saved-after-release',
    source: 'last-saved',
    lastSavedAt,
    bundleDate,
    bundleVersion,
  };
}
