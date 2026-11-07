import { createContext, use, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { BASE_TIER_LABELS, TIER_BADGE_CLASS } from '@/features/game-data/constants/bases';
import { cn } from '@/lib/utils';
import {
  columnItems,
  groupCodes,
  triState,
  typeCodes,
  type BaseTier,
  type BrowserColumn,
  type BrowserGroup,
  type BrowserItem,
  type BrowserType,
  type TriState,
} from '../../utils/browserModel';

/** True when the cells' `code` is an item code whose icon (icons.json by code) goes in front of the name */
const CodeIconsContext = createContext(false);

/** Side of the cell icons */
const CELL_ICON_SIZE = 24;

/** Adds (`on`) or removes the codes from the draft. */
export type ToggleCodes = (codes: readonly string[], on: boolean) => void;

interface SelectionProps {
  readonly selected: ReadonlySet<string>;
  readonly onToggle: ToggleCodes;
}

export function TierBadge({ tier, className }: { readonly tier: BaseTier; readonly className?: string }) {
  return (
    <Badge variant="outline" className={cn('px-1.5 py-0 text-[11px]', TIER_BADGE_CLASS[tier], className)}>
      {BASE_TIER_LABELS[tier]}
    </Badge>
  );
}

/** A column's badge: the tier badge for base tiers, else a plain label. */
export function ColumnBadge({ column, className }: { readonly column: BrowserColumn; readonly className?: string }) {
  if (column.tier !== undefined) return <TierBadge tier={column.tier} className={className} />;
  return (
    <Badge variant="outline" className={cn('px-1.5 py-0 text-[11px] text-muted-foreground', className)}>
      {column.label}
    </Badge>
  );
}

interface TriCheckboxProps {
  readonly state: TriState;
  /** Called with true to select every code (from "none" or "some"), false to clear them. */
  readonly onChange: (on: boolean) => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

/** A native checkbox with a label; "some" shows as indeterminate (announced as mixed). */
export function TriCheckbox({ state, onChange, disabled, children, className }: TriCheckboxProps) {
  return (
    <label className={cn('inline-flex items-center gap-2', disabled === true ? 'opacity-50' : 'cursor-pointer', className)}>
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        checked={state === 'all'}
        ref={(element) => {
          if (element !== null) element.indeterminate = state === 'some';
        }}
        disabled={disabled}
        onChange={() => {
          onChange(state !== 'all');
        }}
      />
      {children}
    </label>
  );
}

function SelectedCount({ codes, selected }: { readonly codes: readonly string[]; readonly selected: ReadonlySet<string> }) {
  const count = codes.filter((code) => selected.has(code)).length;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {count}/{codes.length}
    </span>
  );
}

// Static class names per column count (Tailwind only sees literal class names).
const MD_GRID_COLS: Readonly<Record<number, string>> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

const mdGridCols = (count: number) => MD_GRID_COLS[count] ?? 'md:grid-cols-6';

/** The cell grid of a list: four columns on wide screens when the cells have no stats line. */
function listGridClass(items: readonly BrowserItem[]) {
  return cn(
    'grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 md:gap-2',
    items.every((item) => (item.stats ?? '') === '') && 'lg:grid-cols-4'
  );
}

interface ItemCellProps {
  readonly item: BrowserItem;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: ToggleCodes;
  /** The column badge, with classes; without it the cell has no badge. */
  readonly badge?: { readonly column: BrowserColumn; readonly className: string };
}

function ItemCell({ item, selected, onToggle, badge }: ItemCellProps) {
  const codes = item.codes ?? [item.code];
  // A merged cell (several unique rows) can be partly selected through values typed into the picker.
  const state = triState(codes, selected);
  const disabled = item.disabled !== undefined;
  const codeIcons = use(CodeIconsContext);
  return (
    <label
      title={item.sockets === undefined ? item.title : `Sockets: ${item.sockets}`}
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-md border px-2 py-1.5 has-checked:border-primary/50 has-checked:bg-primary/5',
        disabled ? 'opacity-60' : 'cursor-pointer hover:bg-accent/50'
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={state === 'all'}
        ref={(element) => {
          if (element !== null) element.indeterminate = state === 'some';
        }}
        disabled={disabled}
        onChange={() => {
          onToggle(codes, state !== 'all');
        }}
      />
      {codeIcons && <ItemIcon item={{ kind: 'item', code: item.code }} size={CELL_ICON_SIZE} className="-my-0.5" />}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-sm font-medium break-words">{item.name}</span>
          {(item.tag ?? item.code) !== '' && <span className="font-mono text-xs text-muted-foreground">{item.tag ?? item.code}</span>}
          {badge !== undefined && <ColumnBadge column={badge.column} className={badge.className} />}
        </span>
        {item.stats !== undefined && item.stats !== '' && <span className="block text-xs text-muted-foreground">{item.stats}</span>}
        {disabled && <span className="block text-xs text-muted-foreground italic">{item.disabled}</span>}
      </span>
    </label>
  );
}

/** A column's checkbox: every (shown) item of the type in that column. */
function ColumnCheckbox({
  type,
  column,
  selected,
  onToggle,
}: SelectionProps & { readonly type: BrowserType; readonly column: BrowserColumn }) {
  const codes = typeCodes(type, column.key);
  return (
    <TriCheckbox
      state={triState(codes, selected)}
      disabled={codes.length === 0}
      onChange={(on) => {
        onToggle(codes, on);
      }}
    >
      <ColumnBadge column={column} />
      <SelectedCount codes={codes} selected={selected} />
    </TriCheckbox>
  );
}

/** The items below a grid or the columns, under the extras column's checkbox when they share one. */
function Extras({ type, selected, onToggle }: SelectionProps & { readonly type: BrowserType }) {
  if (type.extras.length === 0) return null;
  return (
    // Without a heading, a little space sets the extras apart from the grid rows.
    <div className={cn('space-y-2', type.extrasColumn === null && (type.rows.length > 0 || type.layout === 'columns') && 'pt-3')}>
      {type.extrasColumn !== null && <ColumnCheckbox type={type} column={type.extrasColumn} selected={selected} onToggle={onToggle} />}
      <div className={type.extrasColumn === null ? listGridClass(type.extras) : 'grid grid-cols-1 gap-1 md:grid-cols-3 md:gap-2'}>
        {type.extras.map((item) => (
          <ItemCell
            key={item.code}
            item={item}
            selected={selected}
            onToggle={onToggle}
            badge={type.extrasColumn === null ? listBadge(item) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** The items side by side by column, each column a list under its checkbox (stacked on narrow screens). */
function ColumnLists({ type, selected, onToggle }: SelectionProps & { readonly type: BrowserType }) {
  return (
    <>
      <div className={cn('grid grid-cols-1 gap-3 md:gap-2', mdGridCols(type.columns.length))}>
        {type.columns.map((column) => {
          const items = columnItems(type, column.key);
          return (
            <div key={column.key} className={cn('min-w-0 space-y-1 md:space-y-2', items.length === 0 && 'hidden md:block')}>
              <ColumnCheckbox type={type} column={column} selected={selected} onToggle={onToggle} />
              {items.map((item) => (
                <ItemCell key={item.code} item={item} selected={selected} onToggle={onToggle} />
              ))}
            </div>
          );
        })}
      </div>
      <Extras type={type} selected={selected} onToggle={onToggle} />
    </>
  );
}

function ColumnGrid({ type, selected, onToggle }: SelectionProps & { readonly type: BrowserType }) {
  const cols = mdGridCols(type.columns.length);
  return (
    <>
      <div className={cn('flex flex-wrap gap-x-4 gap-y-1 md:grid md:gap-2', cols)}>
        {type.columns.map((column) => (
          <ColumnCheckbox key={column.key} type={type} column={column} selected={selected} onToggle={onToggle} />
        ))}
      </div>
      {type.rows.length > 0 && (
        <div className="space-y-3 md:space-y-2">
          {type.rows.map((row) => (
            <div key={row.key} className={cn('grid grid-cols-1 gap-1 md:gap-2', cols)}>
              {type.columns.map((column, index) => {
                const cell = row.cells[index] ?? null;
                if (cell === null) return <div key={column.key} className="hidden md:block" />;
                return (
                  <ItemCell
                    key={column.key}
                    item={cell}
                    selected={selected}
                    onToggle={onToggle}
                    badge={{ column, className: 'md:hidden' }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
      <Extras type={type} selected={selected} onToggle={onToggle} />
    </>
  );
}

/** A list cell shows the column badge of a base outside the normal tier (Mythical rings…). */
function listBadge(item: BrowserItem): ItemCellProps['badge'] {
  return item.column?.tier !== undefined && item.column.tier !== 'normal' ? { column: item.column, className: '' } : undefined;
}

function TypeBlock({ type, selected, onToggle }: SelectionProps & { readonly type: BrowserType }) {
  const codes = typeCodes(type);
  return (
    <section className="space-y-2" aria-label={type.name}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <TriCheckbox
          state={triState(codes, selected)}
          onChange={(on) => {
            onToggle(codes, on);
          }}
        >
          <span className="font-medium">{type.name}</span>
        </TriCheckbox>
        {(type.tag ?? type.code) !== '' && <span className="font-mono text-xs text-muted-foreground">{type.tag ?? type.code}</span>}
        <SelectedCount codes={codes} selected={selected} />
      </div>
      {type.layout === 'grid' ? (
        <ColumnGrid type={type} selected={selected} onToggle={onToggle} />
      ) : type.layout === 'columns' ? (
        <ColumnLists type={type} selected={selected} onToggle={onToggle} />
      ) : (
        <div className={listGridClass(type.items)}>
          {type.items.map((item) => (
            <ItemCell key={item.code} item={item} selected={selected} onToggle={onToggle} badge={listBadge(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A type group (Weapons, Armor, Gems…): collapsible, with a checkbox for all its (shown) items. `codeIcons`: the cells
 * are item codes (bases, misc items), shown with their icon.
 */
export function BrowserGroupSection({
  group,
  selected,
  onToggle,
  codeIcons = false,
}: SelectionProps & { readonly group: BrowserGroup; readonly codeIcons?: boolean }) {
  const [open, setOpen] = useState(true);
  const contentId = useId();
  const codes = groupCodes(group);
  return (
    <section className="rounded-lg border" aria-label={group.label}>
      <div className="flex items-center gap-2 rounded-t-lg bg-muted/40 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${group.label}`}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} aria-hidden />
        </Button>
        <TriCheckbox
          state={triState(codes, selected)}
          onChange={(on) => {
            onToggle(codes, on);
          }}
        >
          <span className="font-semibold">{group.label}</span>
        </TriCheckbox>
        <SelectedCount codes={codes} selected={selected} />
      </div>
      {open && (
        <CodeIconsContext value={codeIcons}>
          <div id={contentId} className="space-y-5 p-3">
            {group.types.map((type) => (
              <TypeBlock key={type.code} type={type} selected={selected} onToggle={onToggle} />
            ))}
          </div>
        </CodeIconsContext>
      )}
    </section>
  );
}
