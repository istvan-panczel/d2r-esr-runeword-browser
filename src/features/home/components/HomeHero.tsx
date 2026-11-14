import { Link } from 'react-router-dom';
import { useDocsDataLine } from '@/core/hooks/useDocsDataLine';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import { releasePath } from '@/features/patch-notes/utils/patchNotesView';
import { HomeSearch } from './HomeSearch';

/** Pitch header: title, one-line pitch, the data versions (with the game files' patch notes), and the cross-section search. */
export function HomeHero() {
  const manifest = useManifest();
  const docs = useDocsDataLine();
  const versions = [manifest === null ? null : `Game files: ESR ${manifest.esrVersion}`, docs.line].filter((line) => line !== null);

  return (
    <section aria-labelledby="home-title" className="space-y-4 rounded-xl border bg-card px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-2">
        <h1 id="home-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
          D2R ESR Browser
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Browse Eastern Sun Resurrected data, plan builds and build loot filters.
        </p>
        {/* Fixed height so the line appearing after the manifest/sync loads does not shift the search below. */}
        <p className="min-h-4 text-xs text-muted-foreground">
          {versions.join(' · ')}
          {manifest !== null && (
            <>
              {' · '}
              <Link to={releasePath(manifest.esrVersion)} className="underline underline-offset-2 hover:text-foreground">
                What changed in {manifest.esrVersion}
              </Link>
            </>
          )}
        </p>
      </div>
      <HomeSearch />
    </section>
  );
}
