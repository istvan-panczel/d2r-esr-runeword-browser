import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BUILD_DESCRIPTION_MAX_LENGTH,
  BUILD_NAME_MAX_LENGTH,
  CHARACTER_CLASSES,
  SKILLS_MAX_LENGTH,
  type CharacterClass,
} from '../constants';
import type { BuildData, EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import { compactItems, compactNotes } from '../utils/buildSnapshot';
import { charmTexts, toCharmEntries, type CharmEntry } from '../utils/charms';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';
import { EquipmentGrid } from './EquipmentGrid';
import { WeaponSwapGrid } from './WeaponSwapGrid';
import { CharmsEditor } from './CharmsEditor';
import { AscendancyPicker } from './AscendancyPicker';
import type { BuildFormSubmit, BuildFormValues } from './buildFormModel';

interface BuildFormProps {
  readonly initialValues: BuildFormValues;
  readonly submitLabel: string;
  readonly saving: boolean;
  /** True once the save succeeded, so the unsaved-changes guard stands down. */
  readonly saved: boolean;
  readonly onSubmit: (payload: BuildFormSubmit) => void;
  readonly onCancel: () => void;
}

export function BuildForm({ initialValues, submitLabel, saving, saved, onSubmit, onCancel }: BuildFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [characterClass, setCharacterClass] = useState<CharacterClass | ''>(initialValues.characterClass);
  const [items, setItems] = useState<Partial<Record<EquipmentSlot, ItemRef | null>>>(initialValues.items);
  const [weaponSwap, setWeaponSwap] = useState<Partial<Record<WeaponSwapSlot, ItemRef | null>>>(initialValues.weaponSwap);
  const [mercenary, setMercenary] = useState<Partial<Record<EquipmentSlot, ItemRef | null>>>(initialValues.mercenary);
  const [itemNotes, setItemNotes] = useState<Partial<Record<EquipmentSlot, string>>>(initialValues.itemNotes);
  const [weaponSwapNotes, setWeaponSwapNotes] = useState<Partial<Record<WeaponSwapSlot, string>>>(initialValues.weaponSwapNotes);
  const [mercenaryNotes, setMercenaryNotes] = useState<Partial<Record<EquipmentSlot, string>>>(initialValues.mercenaryNotes);
  const [charms, setCharms] = useState<CharmEntry[]>(() => toCharmEntries(initialValues.charms));
  const [ascendancy, setAscendancy] = useState<string | null>(initialValues.ascendancy);
  const [skills, setSkills] = useState(initialValues.skills);
  const [touched, setTouched] = useState(false);

  const markTouched = () => {
    setTouched(true);
  };

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= BUILD_NAME_MAX_LENGTH;
  const canSave = nameValid && characterClass !== '' && !saving;

  useUnsavedChangesPrompt(touched && !saved);

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    // canSave already guarantees characterClass !== '' (TS narrows it here).
    if (!canSave) return;
    const equipped = compactItems(items);
    const swapEquipped = compactItems(weaponSwap);
    const mercEquipped = compactItems(mercenary);
    const itemNoteMap = compactNotes(itemNotes);
    const swapNoteMap = compactNotes(weaponSwapNotes);
    const mercNoteMap = compactNotes(mercenaryNotes);
    const cleanedCharms = charmTexts(charms);
    const trimmedSkills = skills.trim();
    const buildData: BuildData = {
      ...(Object.keys(equipped).length > 0 ? { items: equipped } : {}),
      ...(Object.keys(swapEquipped).length > 0 ? { weaponSwap: swapEquipped } : {}),
      ...(Object.keys(mercEquipped).length > 0 ? { mercenary: mercEquipped } : {}),
      ...(Object.keys(itemNoteMap).length > 0 ? { itemNotes: itemNoteMap } : {}),
      ...(Object.keys(swapNoteMap).length > 0 ? { weaponSwapNotes: swapNoteMap } : {}),
      ...(Object.keys(mercNoteMap).length > 0 ? { mercenaryNotes: mercNoteMap } : {}),
      ...(cleanedCharms.length > 0 ? { charms: cleanedCharms } : {}),
      ...(ascendancy !== null ? { ascendancy } : {}),
      ...(trimmedSkills.length > 0 ? { skills: trimmedSkills } : {}),
    };
    onSubmit({ name: trimmedName, description, characterClass, buildData });
  };

  return (
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

      <section className="flex flex-col gap-2">
        <Label htmlFor="build-skills">Skills (optional)</Label>
        <Textarea
          id="build-skills"
          value={skills}
          maxLength={SKILLS_MAX_LENGTH}
          rows={4}
          placeholder="e.g. 20 Blessed Hammer, 20 Vigor, 20 Concentration, 1pt Holy Shield..."
          disabled={saving}
          onChange={(event) => {
            setSkills(event.target.value);
            markTouched();
          }}
        />
        <p className="text-xs text-muted-foreground">
          {skills.length}/{SKILLS_MAX_LENGTH}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Player Gear</h2>
        <p className="text-sm text-muted-foreground">Search uniques, mythicals, runewords, and gemwords — or type a custom name.</p>
        <EquipmentGrid
          items={items}
          notes={itemNotes}
          disabled={saving}
          onChange={(slot, ref) => {
            setItems((prev) => ({ ...prev, [slot]: ref }));
            // Emptying a slot clears its note (compactNotes drops the blank on save).
            if (ref === null) setItemNotes((prev) => ({ ...prev, [slot]: '' }));
            markTouched();
          }}
          onNoteChange={(slot, text) => {
            setItemNotes((prev) => ({ ...prev, [slot]: text }));
            markTouched();
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Weapon Swap</h2>
        <WeaponSwapGrid
          items={weaponSwap}
          notes={weaponSwapNotes}
          disabled={saving}
          onChange={(slot, ref) => {
            setWeaponSwap((prev) => ({ ...prev, [slot]: ref }));
            if (ref === null) setWeaponSwapNotes((prev) => ({ ...prev, [slot]: '' }));
            markTouched();
          }}
          onNoteChange={(slot, text) => {
            setWeaponSwapNotes((prev) => ({ ...prev, [slot]: text }));
            markTouched();
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mercenary Gear</h2>
        <EquipmentGrid
          items={mercenary}
          notes={mercenaryNotes}
          disabled={saving}
          onChange={(slot, ref) => {
            setMercenary((prev) => ({ ...prev, [slot]: ref }));
            if (ref === null) setMercenaryNotes((prev) => ({ ...prev, [slot]: '' }));
            markTouched();
          }}
          onNoteChange={(slot, text) => {
            setMercenaryNotes((prev) => ({ ...prev, [slot]: text }));
            markTouched();
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Charms</h2>
        <CharmsEditor
          value={charms}
          disabled={saving}
          onChange={(next) => {
            setCharms(next);
            markTouched();
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <Label>Ascendancy (optional)</Label>
        <AscendancyPicker
          value={ascendancy}
          disabled={saving}
          onChange={(next) => {
            setAscendancy(next);
            markTouched();
          }}
        />
      </section>

      <div className="sticky bottom-0 z-10 flex gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="submit" disabled={!canSave}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
