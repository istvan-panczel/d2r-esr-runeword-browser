import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import { selectEnabledCategories, selectSearchText } from '../store/socketablesSlice';
import type { UnifiedSocketable, SocketableCategory } from '../types';
import { parseSearchTerms } from '@/features/runewords/utils/filteringHelpers';
import { matchesSearch } from '../utils/filteringHelpers';

// Category sort order (fixed display order)
const CATEGORY_ORDER: Record<SocketableCategory, number> = {
  gems: 0,
  esrRunes: 1,
  lodRunes: 2,
  kanjiRunes: 3,
  crystals: 4,
};

// Quality order for gems (Chipped is lowest, Perfect is highest)
const GEM_QUALITY_ORDER: Record<string, number> = {
  Chipped: 0,
  Flawed: 1,
  Standard: 2,
  Flawless: 3,
  Blemished: 4,
  Perfect: 5,
};

// Quality order for crystals
const CRYSTAL_QUALITY_ORDER: Record<string, number> = {
  Chipped: 0,
  Flawed: 1,
  Standard: 2,
};

export function useFilteredSocketables(): readonly UnifiedSocketable[] | undefined {
  const enabledCategories = useSelector(selectEnabledCategories);
  const searchText = useSelector(selectSearchText);

  // Fetch all socketables from IndexedDB
  const allSocketables = useLiveQuery(async () => {
    const [gems, esrRunes, lodRunes, kanjiRunes, crystals] = await Promise.all([
      db.gems.toArray(),
      db.esrRunes.toArray(),
      db.lodRunes.toArray(),
      db.kanjiRunes.toArray(),
      db.crystals.toArray(),
    ]);

    const unified: UnifiedSocketable[] = [];

    // Add gems (sorted by type alphabetically, then by quality)
    gems
      .sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) return typeCompare;
        return (GEM_QUALITY_ORDER[a.quality] ?? 0) - (GEM_QUALITY_ORDER[b.quality] ?? 0);
      })
      .forEach((gem, index) => {
        unified.push({
          name: gem.name,
          category: 'gems',
          color: gem.color,
          reqLevel: gem.reqLevel,
          bonuses: gem.bonuses,
          sortOrder: CATEGORY_ORDER.gems * 1000 + index,
        });
      });

    // Add ESR runes (sorted by tier)
    esrRunes
      .sort((a, b) => a.tier - b.tier)
      .forEach((rune, index) => {
        unified.push({
          name: rune.name,
          category: 'esrRunes',
          color: rune.color,
          reqLevel: rune.reqLevel,
          bonuses: rune.bonuses,
          sortOrder: CATEGORY_ORDER.esrRunes * 1000 + index,
          points: rune.points,
        });
      });

    // Add LoD runes (sorted by order)
    lodRunes
      .sort((a, b) => a.order - b.order)
      .forEach((rune, index) => {
        unified.push({
          name: rune.name,
          category: 'lodRunes',
          color: null,
          reqLevel: rune.reqLevel,
          bonuses: rune.bonuses,
          sortOrder: CATEGORY_ORDER.lodRunes * 1000 + index,
          points: rune.points,
        });
      });

    // Add Kanji runes
    kanjiRunes.forEach((rune, index) => {
      unified.push({
        name: rune.name,
        category: 'kanjiRunes',
        color: null,
        reqLevel: rune.reqLevel,
        bonuses: rune.bonuses,
        sortOrder: CATEGORY_ORDER.kanjiRunes * 1000 + index,
      });
    });

    // Add crystals (sorted by type alphabetically, then by quality)
    crystals
      .sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) return typeCompare;
        return (CRYSTAL_QUALITY_ORDER[a.quality] ?? 0) - (CRYSTAL_QUALITY_ORDER[b.quality] ?? 0);
      })
      .forEach((crystal, index) => {
        unified.push({
          name: crystal.name,
          category: 'crystals',
          color: crystal.color,
          reqLevel: crystal.reqLevel,
          bonuses: crystal.bonuses,
          sortOrder: CATEGORY_ORDER.crystals * 1000 + index,
        });
      });

    return unified.sort((a, b) => a.sortOrder - b.sortOrder);
  }, []);

  // Apply filters (done outside useLiveQuery to use Redux state)
  if (!allSocketables) return undefined;

  const searchTerms = parseSearchTerms(searchText);

  return allSocketables.filter((item) => {
    // Check category filter
    if (!enabledCategories[item.category]) return false;

    // Check search filter
    return matchesSearch(item, searchTerms);
  });
}
