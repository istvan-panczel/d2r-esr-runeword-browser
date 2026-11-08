import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHeader } from '@/components/SectionHeader';
import type { AlternativesMap, EquipmentSlot, ItemAlternative, ItemRef, VariantData, WeaponSwapSlot } from '../buildData';
import type { CraftDataState } from '../hooks/useCraftData';
import type { SkillTreeState } from '../hooks/useSkillTree';
import { compactItems } from '../utils/buildSnapshot';
import { variantHasMerc, variantHasSkills } from '../utils/buildVariants';
import {
  displayedSection,
  sectionHasAlternatives,
  setPiecesIfWorn,
  type DisplayedSection,
  type SlotPicks,
} from '../utils/displayedSection';
import type { ItemDiff, VariantItemDiffs } from '../utils/itemDiff';
import { splitCharmLine } from '../utils/charms';
import { hasSetItems } from '../utils/setBonuses';
import { hasSkillPoints } from '../utils/skillTree';
import { AscendancyDisplay } from './AscendancyDisplay';
import { EquipmentGrid } from './EquipmentGrid';
import { SetBonusesBlock } from './SetBonusesBlock';
import { SkillTreeDisplay } from './SkillTreeDisplay';
import { SlotAlternativeLabel, SlotAlternativesView } from './SlotAlternativesView';
import { WeaponSwapGrid } from './WeaponSwapGrid';

export type DetailTab = 'player' | 'skills' | 'mercenary';

const hasText = (value: string | null | undefined): boolean => value !== null && value !== undefined && value.trim().length > 0;

/*
 * The Player tab on pages of 2400 px and up (Wide and Full page widths; the `page` container is set by the screen
 * only for them). With player gear and a weapon swap, the swap sits beside the gear: five equal slot columns use the
 * width. Without one of them the three paperdoll columns would stretch across an ultrawide window, so the gear column
 * stops at 120rem (the charms + ascendancy aside stays right next to it) and the rest of the row stays empty.
 */
const GEAR_SIDE_BY_SIDE_CLASS =
  'flex flex-col gap-6 @10xl/page:grid @10xl/page:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @10xl/page:items-start';
const PLAYER_TAB_CLASS = {
  aside: {
    fill: 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]',
    capped: 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] @10xl/page:grid-cols-[minmax(0,120rem)_24rem]',
  },
  noAside: { fill: 'flex flex-col gap-6', capped: 'flex flex-col gap-6 @10xl/page:max-w-[120rem]' },
} as const;

type SectionId = 'items' | 'weaponSwap' | 'mercenary';
type SectionPicks = Readonly<Record<SectionId, SlotPicks<string>>>;
const NO_PICKS: SectionPicks = { items: {}, weaponSwap: {}, mercenary: {} };

interface SlotRenderers<K extends string> {
  readonly renderSlotFooter?: (slot: K) => ReactNode;
  readonly renderSlotLabelExtra?: (slot: K) => ReactNode;
}

/** Whether a variant has charms or an ascendancy (the aside beside the player gear). */
function variantHasPlayerAside(variant: VariantData): boolean {
  return (variant.charms?.length ?? 0) > 0 || (variant.ascendancy ?? null) !== null;
}

interface VariantDetailProps {
  readonly variant: VariantData;
  /** The build has more than one variant (the empty-gear message then speaks of "this variant"). */
  readonly multiVariant: boolean;
  readonly characterClass: string;
  /** The active variant's version diffs; undefined until they (and the local data) are ready. */
  readonly diffs: VariantItemDiffs | undefined;
  readonly craftData: CraftDataState;
  readonly skillData: SkillTreeState;
  /** The tab choice lives in the screen so it survives a variant switch; unavailable tabs fall back to Player. */
  readonly tab: DetailTab;
  readonly onTabChange: (tab: DetailTab) => void;
}

/**
 * Everything the detail page shows for one variant: the Player / Skills / Mercenary tabs. Keyed by the variant
 * index in the screen, so the swapped-in alternatives and "Show all" toggles reset on a variant switch.
 */
