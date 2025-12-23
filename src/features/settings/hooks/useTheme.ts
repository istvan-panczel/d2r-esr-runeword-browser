import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectTheme, selectTextSize, TEXT_SIZE_MAP } from '../store/settingsSlice';

/**
 * Syncs the theme class on document.documentElement.
 * Call this once at app initialization.
 */
export function useThemeSync() {
  const theme = useSelector(selectTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
}

/**
 * Syncs the text size on document.documentElement.
 * Call this once at app initialization.
 */
export function useTextSizeSync() {
  const textSize = useSelector(selectTextSize);

  useEffect(() => {
    document.documentElement.style.fontSize = `${String(TEXT_SIZE_MAP[textSize])}px`;
  }, [textSize]);
}
