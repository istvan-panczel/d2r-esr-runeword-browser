import { useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { BUILD_DESCRIPTION_MAX_LENGTH, BUILD_NAME_MAX_LENGTH, CHARACTER_CLASSES, type CharacterClass } from '../constants';
import { useCraftData } from '../hooks/useCraftData';
import { EquipmentPickerDataContext, useEquipmentPickerDataQuery } from '../hooks/useEquipmentPickerData';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';
import {
  draftLabel,
  draftLevelValid,
  draftsToBuildData,
  initialVariantDrafts,
  variantDraftsReducer,
  type VariantDraftAction,
} from '../utils/variantDrafts';
import { VariantEditor } from './VariantEditor';
import { VariantToolbar } from './VariantToolbar';
import type { BuildFormSubmit, BuildFormValues } from './buildFormModel';

interface BuildFormProps {
  readonly initialValues: BuildFormValues;
  /** The 0-based variant shown first (clamped to the variants; default the first). */
  readonly initialVariant?: number;
  readonly submitLabel: string;
  readonly saving: boolean;
  /** True once the save succeeded, so the unsaved-changes guard stands down. */
  readonly saved: boolean;
  readonly onSubmit: (payload: BuildFormSubmit) => void;
  readonly onCancel: () => void;
}

export function BuildForm({ initialValues, initialVariant = 0, submitLabel, saving, saved, onSubmit, onCancel }: BuildFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [characterClass, setCharacterClass] = useState<CharacterClass | ''>(initialValues.characterClass);
  const [drafts, dispatch] = useReducer(variantDraftsReducer, initialValues.variants, initialVariantDrafts);
  // Outside the reducer: switching variants is navigation and never marks the form changed.
  const [activeIndex, setActiveIndex] = useState(() => Math.min(Math.max(initialVariant, 0), drafts.length - 1));
  // The crafting picker needs the bundles in every slot, so they load once here for the whole form.
  const craftData = useCraftData(true);
  // One item scan for every slot picker of the form (main items and alternatives).
  const pickerData = useEquipmentPickerDataQuery();
  const [touched, setTouched] = useState(false);

  const markTouched = () => {
    setTouched(true);
  };

  /** Every variant edit goes through here, so it marks the form changed. */
  const update = (action: VariantDraftAction) => {
    dispatch(action);
    markTouched();
  };

  const active = Math.min(activeIndex, drafts.length - 1);
  const activeDraft = drafts[active];

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= BUILD_NAME_MAX_LENGTH;
  const invalidLabels = drafts.flatMap((draft, index) => (draftLevelValid(draft) ? [] : [draftLabel(draft, index)]));
  const canSave = nameValid && invalidLabels.length === 0 && characterClass !== '' && !saving;

  useUnsavedChangesPrompt(touched && !saved);

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    // canSave already guarantees characterClass !== '' (TS narrows it here).
    if (!canSave) return;
    onSubmit({ name: trimmedName, description, characterClass, buildData: draftsToBuildData(drafts), activeVariant: active });
  };

  return (
    <EquipmentPickerDataContext value={pickerData}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="build-name">Build name</Label>
          <Input
            id="build-name"
            value={name}
            maxLength={BUILD_NAME_MAX_LENGTH}
            placeholder="e.g. Hammerdin MF"
            required
            disabled={saving}
            onChange={(event) => {
              setName(event.target.value);
              markTouched();
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="build-class">Class</Label>
          <Select
            value={characterClass}
            disabled={saving}
            onValueChange={(value) => {
              setCharacterClass(value as CharacterClass);
              markTouched();
            }}
          >
            <SelectTrigger id="build-class" className="w-full sm:w-60">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {CHARACTER_CLASSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="build-description">Description (optional)</Label>
          <Textarea
            id="build-description"
            value={description}
            maxLength={BUILD_DESCRIPTION_MAX_LENGTH}
            placeholder="Notes, guide, gameplay tips..."
            rows={5}
            disabled={saving}
            onChange={(event) => {
              setDescription(event.target.value);
              markTouched();
            }}
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/{BUILD_DESCRIPTION_MAX_LENGTH}
          </p>
        </div>

        <Tabs
          value={activeDraft.key}
          onValueChange={(key) => {
            const index = drafts.findIndex((draft) => draft.key === key);
            if (index !== -1) setActiveIndex(index);
          }}
          className="gap-5"
        >
          <VariantToolbar drafts={drafts} activeIndex={active} onSelect={setActiveIndex} disabled={saving} dispatch={update} />
          {/* Only the active variant is mounted: the fixed field ids stay unique and the pickers don't multiply. */}
          <TabsContent key={activeDraft.key} value={activeDraft.key}>
            <VariantEditor
              draft={activeDraft}
              index={active}
              characterClass={characterClass}
              craftData={craftData}
              disabled={saving}
              dispatch={update}
            />
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 z-10 flex gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="submit" disabled={!canSave}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          {invalidLabels.length > 0 && <p className="self-center text-xs text-destructive">Invalid level in {invalidLabels.join(', ')}</p>}
        </div>
      </form>
    </EquipmentPickerDataContext>
  );
}
