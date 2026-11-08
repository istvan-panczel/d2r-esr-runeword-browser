import { ToneBadge } from '@/features/stash/components/shared/ToneBadge';
import { ItemCard } from '@/features/stash/components/items/ItemCards';
import type { CharacterItemsView, GearGroup, ItemSection } from '../engine/characterItems';

const GRID_CLASS =
  'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 @8xl/page:grid-cols-5 @9xl/page:grid-cols-6 @10xl/page:grid-cols-7 @11xl/page:grid-cols-8';

function GearGroupView({ group }: { readonly group: GearGroup }) {
  return (
    <section className="space-y-2" aria-label={group.title}>
      <h3 className="flex items-center gap-2 font-semibold">
        {group.title}
        {group.active && <ToneBadge label="Active" tone="success" />}
      </h3>
      {group.slots.length === 0 && <p className="text-sm text-muted-foreground">Nothing equipped.</p>}
      <ul className={GRID_CLASS}>
        {group.slots.map((slot) => (
          <li key={slot.key} className="flex flex-col">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{slot.label}</p>
            {slot.row === null ? (
              <p className="flex min-h-16 flex-1 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
                Empty
              </p>
            ) : (
              <ItemCard row={slot.row} where={slot.label} className="flex-1" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemSectionView({ section }: { readonly section: ItemSection }) {
  return (
    <section className="space-y-2" aria-label={section.title}>
      <h3 className="font-semibold">
        {section.title} <span className="font-normal text-muted-foreground tabular-nums">({section.rows.length})</span>
      </h3>
      {section.note !== undefined && <p className="text-xs text-muted-foreground">{section.note}</p>}
      <ul className={GRID_CLASS}>
        {section.rows.map((entry) => (
          <li key={entry.key}>
            <ItemCard row={entry.row} where={entry.where} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Gear by slot, the mercenary's gear, then the stored items, every item in the All Items tooltip card */
export function CharacterItemSections({ view }: { readonly view: CharacterItemsView }) {
  return (
    <div className="space-y-6">
      {view.gear.map((group) => (
        <GearGroupView key={group.key} group={group} />
      ))}
      {view.mercenary === null ? (
        <p className="text-sm text-muted-foreground">No mercenary hired on this character.</p>
      ) : (
        <div className="space-y-2">
          {view.mercenary.dead && <ToneBadge label="Mercenary is dead" tone="warning" />}
          {view.mercenary.gear.map((group) => (
            <GearGroupView key={group.key} group={group} />
          ))}
          <p className="text-xs text-muted-foreground">
            Per-level stats on the mercenary&apos;s gear read as the rate per level: the save does not hold its level.
          </p>
        </div>
      )}
      {view.sections.map((section) => (
        <ItemSectionView key={section.key} section={section} />
      ))}
    </div>
  );
}
