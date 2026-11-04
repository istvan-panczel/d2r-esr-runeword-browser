import { useDispatch } from 'react-redux';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LootFilter } from '../engine/types';
import { setHeader, setNotifications, type LootFilterHeader } from '../store/lootFilterSlice';
import type { ShallowPatch } from '../utils/patch';
import { ColorTextField } from './actions/ColorTextField';
import { CheckField, Field } from './Field';
import { NumberInput } from './NumberInput';
import { FilterLevelsEditor } from './settings/FilterLevelsEditor';
import { QualityColorsEditor } from './settings/QualityColorsEditor';

type HeaderPatch = ShallowPatch<LootFilterHeader>;

interface TextField {
  readonly key: 'title' | 'author' | 'version' | 'updateUrl';
  readonly label: string;
  readonly placeholder: string;
  readonly toPatch: (value: string | undefined) => HeaderPatch;
}

const TEXT_FIELDS: readonly TextField[] = [
  { key: 'title', label: 'Title', placeholder: 'My Filter', toPatch: (title) => ({ title }) },
  { key: 'author', label: 'Author', placeholder: 'Me', toPatch: (author) => ({ author }) },
  { key: 'version', label: 'Version', placeholder: '1.0', toPatch: (version) => ({ version }) },
  {
    key: 'updateUrl',
    label: 'Update URL',
    placeholder: 'https://… where newer copies are published',
    toPatch: (updateUrl) => ({ updateUrl }),
  },
];

interface SettingsTabProps {
  readonly filter: LootFilter;
}

/** The filter's top-level settings. Every change goes straight to the store (no local form state). */
export function SettingsTab({ filter }: SettingsTabProps) {
  const dispatch = useDispatch();
  const patch = (value: HeaderPatch) => dispatch(setHeader(value));
  const emptyToUndefined = (value: string) => (value === '' ? undefined : value);

  // Wide pages: the cards fill a grid (two columns from @8xl/page, three from @10xl/page; a row as high as its
  // tallest card) and the quality colours take two columns. Standard pages keep the one column.
  return (
    <div className="space-y-4 @8xl/page:grid @8xl/page:grid-cols-2 @8xl/page:gap-4 @8xl/page:space-y-0 @10xl/page:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>About the filter</CardTitle>
          <CardDescription>Shown in the launcher&apos;s filter list.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <Field key={field.key} id={`loot-filter-${field.key}`} label={field.label}>
              <Input
                id={`loot-filter-${field.key}`}
                value={filter[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => patch(field.toPatch(emptyToUndefined(event.target.value)))}
              />
            </Field>
          ))}
          <Field id="loot-filter-description" label="Description" className="sm:col-span-2">
            <Textarea
              id="loot-filter-description"
              value={filter.description ?? ''}
              onChange={(event) => patch({ description: emptyToUndefined(event.target.value) })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <CheckField
            id="loot-filter-hide-unmatched"
            label="Hide unmatched items"
            hint="Hides every ground item no rule applied to."
            checked={filter.hideUnmatchedItems === true}
            onChange={(checked) => patch({ hideUnmatchedItems: checked })}
          />
          <Field id="loot-filter-sound-volume" label="Sound volume" hint="0 to 100, for rules that set no volume of their own.">
            <NumberInput
              id="loot-filter-sound-volume"
              className="w-28"
              min={0}
              max={100}
              value={filter.soundVolume}
              placeholder="100"
              onCommit={(soundVolume) => patch({ soundVolume })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter levels</CardTitle>
          <CardDescription>The level key in game steps through these; rules can be limited to some of them.</CardDescription>
        </CardHeader>
        <CardContent>
          <FilterLevelsEditor filter={filter} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ColorTextField
            id="loot-filter-drop-format"
            label="Drop line"
            context="dropFormat"
            defaultColor="0"
            hint="Printed by rules with notify. Placeholders such as {name} and {qualityColor} are filled in."
            placeholder="{qualityColor}{name}"
            value={filter.notifications?.dropFormat}
            onChange={(dropFormat) => dispatch(setNotifications({ dropFormat }))}
          />
          <ColorTextField
            id="loot-filter-level-change-format"
            label="Level change line"
            context="levelChangeFormat"
            defaultColor="0"
            hint="Printed when the level changes; takes {level} and {filter}."
            placeholder="ÿc4Loot filter level: ÿc0{level}"
            value={filter.notifications?.levelChangeFormat}
            onChange={(levelChangeFormat) => dispatch(setNotifications({ levelChangeFormat }))}
          />
        </CardContent>
      </Card>

      <Card className="@8xl/page:col-span-2">
        <CardHeader>
          <CardTitle>Quality colours</CardTitle>
          <CardDescription>The colour code {'{qualityColor}'} uses for each item quality.</CardDescription>
        </CardHeader>
        <CardContent>
          <QualityColorsEditor value={filter.qualityColors} />
        </CardContent>
      </Card>
    </div>
  );
}
