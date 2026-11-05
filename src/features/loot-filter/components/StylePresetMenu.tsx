import { ChevronDown, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { STYLE_PRESETS, type StylePreset } from '../utils/stylePresets';
import { PresetPreview } from './PresetPreview';

interface StylePresetMenuProps {
  readonly onPick: (preset: StylePreset) => void;
}

/** "Add preset": the ready-made styles with a label preview and what each is for. */
export function StylePresetMenu({ onPick }: StylePresetMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Palette />
          Add preset
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          A preset is copied into the filter under its name; a style of that name you already have is kept.
        </DropdownMenuLabel>
        {STYLE_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            className="items-start gap-3"
            onSelect={() => {
              onPick(preset);
            }}
          >
            <PresetPreview preset={preset} className="w-36 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">
                {preset.label} <span className="font-mono text-xs text-muted-foreground">{preset.name}</span>
              </span>
              <span className="block text-xs text-muted-foreground">{preset.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
