import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applyAppearance } from '@/components/themes/applyAppearance';
import { lookOf, usePreferences } from '@/stores/preferences';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribeTo = (query: MediaQueryList) => (onChange: () => void) => {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const subscribeDark = subscribeTo(darkQuery);
const subscribeCalm = subscribeTo(calmQuery);

/**
 * Applies the look: on <html>, the style, the `.dark` class, the text font and
 * effects (components/themes/applyAppearance.ts; the tokens in
 * styles/themes/ switch on them), and tells the main process, so the title
 * bar, menus and scrollbars match and the next window opens in it. It also
 * takes the suite's look when another app applies one to all, or the setup
 * runs (stores/preferences.ts decides whether it's newer than yours).
 * Renders nothing; mounted once in each window.
 */
export function ThemeSync() {
  const look = usePreferences(useShallow(lookOf));
  const systemDark = useSyncExternalStore(subscribeDark, () => darkQuery.matches);
  const calm = useSyncExternalStore(subscribeCalm, () => calmQuery.matches);

  // Before the first paint, so the app never flashes in another look.
  useLayoutEffect(() => {
    applyAppearance(look, systemDark, calm);
  }, [look, systemDark, calm]);

  useEffect(() => {
    window.api.app.setLook(look);
  }, [look]);

  useEffect(() => window.api.app.onSuiteLook((suite) => usePreferences.getState().takeSuiteLook(suite)), []);

  return null;
}
