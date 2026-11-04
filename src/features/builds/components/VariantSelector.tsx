import { cn } from '@/lib/utils';
import { DEFAULT_VARIANT_NAME } from '../constants';

interface VariantSelectorProps {
  /** The variant labels in order (variantLabel). */
  readonly labels: readonly string[];
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
  /** The active variant's note, shown under the row. */
  readonly note: string | undefined;
}

/** The detail page's variant row: one segment per variant, scrolling sideways when the labels don't fit. */
export function VariantSelector({ labels, activeIndex, onSelect, note }: VariantSelectorProps) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="overflow-x-auto">
        <div role="group" aria-label="Build variants" className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-[3px]">
          {labels.map((label, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={`${String(index)}-${label}`}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect(index);
                }}
                className={cn(
                  'inline-flex h-full items-center rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active
                    ? 'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <VariantNote note={note} />
    </div>
  );
}

/** A variant note (muted, line breaks kept); nothing when blank. */
function VariantNote({ note }: { readonly note: string | undefined }) {
  const text = note?.trim();
  if (text === undefined || text.length === 0) return null;
  return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{text}</p>;
}

interface SingleVariantHeaderProps {
  readonly name: string | undefined;
  readonly note: string | undefined;
}

/**
 * The name and note of a build's only variant (no selector to show them in). Nothing when the variant has neither a
 * custom name (anything but "Default") nor a note, so such builds look as they did before variants.
 */
export function SingleVariantHeader({ name, note }: SingleVariantHeaderProps) {
  const customName = name?.trim();
  const shownName = customName !== undefined && customName.length > 0 && customName !== DEFAULT_VARIANT_NAME ? customName : null;
  const hasNote = (note?.trim().length ?? 0) > 0;
  if (shownName === null && !hasNote) return null;
  return (
    <div className="mb-4 flex flex-col gap-1">
      {shownName !== null && <h2 className="text-base font-semibold">{shownName}</h2>}
      <VariantNote note={note} />
    </div>
  );
}
