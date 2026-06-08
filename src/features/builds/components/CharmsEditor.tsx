import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHARM_MAX_LENGTH } from '../constants';
import { newCharmEntry, type CharmEntry } from '../utils/charms';

interface CharmsEditorProps {
  readonly value: readonly CharmEntry[];
  readonly onChange: (charms: CharmEntry[]) => void;
  readonly disabled?: boolean;
}

/** Free-form list of charm entries (e.g. "Annihilus", "9x Java GCs"). */
export function CharmsEditor({ value, onChange, disabled }: CharmsEditorProps) {
  const update = (id: string, text: string) => {
    onChange(value.map((charm) => (charm.id === id ? { ...charm, text } : charm)));
  };
  const remove = (id: string) => {
    onChange(value.filter((charm) => charm.id !== id));
  };
  const add = () => {
    onChange([...value, newCharmEntry()]);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((charm) => (
        <div key={charm.id} className="flex items-center gap-2">
          <Input
            value={charm.text}
            maxLength={CHARM_MAX_LENGTH}
            placeholder="e.g. Annihilus, 9x Paladin Combat GCs"
            disabled={disabled}
            onChange={(event) => {
              update(charm.id, event.target.value);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Remove charm"
            onClick={() => {
              remove(charm.id);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={add}>
          <Plus className="size-4" />
          Add charm
        </Button>
      </div>
    </div>
  );
}
