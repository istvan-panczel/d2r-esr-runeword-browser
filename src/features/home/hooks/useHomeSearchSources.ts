import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { loadGameDataFile } from '@/features/game-data/engine/browser/loadGameData';
import { areaSearchNames, skillSearchNames, type HomeSearchSources } from '../utils/homeSearch';

type ItemSources = Required<Pick<HomeSearchSources, 'runewords' | 'gemwords' | 'uniques' | 'mythicals'>>;

/**
 * Unique runeword, gemword, unique and mythical names from Dexie (the name indexes), read only once `enabled` (the
 * startup sync has finished and the visitor has typed). Undefined until then.
 */
export function useItemNames(enabled: boolean): ItemSources | undefined {
  return useLiveQuery(async (): Promise<ItemSources | undefined> => {
    if (!enabled) return undefined;
    const [runewords, gemwords, uniques, mythicals] = await Promise.all([
      db.runewords.orderBy('name').uniqueKeys(),
      db.gemwords.orderBy('name').uniqueKeys(),
      db.htmUniqueItems.orderBy('name').uniqueKeys(),
      db.mythicalUniques.orderBy('name').uniqueKeys(),
    ]);
    return {
      runewords: runewords.map(String),
      gemwords: gemwords.map(String),
      uniques: uniques.map(String),
      mythicals: mythicals.map(String),
    };
  }, [enabled]);
}

/** The static bundles the search reads, fetched in parallel on the first keystroke */
const NAMES_BUNDLES = ['bases', 'sets', 'skilldetails', 'materials', 'areas'] as const;
type NamesBundle = (typeof NAMES_BUNDLES)[number];

/** The search names each static bundle contributes (materials.json also carries the cube family labels and ids) */
const NAME_LOADERS: Record<NamesBundle, () => Promise<HomeSearchSources>> = {
  bases: async () => {
    const bundle = await loadGameDataFile('bases');
    return { bases: bundle.bases.map((base) => base.name) };
  },
  sets: async () => {
    const bundle = await loadGameDataFile('sets');
    return { sets: bundle.sets.map((set) => set.name), setItems: bundle.sets.flatMap((set) => set.items.map((item) => item.name)) };
  },
  skilldetails: async () => {
    const bundle = await loadGameDataFile('skilldetails');
    return { skills: skillSearchNames(bundle.skills) };
  },
  materials: async () => {
    const bundle = await loadGameDataFile('materials');
    return {
      materials: bundle.items.map((item) => item.name),
      cube: bundle.families.map((family) => ({ name: family.label, id: family.id })),
    };
  },
  areas: async () => {
    const bundle = await loadGameDataFile('areas');
    return { areas: areaSearchNames(bundle.areas) };
  },
};

export interface BundleNamesState {
  /** Names of the bundles loaded so far */
  readonly sources: HomeSearchSources;
  /** True while a bundle is not fetched yet (also before `enabled`) */
  readonly pending: boolean;
}

type Settled = Partial<Record<NamesBundle, HomeSearchSources | 'error'>>;

/**
 * Names from the static game-data bundles (bases, sets, skills, materials and cube families, areas), each fetched once
 * `enabled` (on the first keystroke). A bundle that fails to load is logged and left out; the others still search.
 */
export function useBundleNames(enabled: boolean): BundleNamesState {
  const [settled, setSettled] = useState<Settled>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    for (const file of NAMES_BUNDLES) {
      NAME_LOADERS[file]().then(
        (sources) => {
          if (!cancelled) setSettled((current) => ({ ...current, [file]: sources }));
        },
        (error: unknown) => {
          console.error(`[Home] Failed to load ${file} names for search:`, error);
          if (!cancelled) setSettled((current) => ({ ...current, [file]: 'error' }));
        }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  let sources: HomeSearchSources = {};
  for (const file of NAMES_BUNDLES) {
    const loaded = settled[file];
    if (loaded !== undefined && loaded !== 'error') sources = { ...sources, ...loaded };
  }
  return { sources, pending: NAMES_BUNDLES.some((file) => settled[file] === undefined) };
}
