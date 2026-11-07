import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BASE_TIERS, LOCATIONS, QUALITIES, type ItemLocation } from '../../engine/types';
import type { LootFilterData } from '../../hooks/useLootFilterData';
import {
  itemTypeOf,
  parseUniqueOrSetValue,
  typeAncestorsOf,
  uniqueOrSetValue,
  withItem,
  withQuality,
  withUniqueOrSet,
  type TestItemForm,
} from '../../utils/testItemForm';
import { NumberInput } from '../NumberInput';
import { SingleItemPicker, SinglePicker } from '../pickers';
import { idCustom } from '../pickers/customOptions';
import { StatRowsEditor } from './StatRowsEditor';
import { Field } from '../Field';

const LOCATION_LABELS: Readonly<Record<ItemLocation, string>> = {
  onGround: 'On the ground',
  stored: 'Stored (inventory, stash, cube)',
  equipped: 'Equipped',
  atVendor: 'At a vendor',
};

const FLAGS = [
  { key: 'isIdentified', label: 'Identified' },
  { key: 'isEthereal', label: 'Ethereal' },
  { key: 'isRuneword', label: 'Runeword' },
  { key: 'isFullySocketed', label: 'Fully socketed' },
] as const;

const ID = 'loot-filter-test';

/** Select value of "no base tier" (an item without a normal/exceptional/elite family). */
const NO_TIER = 'none';

interface TestItemFieldsProps {
  readonly data: LootFilterData;
  readonly form: TestItemForm;
  readonly onChange: (form: TestItemForm) => void;
}