export function VariantDetail({
  variant,
  multiVariant,
  characterClass,
  diffs,
  craftData,
  skillData,
  tab,
  onTabChange,
}: VariantDetailProps) {
  // View-only alternative picks per section and slot (never saved), and the slots showing every alternative.
  const [picks, setPicks] = useState<SectionPicks>(NO_PICKS);
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(() => new Set());

  const pick = (section: SectionId, slot: string, index: number) => {
    setPicks((previous) => ({ ...previous, [section]: { ...previous[section], [slot]: index } }));
  };
  const toggleShowAll = (section: SectionId, slot: string) => {
    const key = `${section}.${slot}`;
    const on = !showAll.has(key);
    setShowAll((previous) => {
      const next = new Set(previous);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    // "Show all" lists the main item first, so the slot goes back to showing it.
    if (on) pick(section, slot, -1);
  };

  /** The footer and label tag of the slots with alternatives; none for a section without any (it renders as before). */
  const slotRenderers = <K extends EquipmentSlot | WeaponSwapSlot>(
    section: SectionId,
    main: { readonly items: Partial<Record<K, ItemRef | null>>; readonly notes: Partial<Record<K, string>> | undefined },
    alternatives: AlternativesMap<K> | undefined,
    alternativeDiffs: Partial<Record<K, readonly ItemDiff[]>> | undefined,
    shown: DisplayedSection<K>,
    setPiecesFor?: (slot: K, ref: ItemRef) => number | undefined
  ): SlotRenderers<K> => {
    if (!sectionHasAlternatives(alternatives)) return {};
    return {
      renderSlotFooter: (slot) => {
        const list = alternatives?.[slot] ?? [];
        if (list.length === 0) return null;
        return (
          <SlotAlternativesView
            slot={slot}
            mainItem={main.items[slot] ?? null}
            mainNote={main.notes?.[slot]}
            alternatives={list}
            alternativeDiffs={alternativeDiffs?.[slot]}
            shownIndex={shown.shownIndex[slot] ?? -1}
            onPick={(index) => {
              pick(section, slot, index);
            }}
            showAll={showAll.has(`${section}.${slot}`)}
            onToggleShowAll={() => {
              toggleShowAll(section, slot);
            }}
            craftData={craftData}
            setPiecesFor={
              setPiecesFor === undefined
                ? undefined
                : (ref) => {
                    return setPiecesFor(slot, ref);
                  }
            }
          />
        );
      },
      renderSlotLabelExtra: (slot) => {
        const list: readonly ItemAlternative[] = alternatives?.[slot] ?? [];
        const count = list.length;
        if (count === 0) return null;
        return (
          <SlotAlternativeLabel
            shownIndex={shown.shownIndex[slot] ?? -1}
            count={count}
            showAll={showAll.has(`${section}.${slot}`)}
            onBackToMain={() => {
              pick(section, slot, -1);
            }}
          />
        );
      },
    };
  };

  const playerMain = { items: variant.items ?? {}, notes: variant.itemNotes };
  const swapMain = { items: variant.weaponSwap ?? {}, notes: variant.weaponSwapNotes };
  const mercMain = { items: variant.mercenary ?? {}, notes: variant.mercenaryNotes };
  // What each section shows with the picks applied: it feeds the grids and the set bonuses alike.
  const player = displayedSection<EquipmentSlot>({
    ...playerMain,
    crafts: variant.itemCrafts,
    diffs: diffs?.items,
    alternatives: variant.itemAlternatives,
    alternativeDiffs: diffs?.alternatives.items,
    picks: picks.items,
  });
  const swap = displayedSection<WeaponSwapSlot>({
    ...swapMain,
    crafts: variant.weaponSwapCrafts,
    diffs: diffs?.weaponSwap,
    alternatives: variant.weaponSwapAlternatives,
    alternativeDiffs: diffs?.alternatives.weaponSwap,
    picks: picks.weaponSwap,
  });
  const merc = displayedSection<EquipmentSlot>({
    ...mercMain,
    crafts: variant.mercenaryCrafts,
    diffs: diffs?.mercenary,
    alternatives: variant.mercenaryAlternatives,
    alternativeDiffs: diffs?.alternatives.mercenary,
    picks: picks.mercenary,
  });

  const hasPlayerGear = Object.keys(compactItems(playerMain.items)).length > 0 || sectionHasAlternatives(variant.itemAlternatives);
  const hasSwap = Object.keys(compactItems(swapMain.items)).length > 0 || sectionHasAlternatives(variant.weaponSwapAlternatives);
  const hasMercTab = variantHasMerc(variant);
  const hasMercGear = Object.keys(compactItems(mercMain.items)).length > 0;
  const charms = variant.charms ?? [];
  const ascendancyName = variant.ascendancy ?? null;
  const skills = variant.skills ?? null;
  const level = variant.level ?? null;
  const skillPoints = variant.skillPoints;
  const hasSkillText = hasText(skills);
  const hasSkills = variantHasSkills(variant);
  // Charms + ascendancy sit beside the player gear on wide screens.
  const hasPlayerAside = variantHasPlayerAside(variant);
  const gearSideBySide = hasPlayerGear && hasSwap;
  const availableTabs: readonly DetailTab[] = [
    'player',
    ...(hasSkills ? (['skills'] as const) : []),
    ...(hasMercTab ? (['mercenary'] as const) : []),
  ];
  const activeTab: DetailTab = availableTabs.includes(tab) ? tab : 'player';

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        onTabChange(value as DetailTab);
      }}
      className="gap-4"
    >
      {availableTabs.length > 1 && (
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="player" className="sm:px-4">
            Player
          </TabsTrigger>
          {hasSkills && (
            <TabsTrigger value="skills" className="sm:px-4">
              Skills
            </TabsTrigger>
          )}
          {hasMercTab && (
            <TabsTrigger value="mercenary" className="sm:px-4">
              Mercenary
            </TabsTrigger>
          )}
        </TabsList>
      )}

      <TabsContent value="player">
        <div className={PLAYER_TAB_CLASS[hasPlayerAside ? 'aside' : 'noAside'][gearSideBySide ? 'fill' : 'capped']}>
          <section>
            <SectionHeader title="Equipment" />
            {hasPlayerGear || hasSwap ? (
              <div className={gearSideBySide ? GEAR_SIDE_BY_SIDE_CLASS : 'flex flex-col gap-6'}>
                {hasPlayerGear && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Player Gear</h3>
                    <EquipmentGrid
                      items={player.items}
                      diffs={player.diffs}
                      notes={player.notes}
                      crafts={player.crafts}
                      craftData={craftData}
                      {...slotRenderers('items', playerMain, variant.itemAlternatives, diffs?.alternatives.items, player, (slot, ref) =>
                        setPiecesIfWorn(player.items, slot, ref)
                      )}
                    />
                    {hasSetItems(player.items) && <SetBonusesBlock items={player.items} />}
                  </div>
                )}
                {hasSwap && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Weapon Swap</h3>
                    <WeaponSwapGrid
                      items={swap.items}
                      diffs={swap.diffs}
                      notes={swap.notes}
                      crafts={swap.crafts}
                      craftData={craftData}
                      {...slotRenderers('weaponSwap', swapMain, variant.weaponSwapAlternatives, diffs?.alternatives.weaponSwap, swap)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {`No ${hasMercGear ? 'player gear' : 'gear'} has been added to ${multiVariant ? 'this variant' : 'this build'} yet.`}
              </p>
            )}
          </section>

          {hasPlayerAside && (
            <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
              {charms.length > 0 && (
                <section>
                  <SectionHeader title="Charms" />
                  <div className="flex flex-wrap gap-2">
                    {charms.map((charm, index) => {
                      const key = `${String(index)}-${charm}`;
                      const { name, stats } = splitCharmLine(charm);
                      return stats === null ? (
                        <Badge key={key} variant="secondary">
                          {charm}
                        </Badge>
                      ) : (
                        <div key={key} className="w-full min-w-0 text-sm">
                          <div className="font-medium break-words">{name}</div>
                          <div className="text-muted-foreground break-words">{stats}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {ascendancyName !== null && (
                <section>
                  <SectionHeader title="Ascendancy" />
                  <AscendancyDisplay name={ascendancyName} />
                </section>
              )}
            </aside>
          )}
        </div>
      </TabsContent>

      {hasSkills && (
        <TabsContent value="skills">
          <section className="flex flex-col gap-4">
            <SectionHeader title="Skills" />
            {level !== null && <p className="text-sm font-medium">Level {level}</p>}
            {hasSkillText && <p className="whitespace-pre-wrap text-sm">{skills}</p>}
            {hasSkillPoints(skillPoints) && (
              <SkillTreeDisplay characterClass={characterClass} skillPoints={skillPoints} skillData={skillData} />
            )}
          </section>
        </TabsContent>
      )}

      {hasMercTab && (
        <TabsContent value="mercenary">
          <section>
            <SectionHeader title="Mercenary Gear" />
            <EquipmentGrid
              items={merc.items}
              diffs={merc.diffs}
              notes={merc.notes}
              crafts={merc.crafts}
              craftData={craftData}
              {...slotRenderers('mercenary', mercMain, variant.mercenaryAlternatives, diffs?.alternatives.mercenary, merc, (slot, ref) =>
                setPiecesIfWorn(merc.items, slot, ref)
              )}
            />
            {hasSetItems(merc.items) && <SetBonusesBlock items={merc.items} />}
          </section>
        </TabsContent>
      )}
    </Tabs>
  );
}
