import { useThemeSync, useTextSizeSync } from '../hooks/useTheme';

/**
 * Renders nothing but ensures theme and text size are synced on mount.
 */
export function ThemeInitializer() {
  useThemeSync();
  useTextSizeSync();
  return null;
}
