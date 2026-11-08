import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CraftAnnotation, EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import { SKILLS_MAX_LENGTH, type CharacterClass } from '../constants';
import type { CraftDataState } from '../hooks/useCraftData';
import type { SlotTarget, VariantDraftAction } from '../utils/variantDrafts';
import { AscendancyPicker } from './AscendancyPicker';
import { slotAnchorId, type GearSection, type SectionDraft, type VariantDraft } from './buildFormModel';
import { CharmsEditor } from './CharmsEditor';
import { EquipmentGrid } from './EquipmentGrid';
import { SkillTreeEditor } from './SkillTreeEditor';
import { SlotAlternativesEditor } from './SlotAlternativesEditor';
import { WeaponSwapGrid } from './WeaponSwapGrid';

interface VariantEditorProps {
  readonly draft: VariantDraft;
  /** The draft's position, which every dispatched action targets. */
  readonly index: number;
  readonly characterClass: CharacterClass | '';
  readonly craftData: CraftDataState;
  readonly disabled: boolean;
  readonly dispatch: (action: VariantDraftAction) => void;
}

/** Everything one variant owns: skills, the three gear sections (with alternatives), charms and ascendancy. */
export function VariantEditor({ draft, index, characterClass, craftData, disabled, dispatch }: VariantEditorProps) {
  const target = (section: GearSection, slot: EquipmentSlot | WeaponSwapSlot): SlotTarget => ({ variant: index, section, slot });

  // Props shared by the three grids: main item, note and crafts of a slot, and its alternatives footer.
  // `sectionItems` (player / merc) lets a set alternative's preview count its set pieces.
  const gridProps = <K extends EquipmentSlot | WeaponSwapSlot>(
    section: GearSection,
    maps: SectionDraft<K>,
    sectionItems?: Partial<Record<EquipmentSlot, ItemRef | null>>
  ) => ({
    items: maps.items,
    notes: maps.notes,
    crafts: maps.crafts,
    craftData,
    disabled,
    slotAnchorId: (slot: K) => slotAnchorId(section, slot),
    onChange: (slot: K, ref: ItemRef | null) => {
      dispatch({ ...target(section, slot), type: 'setSlot', ref });
    },
    onNoteChange: (slot: K, text: string) => {
      dispatch({ ...target(section, slot), type: 'setSlotNote', text });
    },
    onCraftsChange: (slot: K, crafts: readonly CraftAnnotation[]) => {
      dispatch({ ...target(section, slot), type: 'setSlotCrafts', crafts });
    },
    renderSlotFooter: (slot: K) => (
      <SlotAlternativesEditor
        target={target(section, slot)}
        mainItem={maps.items[slot] ?? null}
        alternatives={maps.alternatives[slot] ?? []}
        sectionItems={sectionItems}
        craftData={craftData}
        disabled={disabled}
        dispatch={dispatch}
      />
    ),
  });

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <Label htmlFor="build-skills">Skills (optional)</Label>
        <Textarea
          id="build-skills"
          value={draft.skills}
          maxLength={SKILLS_MAX_LENGTH}
          rows={4}
          placeholder="e.g. 20 Blessed Hammer, 20 Vigor, 20 Concentration, 1pt Holy Shield..."
          disabled={disabled}
          onChange={(event) => {
            dispatch({ type: 'setSkills', variant: index, skills: event.target.value });
          }}
        />
        <p className="text-xs text-muted-foreground">
          {draft.skills.length}/{SKILLS_MAX_LENGTH}
        </p>
        <SkillTreeEditor
          characterClass={characterClass}
          levelText={draft.levelText}
          skillPoints={draft.skillPoints}
          disabled={disabled}
          onLevelTextChange={(levelText) => {
            dispatch({ type: 'setLevelText', variant: index, levelText });
          }}
          onSkillPointsChange={(skillPoints) => {
            dispatch({ type: 'setSkillPoints', variant: index, skillPoints });
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Player Gear</h2>
        <p className="text-sm text-muted-foreground">
          Search uniques, mythicals, runewords, and gemwords — or type a custom name. Each slot can list alternative items.
        </p>
        <EquipmentGrid {...gridProps('player', draft.player, draft.player.items)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Weapon Swap</h2>
        <WeaponSwapGrid {...gridProps('swap', draft.swap)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mercenary Gear</h2>
        <EquipmentGrid {...gridProps('merc', draft.merc, draft.merc.items)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Charms</h2>
        <CharmsEditor
          value={draft.charms}
          disabled={disabled}
          onChange={(charms) => {
            dispatch({ type: 'setCharms', variant: index, charms });
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <Label>Ascendancy (optional)</Label>
        <AscendancyPicker
          value={draft.ascendancy}
          disabled={disabled}
          onChange={(ascendancy) => {
            dispatch({ type: 'setAscendancy', variant: index, ascendancy });
          }}
        />
      </section>
    </div>
  );
}
