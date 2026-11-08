import { useEffect, useReducer, useRef, useState } from 'react';
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
import type { DraftReviewRow, SaveImportReport } from '@/features/character/engine/buildDraft';
import {
  draftLabel,
  draftLevelValid,
  draftsToBuildData,
  initialVariantDrafts,
  variantDraftsReducer,
  type VariantDraftAction,
} from '../utils/variantDrafts';
import { SaveImportPanel } from './SaveImportPanel';
import { VariantEditor } from './VariantEditor';
import { VariantToolbar } from './VariantToolbar';
import { slotAnchorId, type BuildFormSubmit, type BuildFormValues } from './buildFormModel';

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
  /** Set when the initial values came from a save file: shows the review panel, and the draft counts as unsaved work. */
  readonly importReport?: SaveImportReport | null;
  /** Called on every edit of the form. */
  readonly onTouched?: () => void;
}

export function BuildForm({
  initialValues,
  initialVariant = 0,
  submitLabel,
  saving,
  saved,
  onSubmit,
  onCancel,
  importReport = null,
  onTouched,
}: BuildFormProps) {
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
  // An imported draft is unsaved work from the start: leaving must warn even before the first edit.
  const [touched, setTouched] = useState(importReport !== null);
  // The import fills the first variant; its key keeps finding it after a reorder.
  const [importedKey] = useState(drafts[0].key);

  const markTouched = () => {
    setTouched(true);
    onTouched?.();
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

  const importedIndex = drafts.findIndex((draft) => draft.key === importedKey);

  const scrollToSlot = (anchorId: string) => {
    const cell = document.getElementById(anchorId);
    cell?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cell?.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true });
  };

  // Only the active variant is mounted, so a slot of another variant can be reached once its tab has rendered.
  const pendingSlot = useRef<string | null>(null);
  useEffect(() => {
    if (pendingSlot.current === null) return;
    scrollToSlot(pendingSlot.current);
    pendingSlot.current = null;
  }, [active]);

  const goToSlot = (row: DraftReviewRow) => {
    if (importedIndex === -1) return;
    const anchorId = slotAnchorId(row.section, row.slot);
    if (importedIndex === active) {
      scrollToSlot(anchorId);
    } else {
      pendingSlot.current = anchorId;
      setActiveIndex(importedIndex);
    }
  };

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

        {importReport !== null && (
          <SaveImportPanel
            report={importReport}
            draft={importedIndex === -1 ? undefined : drafts[importedIndex]}
            disabled={saving}
            onGoToSlot={goToSlot}
            onClearSlot={(row) => {
              update({ type: 'setSlot', variant: importedIndex, section: row.section, slot: row.slot, ref: null });
            }}
          />
        )}

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
