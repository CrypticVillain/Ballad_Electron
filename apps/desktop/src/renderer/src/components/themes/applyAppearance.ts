/**
 * applyAppearance.ts — puts an appearance on the page: on <html>, data-style
 * (the style), the `.dark` class (the mode), data-text (the Text font setting)
 * and data-effects. styles/themes/tokens.css and touches.css switch on them.
 *
 * The source is the suite repo's themes/ folder (Monospace-Suite_Electron);
 * the copies in the apps are written by `npm run themes` there. Don't edit a copy.
 */
import type { Appearance } from '../../../../shared/themes/appearance';

/** Applies it and returns the mode it resolved to. Call before paint (useLayoutEffect). */
export function applyAppearance(appearance: Appearance, systemDark: boolean, reducedMotion = false): 'light' | 'dark' {
  const mode = appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme;
  const html = document.documentElement;
  html.dataset.style = appearance.style;
  html.classList.toggle('dark', mode === 'dark');
  html.style.colorScheme = mode;
  html.dataset.text = appearance.text;
  html.dataset.effects = appearance.effects === 'reduced' || reducedMotion ? 'reduced' : 'full';
  return mode;
}
