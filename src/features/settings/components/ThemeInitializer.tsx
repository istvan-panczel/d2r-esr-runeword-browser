import { useThemeSync, useTextSizeSync, useDiabloFontSync } from '../hooks/useTheme';

/**
 * Renders nothing but ensures theme, text size, and font are synced on mount.
 */
export function ThemeInitializer() {
  useThemeSync();
  useTextSizeSync();
  useDiabloFontSync();
  return null;
}
