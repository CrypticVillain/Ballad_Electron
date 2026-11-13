/**
 * styles.ts — the suite's styles: the list every app's Settings › Appearance
 * and the setup's Appearance step show. Their tokens are in
 * renderer/src/styles/themes/tokens.css, by the same ids.
 *
 * The source is the suite repo's themes/ folder (Monospace-Suite_Electron);
 * the copies in the apps are written by `npm run themes` there. Don't edit a copy.
 */
export const STYLE_IDS = [
  'standard',
  'display',
  'chassis',
  'field',
  'ledger',
  'codex',
  'voltage',
  'orbit',
  'salvage',
  'sunset',
  'cartridge',
  'deco',
  'grove',
  'phosphor',
  'blueprint',
  'abyss',
  'panel',
  'vesper',
  'glacier',
  'sumi',
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/** Standard: no theme at all. Classic: the first four. Worlds: the themed ones. */
export type StyleGroup = 'standard' | 'classic' | 'worlds';

export interface SuiteStyle {
  id: StyleId;
  name: string;
  group: StyleGroup;
  /** A few words, under the name. */
  blurb: string;
  /** The mode it's drawn around (both work); null when neither leads. */
  signature: 'light' | 'dark' | null;
  /** Its `--rail`, per mode: the window's background before the page paints (no flash). */
  window: { light: string; dark: string };
}

export const DEFAULT_STYLE: StyleId = 'display';

export const STYLES: readonly SuiteStyle[] = [
  { id: 'standard', name: 'Standard', group: 'standard', blurb: 'System fonts, no ornament.', signature: null, window: { light: '#ebebeb', dark: '#141414' } },
  { id: 'display', name: 'Display', group: 'classic', blurb: 'Dot-matrix headings, pill buttons.', signature: 'dark', window: { light: '#ececec', dark: '#0a0a0a' } },
  { id: 'chassis', name: 'Chassis', group: 'classic', blurb: 'Warm aluminum, orange keys.', signature: null, window: { light: '#e5e2dc', dark: '#131210' } },
  { id: 'field', name: 'Field', group: 'classic', blurb: 'Keycap tiles with depth.', signature: null, window: { light: '#e9e9e6', dark: '#121214' } },
  { id: 'ledger', name: 'Ledger', group: 'classic', blurb: 'Calm stone grays, one accent.', signature: null, window: { light: '#e3e6e1', dark: '#111412' } },
  { id: 'codex', name: 'Codex', group: 'worlds', blurb: 'Parchment, oxblood and gold leaf.', signature: 'light', window: { light: '#3b2413', dark: '#0c0a11' } },
  { id: 'voltage', name: 'Voltage', group: 'worlds', blurb: 'Hazard yellow on black, clipped corners.', signature: 'dark', window: { light: '#0a0a0f', dark: '#050507' } },
  { id: 'orbit', name: 'Orbit', group: 'worlds', blurb: 'Mission control: flight blue, red alerts.', signature: 'dark', window: { light: '#0b3d91', dark: '#02040a' } },
  { id: 'salvage', name: 'Salvage', group: 'worlds', blurb: 'Cream, petrol teal, a four-color stripe.', signature: 'light', window: { light: '#1e4a4c', dark: '#0a1413' } },
  { id: 'sunset', name: 'Sunset', group: 'worlds', blurb: 'Violet night, magenta and cyan neon.', signature: 'dark', window: { light: '#3b1a6e', dark: '#0c0518' } },
  { id: 'cartridge', name: 'Cartridge', group: 'worlds', blurb: 'Pixel type on a four-shade green screen.', signature: 'light', window: { light: '#306230', dark: '#000000' } },
  { id: 'deco', name: 'Deco', group: 'worlds', blurb: 'Emerald lacquer, brass, thin capitals.', signature: 'dark', window: { light: '#0f3b3a', dark: '#060d0c' } },
  { id: 'grove', name: 'Grove', group: 'worlds', blurb: 'Moss, cream and brush-written headings.', signature: 'light', window: { light: '#dbe6b9', dark: '#0c140f' } },
  { id: 'phosphor', name: 'Phosphor', group: 'worlds', blurb: 'Green-screen terminal, one mono face.', signature: 'dark', window: { light: '#26362a', dark: '#020503' } },
  { id: 'blueprint', name: 'Blueprint', group: 'worlds', blurb: 'White line on drafting blue.', signature: 'dark', window: { light: '#e3ecf8', dark: '#082a54' } },
  { id: 'abyss', name: 'Abyss', group: 'worlds', blurb: 'Glowing aqua and pink in deep water.', signature: 'dark', window: { light: '#0c4a5a', dark: '#020a11' } },
  { id: 'panel', name: 'Panel', group: 'worlds', blurb: 'Ink outlines, halftone, primary colors.', signature: 'light', window: { light: '#e3262f', dark: '#7d0f16' } },
  { id: 'vesper', name: 'Vesper', group: 'worlds', blurb: 'Near-black, bone and blood red.', signature: 'dark', window: { light: '#1c1215', dark: '#050405' } },
  { id: 'glacier', name: 'Glacier', group: 'worlds', blurb: 'Frosted glass over an aurora.', signature: 'dark', window: { light: '#d3ebff', dark: '#0b1d3a' } },
  { id: 'sumi', name: 'Sumi', group: 'worlds', blurb: 'Ink on paper, one vermilion seal.', signature: 'light', window: { light: '#e8e2d2', dark: '#0e0e0d' } },
];

/** The picker's sections, in order. Standard sits with the classic four. */
export const STYLE_SECTIONS: readonly { name: string; groups: readonly StyleGroup[] }[] = [
  { name: 'Standard & classic', groups: ['standard', 'classic'] },
  { name: 'Worlds', groups: ['worlds'] },
];

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === 'string' && (STYLE_IDS as readonly string[]).includes(value);
}

export function suiteStyle(id: StyleId): SuiteStyle {
  return STYLES.find((s) => s.id === id)!;
}
