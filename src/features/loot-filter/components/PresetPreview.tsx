import { cn } from '@/lib/utils';
import { presetPreviewText, type StylePreset } from '../utils/stylePresets';
import { LabelPreview } from './LabelPreview';

interface PresetPreviewProps {
  readonly preset: StylePreset;
  readonly className?: string;
}

/** A small ground label drawn with a style preset and its sample item name. */
export function PresetPreview({ preset, className }: PresetPreviewProps) {
  return (
    <LabelPreview
      text={presetPreviewText(preset)}
      background={preset.style.labelBackground}
      border={preset.style.labelBorder}
      className={cn('px-2 py-1.5 text-xs', className)}
    />
  );
}
