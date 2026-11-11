import { useEffect, useState, type ReactNode } from 'react';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { AscendancyDisplay } from '@/features/builds/components/AscendancyDisplay';
import { ItemCard } from '@/features/stash/components/items/ItemCards';
import { ToneBadge } from '@/features/stash/components/shared/ToneBadge';
import type { ItemRow } from '@/features/stash/engine/items/allItems';
import type { StashItem } from '@/features/stash/parser/types';
import { cn } from '@/lib/utils';
import type { CharacterItemsView, GearSlot } from '../../engine/characterItems';
import type { SheetAscendancy } from '../../engine/sheet/ascendancy';
import type { MercenaryFacts } from '../../engine/sheet/types';
import { mercenaryView } from '../../engine/sheetView';
import { useCharacterItems } from '../../hooks/useCharacterItems';
import { useCharacterSheet } from '../../hooks/useCharacterSheet';
import type { CharacterFile } from '../../parser/types';
import { AscendancySummary } from '../AscendancySummary';
import { GearDoll } from '../gear/GearDoll';
import { ItemTile } from '../gear/ItemTile';
import { CARD_CLASS } from './tabClasses';

/** What a selection key points at, and which section of the tab owns it (the narrow layout shows the card there) */
interface Selectable {
  readonly row: ItemRow;
  readonly where: string;
  readonly section: 'player' | 'charms' | 'merc';
}

/** The merc's doll always shows these; other slots only when filled */
const MERC_CORE_SLOTS: ReadonlySet<string> = new Set(['head', 'torso', 'rightHand', 'leftHand']);

const playerKey = (setIndex: 0 | 1) => (slot: GearSlot) =>
  slot.key === 'rightHand' || slot.key === 'leftHand' ? `p${String(setIndex + 1)}:${slot.key}` : `p:${slot.key}`;
const mercKey = (slot: GearSlot) => `m:${slot.key}`;

function selectables(view: CharacterItemsView): Map<string, Selectable> {
  const map = new Map<string, Selectable>();
  const add = (key: string, row: ItemRow | null, where: string, section: Selectable['section']) => {
    if (row !== null) map.set(key, { row, where, section });
  };
  for (const slot of view.worn) add(playerKey(0)(slot), slot.row, slot.label, 'player');
  view.weaponSets.forEach((set, index) => {
    for (const slot of set.slots)
      add(playerKey(index === 0 ? 0 : 1)(slot), slot.row, `${set.title}, ${slot.label.toLowerCase()}`, 'player');
  });
  for (const entry of view.charms) add(`c:${entry.key}`, entry.row, `Charm Inventory, ${entry.where.toLowerCase()}`, 'charms');
  for (const slot of view.mercenary?.slots ?? []) add(mercKey(slot), slot.row, `Mercenary, ${slot.label.toLowerCase()}`, 'merc');
  return map;
}

/** The card shown first: the active weapon, else the first worn item, else nothing */
function firstSelection(view: CharacterItemsView, items: ReadonlyMap<string, Selectable>): string | null {
  const active = view.weaponSets[0].active ? 0 : 1;
  const order = [...view.weaponSets[active].slots.map(playerKey(active)), ...view.worn.map(playerKey(0))];
  return order.find((key) => items.has(key)) ?? null;
}

function SelectedCard({ entry }: { readonly entry: Selectable | undefined }) {
  if (entry === undefined) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Pick an item to see its full tooltip.</p>
    );
  }
  return <ItemCard row={entry.row} where={entry.where} />;
}

interface GearSectionProps {
  readonly id: string;
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** The selected card, shown under the section on narrow pages (the wide layout has the side column) */
  readonly inlineCard?: ReactNode;
}

function GearSection({ id, title, actions, children, inlineCard }: GearSectionProps) {
  return (
    <section aria-labelledby={id} className={cn(CARD_CLASS, 'space-y-3')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
        </h3>
        {actions}
      </div>
      {children}
      {inlineCard !== undefined && <div className="@5xl/page:hidden">{inlineCard}</div>}
    </section>
  );
}

interface WeaponSetSwitchProps {
  readonly view: CharacterItemsView;
  readonly shown: 0 | 1;
  readonly onShow: (index: 0 | 1) => void;
}

function WeaponSetSwitch({ view, shown, onShow }: WeaponSetSwitchProps) {
  return (
    <div role="group" aria-label="Weapon set shown" className="inline-flex rounded-md border bg-muted/40 p-0.5">
      {view.weaponSets.map((set, index) => (
        <button
          key={set.number}
          type="button"
          aria-pressed={shown === index}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            shown === index ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => {
            onShow(index === 0 ? 0 : 1);
          }}
        >
          {set.number === 1 ? 'Set I' : 'Set II'}
          {set.active && <span className={shown === index ? 'opacity-80' : 'text-emerald-600 dark:text-emerald-400'}>(active)</span>}
        </button>
      ))}
    </div>
  );
}

/** The ascendancy from the computed sheet's facts (saved stats, or an old stone), with its tier bonuses card */
function AscendancySection({ ascendancy }: { readonly ascendancy: SheetAscendancy | null | undefined }) {
  const name = ascendancy?.name ?? null;
  return (
    <section aria-labelledby="character-ascendancy" className={cn(CARD_CLASS, 'space-y-2')}>
      <h3 id="character-ascendancy" className="font-semibold">
        Ascendancy
      </h3>
      <AscendancySummary ascendancy={ascendancy} />
      {name !== null && <AscendancyDisplay name={name} />}
    </section>
  );
}

