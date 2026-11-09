import { useDocsDataLine } from '@/core/hooks/useDocsDataLine';
import { useManifest } from '../hooks/useManifest';

/**
 * An amber note when the HTM docs data (Dexie metadata) has a different ESR version from the game-file bundles, nothing
 * otherwise (the versions themselves are on the home page and in Settings). Both normally come from the same field
 * (`metadata.modVersion` in d2rloader/metadata.json: the clone's copy for game files, the live GitHub copy for docs), so
 * they compare like with like. The docs side can fall back to the changelog page's header, so the note still never
 * claims which one is newer.
 */
export function GameDataVersionBanner() {
  const manifest = useManifest();
  const docs = useDocsDataLine();

  if (manifest === null || docs.version === undefined || docs.version === manifest.esrVersion) return null;

  return (
    <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
      Docs data is ESR {docs.version}; game-file data is ESR {manifest.esrVersion} — some details may differ.
    </p>
  );
}
