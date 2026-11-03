import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { TierBadge } from '@/features/game-data/components/TierBadge';
import { cn } from '@/lib/utils';
import { kindLabel, type ItemRow } from '../../engine/items/allItems';
import { formatLocation } from '../../engine/locations';
import { baseTypeText, EtherealBadge, ItemName } from './ItemParts';
import { SET_LINE_CLASS, STAT_LINE_CLASS } from './itemClasses';

interface ItemCardsProps {
  readonly rows: readonly ItemRow[];
}

/**
 * "Show all item information": one tooltip-style card per item with every line of its text, grouped like the game's
 * tooltip (base lines only while the stat text is loading or missing; the page says so above the filters).
 */
export function ItemCards({ rows }: ItemCardsProps) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <li key={row.key}>
          <ItemCard row={row} />
        </li>
      ))}
    </ul>
  );
}

function Lines({ lines, className }: { readonly lines: readonly string[]; readonly className?: string }) {
  if (lines.length === 0) return null;
  return (
    <ul className={cn('space-y-0.5', className)}>
      {lines.map((line, index) => (
        // Lines can repeat (two "+1 to All Skills" sources), so the index is part of the key
        <li key={`${String(index)}:${line}`}>{line}</li>
      ))}
    </ul>
  );
}

function ItemCard({ row }: { readonly row: ItemRow }) {
  const { text } = row;
  const facts = [kindLabel(row), row.item.level === null ? null : `Item level ${String(row.item.level)}`].filter((fact) => fact !== null);
  return (
    <article className="flex h-full flex-col gap-2 rounded-xl border bg-card p-3 text-center text-sm shadow-sm">
      <header className="flex flex-col items-center gap-1">
        <ItemIcon item={row.info.icon} size={48} />
        <ItemName row={row} quantity={false} />
        <span className="text-xs text-muted-foreground">{baseTypeText(row)}</span>
        {row.info.set !== null && <span className={cn('text-xs', SET_LINE_CLASS)}>{row.info.set.name}</span>}
      </header>
      <Lines lines={text.base} />
      <Lines lines={text.stats} className={STAT_LINE_CLASS} />
      {text.runeword.length > 0 && <Lines lines={text.runeword} className={STAT_LINE_CLASS} />}
      {row.socketed.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-xs text-muted-foreground">Socketed with</p>
          <ul className="space-y-1">
            {row.socketed.map((entry, index) => (
              <li key={`${String(index)}:${entry.name}`}>
                <span className="font-medium">{entry.name}</span>
                <Lines lines={entry.lines} className={cn('text-xs', STAT_LINE_CLASS)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {text.setBonuses.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          {text.setBonuses.map((bonus, index) => (
            <div key={`${String(index)}:${String(bonus.pieces)}`}>
              {bonus.pieces !== null && <p className="text-xs text-muted-foreground">({bonus.pieces} items)</p>}
              <Lines lines={bonus.lines} className={SET_LINE_CLASS} />
            </div>
          ))}
        </div>
      )}
      <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
        <span>{facts.join(' · ')}</span>
        {row.info.tier !== null && <TierBadge tier={row.info.tier} />}
        {row.item.ethereal && <EtherealBadge />}
        <span className="basis-full tabular-nums">{formatLocation(row.location)}</span>
      </footer>
    </article>
  );
}