/** The item half of the test form: base item, quality and properties, unique/set row, stats and location. */
export function TestItemFields({ data, form, onChange }: TestItemFieldsProps) {
  const { lookup } = data;
  const update = (patch: Partial<TestItemForm>) => {
    onChange({ ...form, ...patch });
  };
  const type = itemTypeOf(form, lookup);
  const typeInfo = type === '' ? undefined : lookup.itemType(type);
  const typeAncestors = typeAncestorsOf(form, lookup);
  const uniqueName = form.uniqueOrSet === null ? undefined : lookup.uniqueOrSetName(form.uniqueOrSet.id);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${ID}-item`} label="Item" dense>
          <SingleItemPicker
            data={data}
            id={`${ID}-item`}
            value={form.code === '' ? undefined : form.code}
            onChange={(code) => {
              onChange(withItem(form, code, lookup));
            }}
            className="w-full"
          />
        </Field>
        <Field id={`${ID}-name`} label="Name ({name})" dense>
          <Input
            id={`${ID}-name`}
            className="h-8"
            value={form.name}
            placeholder="The game's name"
            onChange={(event) => {
              update({ name: event.target.value });
            }}
          />
        </Field>
      </div>

      <Field id={`${ID}-type`} label="Item type" dense>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`${ID}-type`}
            className="h-8 w-28 font-mono"
            value={form.type}
            placeholder={type === '' ? 'type code' : type}
            onChange={(event) => {
              update({ type: event.target.value });
            }}
          />
          <span className="min-w-0 text-xs text-muted-foreground">
            {typeInfo === undefined
              ? type === ''
                ? 'Unknown: item-type conditions do not match.'
                : 'Only this type is known (no parent types).'
              : `${typeInfo.name === '' ? type : typeInfo.name} · matches ${typeAncestors.join(', ')}`}
          </span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field id={`${ID}-quality`} label="Quality" dense>
          <Select
            value={String(form.quality)}
            onValueChange={(value) => {
              onChange(withQuality(form, Number(value)));
            }}
          >
            <SelectTrigger id={`${ID}-quality`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITIES.map((quality, index) => (
                <SelectItem key={quality} value={String(index + 1)}>
                  {quality}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${ID}-tier`} label="Base tier" dense>
          <Select
            value={form.baseTier === null ? NO_TIER : String(form.baseTier)}
            onValueChange={(value) => {
              update({ baseTier: value === NO_TIER ? null : Number(value) });
            }}
          >
            <SelectTrigger id={`${ID}-tier`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_TIERS.map((tier, index) => (
                <SelectItem key={tier} value={String(index)}>
                  {tier}
                </SelectItem>
              ))}
              <SelectItem value={NO_TIER}>none (rings, charms, jewels, mythical…)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${ID}-location`} label="Location" className="col-span-2 sm:col-span-1" dense>
          <Select
            value={form.location}
            onValueChange={(value) => {
              const location = LOCATIONS.find((candidate) => candidate === value);
              if (location !== undefined) update({ location });
            }}
          >
            <SelectTrigger id={`${ID}-location`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((location) => (
                <SelectItem key={location} value={location}>
                  {LOCATION_LABELS[location]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${ID}-ilvl`} label="Item level" dense>
          <NumberInput
            id={`${ID}-ilvl`}
            integer
            min={0}
            max={999}
            className="h-8"
            value={form.itemLevel}
            onCommit={(itemLevel) => {
              update({ itemLevel });
            }}
          />
        </Field>
        <Field id={`${ID}-sockets`} label="Sockets" dense>
          <NumberInput
            id={`${ID}-sockets`}
            integer
            min={0}
            max={99}
            className="h-8"
            value={form.sockets}
            onCommit={(sockets) => {
              update({ sockets });
            }}
          />
        </Field>
        <Field id={`${ID}-max-sockets`} label="Max sockets" dense>
          <NumberInput
            id={`${ID}-max-sockets`}
            integer
            min={0}
            max={99}
            className="h-8"
            value={form.maxSockets}
            onCommit={(maxSockets) => {
              update({ maxSockets });
            }}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {FLAGS.map((flag) => (
          <div key={flag.key} className="flex items-center gap-1.5">
            <Checkbox
              id={`${ID}-${flag.key}`}
              checked={form[flag.key]}
              onCheckedChange={(checked) => {
                onChange({ ...form, [flag.key]: checked === true });
              }}
            />
            <Label htmlFor={`${ID}-${flag.key}`} className="text-sm font-normal">
              {flag.label}
            </Label>
          </div>
        ))}
      </div>

      <Field id={`${ID}-unique`} label="Unique or set item" dense>
        <div className="flex gap-1">
          <SinglePicker
            id={`${ID}-unique`}
            // Option keys (`Unique:12`, `Set:12`) as values: the two tables share ids, the key tells them apart.
            options={data.options.uniquesAndSets.map((option) => ({ ...option, value: option.key }))}
            value={uniqueOrSetValue(form.uniqueOrSet)}
            onChange={(value) => {
              onChange(withUniqueOrSet(form, parseUniqueOrSetValue(value), data.data, lookup));
            }}
            describe={() => {
              const id = form.uniqueOrSet === null ? '' : String(form.uniqueOrSet.id);
              return { label: uniqueName ?? `#${id}`, detail: id, muted: data.status === 'ready' && uniqueName === undefined };
            }}
            placeholder="None"
            searchPlaceholder="Name, base item or id…"
            custom={idCustom('row')}
            className="min-w-0 flex-1"
          />
          {form.uniqueOrSet !== null && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8"
              aria-label="No unique or set item"
              onClick={() => {
                onChange(withUniqueOrSet(form, null, data.data, lookup));
              }}
            >
              <X />
            </Button>
          )}
        </div>
      </Field>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">Item stats</span>
        <p className="text-xs text-muted-foreground">
          Enter the numbers the tooltip shows (+40 Life = 40; a per-level stat at the character&apos;s level). An unidentified item skips
          every rule that checks an item stat other than gold, armorclass, quantity, durability, maxdurability and item_numsockets.
        </p>
        <StatRowsEditor
          data={data}
          idPrefix={`${ID}-item-stat`}
          rows={form.stats}
          onChange={(stats) => {
            update({ stats });
          }}
          addLabel="Add item stat"
        />
      </div>
    </div>
  );
}
