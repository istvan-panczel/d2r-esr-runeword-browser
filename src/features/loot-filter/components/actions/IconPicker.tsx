import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, FileQuestion, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { LabelColor } from '../../engine/types';
import { findBundledIconAsset } from '../../utils/bundledAssets';
import { filterIcons, gridMove } from '../../utils/iconPicker';
import { IconThumb } from './IconThumb';

/** Tiles per row; the arrow keys move by this much up and down. */
const COLUMNS = 4;

interface IconPickerProps {
  /** The trigger button's id (the field label's `htmlFor`). */
  readonly id: string;
  readonly iconName: string;
  /** The icon's tint, for the trigger's thumbnail. */
  readonly color?: LabelColor;
  readonly onPick: (iconName: string) => void;
}

/**
 * The minimap icon file: a button with the current icon that opens a grid of every bundled icon (generated ones first,
 * then Sully's) with a search box, arrow-key navigation and "Custom file name…" for the user's own .sprite.
 */
export function IconPicker({ id, iconName, color, onPick }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [custom, setCustom] = useState<string | null>(null);
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${String(index)}`;
  const current = findBundledIconAsset(iconName);
  const icons = filterIcons(query);
  const typed = query.trim();

  const activeId = active >= 0 && active < icons.length ? optionId(active) : undefined;

  // Keeps the tile the arrow keys reach in view.
  useEffect(() => {
    if (open && activeId !== undefined) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeId]);

  const openChange = (next: boolean) => {
    setOpen(next);
    setQuery('');
    setCustom(null);
    // Opens on the current icon, so the arrows start from it.
    setActive(next ? filterIcons('').findIndex((asset) => asset.name === current?.name) : -1);
  };

  const pick = (name: string) => {
    onPick(name);
    openChange(false);
  };

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = icons.at(active);
      if (chosen !== undefined && active >= 0) pick(chosen.name);
      else if (icons.length === 0 && typed !== '') pick(typed);
      return;
    }
    // Home / End stay the text box's (caret) keys.
    if (event.key === 'Home' || event.key === 'End') return;
    const next = gridMove(active, event.key, icons.length, COLUMNS);
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  };

  const commitCustom = () => {
    const name = (custom ?? '').trim();
    if (name !== '') pick(name);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="h-auto min-h-9 w-full min-w-0 justify-between gap-2 py-1 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <IconThumb iconName={iconName} size={22} color={color} />
            <span className="min-w-0 text-left">
              <span className="block truncate font-mono text-sm">{iconName === '' ? 'No file name' : iconName}</span>
              <span className="block truncate text-xs text-muted-foreground">{current?.label ?? 'Your own .sprite file'}</span>
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(30rem,calc(100vw-2rem))] p-0" align="start">
        <div className="flex h-9 items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 opacity-50" aria-hidden />
          <input
            className="h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search icons (name, colour, use)…"
            role="combobox"
            aria-label="Search icons"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={activeId}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(event.target.value.trim() === '' ? -1 : 0);
            }}
            onKeyDown={handleKey}
          />
        </div>
        {icons.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm">
            <p>No bundled icon matches.</p>
            {typed !== '' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  pick(typed);
                }}
              >
                Use “{typed}” as the file name
              </Button>
            )}
          </div>
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-label="Bundled minimap icons"
            className="grid max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-7.5rem))] grid-cols-4 gap-1 overflow-y-auto p-2"
          >
            {icons.map((asset, index) => {
              const selected = asset.name === current?.name;
              return (
                <div
                  key={asset.name}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  title={`${asset.label}: ${asset.use}`}
                  className={cn(
                    'relative flex cursor-pointer flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-center',
                    index === active && 'bg-accent text-accent-foreground',
                    selected && 'border-primary'
                  )}
                  onMouseMove={() => {
                    if (active !== index) setActive(index);
                  }}
                  onClick={() => {
                    pick(asset.name);
                  }}
                >
                  <IconThumb iconName={asset.name} size={32} />
                  {/* Narrow tiles wrap a long name after its underscore (crown_ / purple), not mid-word. */}
                  <span className="w-full font-mono text-[0.65rem] leading-tight [overflow-wrap:anywhere]">
                    {asset.name.split('_').map((part, position) => (
                      <span key={part}>
                        {position > 0 && (
                          <>
                            _<wbr />
                          </>
                        )}
                        {part}
                      </span>
                    ))}
                  </span>
                  {selected && <Check className="absolute top-1 right-1 size-3.5 text-primary" aria-hidden />}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-col gap-2 border-t p-2">
          <p className="px-1 text-xs text-muted-foreground">
            First the icons drawn for this app (one per style preset), then Sully&apos;s. Arrow keys move, Enter picks.
          </p>
          {custom === null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setCustom(current === undefined ? iconName : '');
              }}
            >
              <FileQuestion />
              Custom file name…
            </Button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                commitCustom();
              }}
            >
              <Input
                aria-label="Your own .sprite file name"
                className="h-8 font-mono text-sm"
                placeholder="myicon (.sprite may be left off)"
                autoComplete="off"
                autoFocus
                value={custom}
                onChange={(event) => {
                  setCustom(event.target.value);
                }}
              />
              <Button type="submit" size="sm" disabled={custom.trim() === ''}>
                Use
              </Button>
            </form>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
