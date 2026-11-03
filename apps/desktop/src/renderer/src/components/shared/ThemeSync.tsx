import { useEffect, useLayoutEffect } from 'react';
import { usePreferences } from '@/stores/preferences';
import { useResolvedTheme } from './useResolvedTheme';

/**
 * Applies the look: `data-style` on <html> (Display, Chassis, Field or Ledger)
 * and the `.dark` class (the tokens in globals.css switch on both), plus
 * Electron's nativeTheme, so the title bar, menus and scrollbars match.
 * Renders nothing; mounted once in the app shell. (Same as Harmony's.)
 */
export function ThemeSync() {
  const preference = usePreferences((s) => s.theme);
  const style = usePreferences((s) => s.style);
  const resolved = useResolvedTheme();

  // Before the first paint, so the app never flashes in another look.
  useLayoutEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  useEffect(() => {
    window.api.app.setTheme(preference);
  }, [preference]);

  return null;
}
