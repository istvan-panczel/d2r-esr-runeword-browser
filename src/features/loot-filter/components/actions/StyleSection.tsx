import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { LootFilter, LootFilterStyle, RuleActions } from '../../engine/types';
import { findStyle, previewLabelText } from '../../utils/effectiveActions';
import type { StyleTarget } from '../../utils/styleChoice';
import { STYLE_PRESETS } from '../../utils/stylePresets';
import { Field } from '../Field';
import { LabelPreview } from '../LabelPreview';
import { PresetPreview } from '../PresetPreview';
import { IconThumb } from './IconThumb';
import { Section } from './Section';
import { StyleSummary } from './StyleSummary';

interface StyleSectionProps {
  /** Prefix of the controls' ids. */
  readonly idPrefix: string;
  /** The rule's own actions. */
  readonly actions: RuleActions;
  /** The whole filter, for its style list. */
  readonly filter: LootFilter;
  /** A pick: None, one of the filter's styles, or a preset (added to the filter when it has none of that name). */
  readonly onChoose: (target: StyleTarget) => void;
  /** Shown after the field's label (the Basic view's "advanced" tag). */
  readonly badge?: React.ReactNode;
}

/** A filter style's look: its label with "Item Name", and its minimap icon when it has one. */
function StyleLook({ style, className }: { readonly style: LootFilterStyle; readonly className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-1', className)}>
      <LabelPreview
        text={style.hide === true ? '' : previewLabelText(style)}
        background={style.labelBackground}
        border={style.labelBorder}
        className="min-w-0 flex-1 px-2 py-1.5 text-xs"
      />
      {style.icon !== undefined && <IconThumb iconName={style.icon.iconName} size={18} color={style.icon.color} />}
    </span>
  );
}

/**
 * A rule's `useStyle`: a searchable picker with the filter's styles and the presets the filter lacks, each with its
 * label preview, then a collapsed summary of the chosen style's actions. Picking clears the rule's own values for the
 * keys the style sets (the caller does it, with an Undo toast).
 */
export function StyleSection({ idPrefix, actions, filter, onChoose, badge }: StyleSectionProps) {
  const [open, setOpen] = useState(false);
  const selectId = `${idPrefix}-use-style`;
  const style = findStyle(actions, filter);
  const styles = filter.styles ?? {};
  const entries = Object.entries(styles);
  // A preset whose name the filter already has is listed once, as the filter's own style.
  const presets = STYLE_PRESETS.filter((preset) => !Object.hasOwn(styles, preset.name));
  const missing = actions.useStyle !== undefined && style === undefined ? actions.useStyle : undefined;

  let hint: string;
  if (actions.useStyle === undefined)
    hint = 'A named look from the Styles tab or a preset. Picking one clears what this rule sets itself for the same fields.';
  else if (style === undefined) hint = `The filter has no style "${actions.useStyle}".`;
  else hint = "The style's values show in the fields below; change one to override it for this rule.";

  const choose = (target: StyleTarget) => {
    setOpen(false);
    onChoose(target);
  };

  return (
    <Section title="Style">
      <Field id={selectId} label="Use style" hint={hint} badge={badge}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={selectId}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-auto min-h-9 w-full justify-between gap-2 py-1 font-normal sm:w-96"
            >
              <span className="flex min-w-0 items-center gap-2">
                {style !== undefined && <StyleLook style={style} className="w-28" />}
                <span className={cn('truncate', actions.useStyle === undefined && 'text-muted-foreground')}>
                  {actions.useStyle === undefined ? 'None' : actions.useStyle}
                  {missing !== undefined && ' (missing)'}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(30rem,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search styles and presets…" />
              <CommandList className="max-h-[min(26rem,calc(var(--radix-popover-content-available-height)-2.5rem))]">
                <CommandEmpty>No style or preset matches.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__none"
                    keywords={['none', 'no style']}
                    onSelect={() => {
                      choose({ kind: 'none' });
                    }}
                  >
                    <Check className={cn('size-4', actions.useStyle === undefined ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    None
                  </CommandItem>
                </CommandGroup>
                {(entries.length > 0 || missing !== undefined) && (
                  <CommandGroup heading="In this filter">
                    {missing !== undefined && (
                      <CommandItem value={`style:${missing}`} keywords={[missing]} disabled>
                        <Check className="size-4" aria-hidden />
                        {missing} (missing)
                      </CommandItem>
                    )}
                    {entries.map(([name, entry]) => (
                      <CommandItem
                        key={name}
                        value={`style:${name}`}
                        keywords={[name]}
                        onSelect={() => {
                          choose({ kind: 'style', name });
                        }}
                      >
                        <Check className={cn('size-4 shrink-0', actions.useStyle === name ? 'opacity-100' : 'opacity-0')} aria-hidden />
                        <StyleLook style={entry} className="w-36" />
                        <span className="min-w-0 truncate">{name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {presets.length > 0 && (
                  <CommandGroup heading="Presets (added to the filter when picked)">
                    {presets.map((preset) => (
                      <CommandItem
                        key={preset.id}
                        value={`preset:${preset.id}`}
                        keywords={[preset.name, preset.label, preset.description]}
                        className="items-start"
                        onSelect={() => {
                          choose({ kind: 'preset', preset });
                        }}
                      >
                        <span className="size-4 shrink-0" aria-hidden />
                        <PresetPreview preset={preset} className="w-36 shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {preset.label} <span className="font-mono text-xs text-muted-foreground">{preset.name}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">{preset.description}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </Field>
      {style !== undefined && actions.useStyle !== undefined && <StyleSummary name={actions.useStyle} style={style} />}
    </Section>
  );
}
