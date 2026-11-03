import { useSyncExternalStore } from 'react';
import { usePreferences } from '@/stores/preferences';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(onChange: () => void) {
  darkQuery.addEventListener('change', onChange);
  return () => darkQuery.removeEventListener('change', onChange);
}

/** 'light' or 'dark' after applying the preference ('system' follows the OS, live). */
export function useResolvedTheme(): 'light' | 'dark' {
  const preference = usePreferences((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribe, () => darkQuery.matches);
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