/** The mercenary's type, act and level from the computed sheet's facts (the level derived from its experience) */
function MercenaryFactsLine({ merc }: { readonly merc: MercenaryFacts }) {
  const facts = mercenaryView(merc);
  return (
    <div className="text-sm">
      <p>
        <span className="font-medium">{facts.title}</span>
        {facts.hired !== null && <span className="text-muted-foreground">, {facts.hired}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {facts.level === null ? 'Level unknown' : facts.level} ({facts.experience} experience; the level is worked out from the experience
        and not yet checked in game)
      </p>
    </div>
  );
}

/** The selection key of an item object (the Overview's "show on the Gear tab"), or null when the tab does not show it */
function keyOfItem(items: ReadonlyMap<string, Selectable>, item: StashItem | null): string | null {
  if (item === null) return null;
  for (const [key, entry] of items) if (entry.row.item === item) return key;
  return null;
}

interface GearViewProps {
  readonly view: CharacterItemsView;
  readonly merc: MercenaryFacts | null;
  /** The sheet's ascendancy; undefined while the sheet is not there */
  readonly ascendancy: SheetAscendancy | null | undefined;
  /** Open on this item (selected, its weapon set shown, scrolled to) */
  readonly focusItem: StashItem | null;
}

function GearView({ view, merc: mercFacts, ascendancy, focusItem }: GearViewProps) {
  const items = selectables(view);
  const activeSet = view.weaponSets[0].active ? 0 : 1;
  const focusKey = keyOfItem(items, focusItem);
  const [shownSet, setShownSet] = useState<0 | 1>(() =>
    focusKey?.startsWith('p2:') === true ? 1 : focusKey?.startsWith('p1:') === true ? 0 : activeSet
  );
  const [picked, setPicked] = useState<string | null>(() => focusKey ?? firstSelection(view, items));
  const focusedSection = focusKey === null ? null : (items.get(focusKey)?.section ?? null);
  // Once, on opening from the Overview: bring the item's section into view (the card shows beside or under it)
  useEffect(() => {
    if (focusedSection === null) return;
    const id = { player: 'character-gear', charms: 'character-charms', merc: 'character-merc' }[focusedSection];
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [focusedSection]);
  const selectedKey = picked !== null && items.has(picked) ? picked : null;
  const selected = selectedKey === null ? undefined : items.get(selectedKey);
  const cardIn = (section: Selectable['section']) => (selected?.section === section ? <SelectedCard entry={selected} /> : undefined);
  const select = (key: string) => {
    setPicked(key);
  };
  const merc = view.mercenary;

  return (
    <div className="grid gap-4 @5xl/page:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="min-w-0 space-y-4">
        <GearSection
          id="character-gear"
          title="Equipped"
          actions={<WeaponSetSwitch view={view} shown={shownSet} onShow={setShownSet} />}
          inlineCard={cardIn('player')}
        >
          <GearDoll
            slots={[...view.worn, ...view.weaponSets[shownSet].slots]}
            keyOf={playerKey(shownSet)}
            selected={selectedKey}
            onSelect={select}
          />
        </GearSection>

        <GearSection
          id="character-charms"
          title={
            <>
              Charm Inventory <span className="font-normal text-muted-foreground tabular-nums">({view.charms.length})</span>
            </>
          }
          inlineCard={cardIn('charms')}
        >
          {view.charms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the Charm Inventory.</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {view.charms.map((entry) => (
                <li key={entry.key} className="flex">
                  <ItemTile
                    row={entry.row}
                    iconSize={36}
                    className="w-full"
                    selected={selectedKey === `c:${entry.key}`}
                    onSelect={() => {
                      select(`c:${entry.key}`);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </GearSection>

        <AscendancySection ascendancy={ascendancy} />

        <GearSection
          id="character-merc"
          title={
            <>
              Mercenary
              {merc?.dead === true && <ToneBadge label="Dead" tone="warning" />}
            </>
          }
          inlineCard={cardIn('merc')}
        >
          {merc === null ? (
            <p className="text-sm text-muted-foreground">No mercenary hired on this character.</p>
          ) : (
            <>
              {mercFacts !== null && <MercenaryFactsLine merc={mercFacts} />}
              <GearDoll
                slots={merc.slots.filter((slot) => slot.row !== null || MERC_CORE_SLOTS.has(slot.key))}
                keyOf={mercKey}
                selected={selectedKey}
                onSelect={select}
              />
              <p className="text-xs text-muted-foreground">
                Per-level stats on the mercenary&apos;s gear read as the rate per level: the save holds only its experience.
              </p>
            </>
          )}
        </GearSection>
      </div>

      <aside aria-label="Selected item" className="hidden @5xl/page:block">
        <div className="sticky top-4">
          <SelectedCard entry={selected} />
        </div>
      </aside>
    </div>
  );
}

/** Gear: the equipped slots with both weapon sets, the Charm Inventory, the Ascendancy and the mercenary; every item opens its full card. */
export function GearTab({ character, focusItem }: { readonly character: CharacterFile; readonly focusItem: StashItem | null }) {
  const items = useCharacterItems(character);
  // Only the mercenary and ascendancy facts: the gear shows without them while they load (or when they cannot be loaded)
  const sheet = useCharacterSheet(character);
  if (items.status === 'loading') return <GameDataLoading />;
  if (items.status === 'error') return <GameDataError error={items.error} onRetry={items.retry} />;
  // Remounts per character: the selection and the shown weapon set belong to one character
  return (
    <GearView
      key={`${character.name}:${String(character.lastSavedAt)}`}
      view={items.view}
      merc={sheet.status === 'ready' ? sheet.sheet.facts.mercenary : null}
      ascendancy={sheet.status === 'ready' ? sheet.sheet.facts.ascendancy : undefined}
      focusItem={focusItem}
    />
  );
}
