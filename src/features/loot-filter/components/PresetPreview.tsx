import type { MinimapIcon } from '../engine/types';
import type { StylePreset } from '../utils/stylePresets';
import { StylePreview } from './StylePreview';

interface PresetPreviewProps {
  readonly preset: StylePreset;
  /** The icon to draw instead of the preset's (a rule's own icon); null draws none. Default: the preset's icon. */
  readonly icon?: MinimapIcon | null;
  readonly className?: string;
}

/** A small ground label drawn with a style preset and its sample item name, its minimap icon beside it (`StylePreview`). */
export function PresetPreview({ preset, icon, className }: PresetPreviewProps) {
  return <StylePreview style={preset.style} sample={preset.sample} icon={icon} className={className} />;
}
