import { useLiveQuery } from 'dexie-react-hooks';
import { txtDb } from '@/core/db';
import { createPropertyTranslator, type PropertyTranslator } from '@/features/txt-data/utils/propertyTranslator';

/**
 * Hook to load property definitions, skills, and monsters, then create a PropertyTranslator
 * Returns undefined while loading
 */
export function usePropertyTranslator(): PropertyTranslator | undefined {
  const properties = useLiveQuery(() => txtDb.properties.toArray());
  const skills = useLiveQuery(() => txtDb.skills.toArray());
  const monsters = useLiveQuery(() => txtDb.monsters.toArray());

  if (!properties || properties.length === 0) {
    return undefined;
  }

  return createPropertyTranslator(properties, skills, monsters);
}
