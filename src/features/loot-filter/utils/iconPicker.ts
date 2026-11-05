/** The minimap icon picker's list and keyboard moves (components/actions/IconPicker.tsx). */
import { BUNDLED_ICON_ASSETS, isGeneratedIcon, type BundledIconAsset } from './bundledAssets';

/** Every bundled icon in picker order: the generated ones first (one per style preset), then Sully's. */
export const ICON_PICKER_ICONS: readonly BundledIconAsset[] = [
  ...BUNDLED_ICON_ASSETS.filter(isGeneratedIcon),
  ...BUNDLED_ICON_ASSETS.filter((asset) => !isGeneratedIcon(asset)),
];

/** The icons whose name, label or use holds the query (any case, anywhere in the text: no prefix match). */
export function filterIcons(query: string, icons: readonly BundledIconAsset[] = ICON_PICKER_ICONS): readonly BundledIconAsset[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return icons;
  return icons.filter((asset) => {
    const text = `${asset.name} ${asset.label} ${asset.use}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/**
 * The tile a key moves to in a grid of `count` tiles, `columns` wide: arrows by one tile or one row, Home / End to the
 * first / last. From no tile (-1) any move starts at the first. Undefined: not a move key. Stays inside the grid.
 */
export function gridMove(index: number, key: string, count: number, columns: number): number | undefined {
  if (count === 0) return undefined;
  const last = count - 1;
  if (index < 0 || index > last) return ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key) ? 0 : undefined;
  switch (key) {
    case 'ArrowRight':
      return Math.min(index + 1, last);
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'ArrowDown':
      return index + columns <= last ? index + columns : index;
    case 'ArrowUp':
      return index - columns >= 0 ? index - columns : index;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return undefined;
  }
}
