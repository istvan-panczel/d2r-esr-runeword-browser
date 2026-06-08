import { useLiveQuery } from 'dexie-react-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/core/db';

const NONE = '__none__';

interface AscendancyPickerProps {
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly disabled?: boolean;
}

/** Optional dropdown of all ascendancy names from the local DB. Not filtered by class. */
export function AscendancyPicker({ value, onChange, disabled }: AscendancyPickerProps) {
  const names = useLiveQuery(async () => {
    const all = await db.ascendancies.toArray();
    return all.map((ascendancy) => ascendancy.name).sort((a, b) => a.localeCompare(b));
  });

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled}
      onValueChange={(next) => {
        onChange(next === NONE ? null : next);
      }}
    >
      <SelectTrigger className="w-full sm:w-60">
        <SelectValue placeholder="None" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>None</SelectItem>
        {(names ?? []).map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
