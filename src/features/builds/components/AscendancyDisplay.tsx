import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '@/components/ui/card';
import { db } from '@/core/db';
import { AscendancyCard } from '@/features/ascendancies';

/**
 * Renders the stored ascendancy with its tier bonuses from the viewer's local
 * data. Falls back to just the name if it isn't in the current ESR data.
 */
export function AscendancyDisplay({ name }: { readonly name: string }) {
  const ascendancy = useLiveQuery(() => db.ascendancies.get(name), [name]);

  if (ascendancy === undefined) {
    return (
      <Card className="p-3">
        <p className="text-sm font-medium">{name}</p>
      </Card>
    );
  }

  return (
    <div className="max-w-sm">
      <AscendancyCard item={ascendancy} />
    </div>
  );
}
