import { newId, type Layout, type LayoutFolder, type LayoutSpace } from './model';

/**
 * Sidebar layouts: spaces, the folders inside them, and the items (NPCs,
 * places, lore, maps) in either, all in the order you put them. Everything
 * here is pure: it takes a layout and gives back a new one.
 *
 * A saved layout can be behind the list it arranges (an item made since, one
 * deleted, a layout from before spaces): `arrange` fills it in, placing new
 * items where their old group or folder says, or in the first space.
 */

/**
 * An item to place: its id and name, and where it should go if it isn't
 * placed yet (a space's name, a folder's: where it was kept before spaces, or
 * the GM's structure, shared). With `create`, that space and folder are made
 * if they aren't there.
 */
export type Placeable = { id: string; name: string; space?: string; folder?: string; create?: boolean };

/** Where something goes: a space, maybe a folder in it, maybe before an item or folder there (else at the end). */
export type Target = { space: string; folder?: string; before?: string };

const clone = (layout: Layout): Layout => ({ spaces: layout.spaces.map((s) => ({ ...s, items: [...s.items], folders: s.folders.map((f) => ({ ...f, items: [...f.items] })) })) });
const byName = (a: Placeable, b: Placeable) => a.name.localeCompare(b.name);

/** A space or folder named so, ready to use. */
export const makeSpace = (name: string, folders: LayoutFolder[] = []): LayoutSpace => ({ id: newId(), name, folders, items: [] });
export const makeFolder = (name: string): LayoutFolder => ({ id: newId(), name, items: [] });

/**
 * The layout for these items: the saved one (or, without one, spaces named
 * `defaults`, then any groups the items have, and folders named `folders` in
 * the first space), with every item in exactly one place. Ids of items that
 * aren't in the list any more drop out.
 */
export function arrange(saved: Layout | undefined, items: Placeable[], defaults: string[], folders: string[] = []): Layout {
  let layout: Layout;
  if (saved?.spaces.length) layout = clone(saved);
  else {
    const names = [...defaults, ...items.map((i) => i.space ?? '').filter(Boolean)].filter((n, i, all) => all.indexOf(n) === i);
    // Ids from the names, so a layout that isn't saved yet keeps the same ones from one look to the next.
    const spaces = (names.length ? names : ['Unsorted']).map((n): LayoutSpace => ({ id: `space:${n}`, name: n, folders: [], items: [] }));
    spaces[0]!.folders = folders.filter((f, i, all) => f && all.indexOf(f) === i).map((f): LayoutFolder => ({ id: `folder:${f}`, name: f, items: [] }));
    layout = { spaces };
  }
  const known = new Set(items.map((i) => i.id));
  const placed = new Set<string>();
  const keep = (ids: string[]) =>
    ids.filter((id) => {
      if (!known.has(id) || placed.has(id)) return false;
      placed.add(id);
      return true;
    });
  for (const space of layout.spaces) {
    for (const folder of space.folders) folder.items = keep(folder.items);
    space.items = keep(space.items);
  }
  const taken = new Set(layout.spaces.flatMap((s) => [s.id, ...s.folders.map((f) => f.id)]));
  const fresh = (base: string) => {
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}:${n}`;
    taken.add(id);
    return id;
  };
  for (const item of items.filter((i) => !placed.has(i.id)).sort(byName)) {
    let space = layout.spaces.find((s) => s.name === item.space);
    if (!space && item.create && item.space) {
      space = { id: fresh(`space:${item.space}`), name: item.space, folders: [], items: [] };
      layout.spaces.push(space);
    }
    space ??= layout.spaces[0]!;
    let folder = item.folder ? (item.create ? space.folders : layout.spaces.flatMap((s) => s.folders)).find((f) => f.name === item.folder) : undefined;
    if (!folder && item.create && item.folder) {
      folder = { id: fresh(`folder:${space.name}:${item.folder}`), name: item.folder, items: [] };
      space.folders.push(folder);
    }
    (folder ?? space).items.push(item.id);
  }
  return layout;
}

/** Every item id in a space, its folders' included. */
export const itemsIn = (space: LayoutSpace) => [...space.folders.flatMap((f) => f.items), ...space.items];

/** The space (and folder) an item is in. */
export function whereIs(layout: Layout, id: string): { space: LayoutSpace; folder?: LayoutFolder } | undefined {
  for (const space of layout.spaces) {
    if (space.items.includes(id)) return { space };
    const folder = space.folders.find((f) => f.items.includes(id));
    if (folder) return { space, folder };
  }
  return undefined;
}

const insert = (list: string[], id: string, before?: string) => {
  const at = before ? list.indexOf(before) : -1;
  if (at < 0) list.push(id);
  else list.splice(at, 0, id);
};

/** Moves an item into a space or one of its folders (before another item there, or at the end). */
export function moveItem(layout: Layout, id: string, to: Target): Layout {
  if (to.before === id) return layout;
  const next = clone(layout);
  const space = next.spaces.find((s) => s.id === to.space);
  const folder = to.folder ? space?.folders.find((f) => f.id === to.folder) : undefined;
  if (!space || (to.folder && !folder)) return layout;
  for (const s of next.spaces) {
    s.items = s.items.filter((i) => i !== id);
    for (const f of s.folders) f.items = f.items.filter((i) => i !== id);
  }
  insert((folder ?? space).items, id, to.before);
  return next;
}

/** Moves a folder (with what's in it) into a space, before another folder there or at the end. */
export function moveFolder(layout: Layout, id: string, to: { space: string; before?: string }): Layout {
  if (to.before === id) return layout;
  const folder = layout.spaces.flatMap((s) => s.folders).find((f) => f.id === id);
  if (!folder || !layout.spaces.some((s) => s.id === to.space)) return layout;
  const next = clone(layout);
  for (const s of next.spaces) s.folders = s.folders.filter((f) => f.id !== id);
  const space = next.spaces.find((s) => s.id === to.space)!;
  const moved = { ...folder, items: [...folder.items] };
  const at = to.before ? space.folders.findIndex((f) => f.id === to.before) : -1;
  if (at < 0) space.folders.push(moved);
  else space.folders.splice(at, 0, moved);
  return next;
}

/** Moves a space before another one (or to the end). */
export function moveSpace(layout: Layout, id: string, before?: string): Layout {
  if (before === id) return layout;
  const space = layout.spaces.find((s) => s.id === id);
  if (!space) return layout;
  const rest = clone(layout).spaces.filter((s) => s.id !== id);
  const at = before ? rest.findIndex((s) => s.id === before) : -1;
  if (at < 0) rest.push(clone({ spaces: [space] }).spaces[0]!);
  else rest.splice(at, 0, clone({ spaces: [space] }).spaces[0]!);
  return { spaces: rest };
}

/** A new space at the end: the layout, and the space. */
export function addSpace(layout: Layout, name: string): { layout: Layout; space: LayoutSpace } {
  const space = makeSpace(name);
  return { layout: { spaces: [...clone(layout).spaces, space] }, space };
}

/** A new folder at the end of a space. */
export function addFolder(layout: Layout, spaceId: string, name: string): { layout: Layout; folder: LayoutFolder } {
  const folder = makeFolder(name);
  const next = clone(layout);
  next.spaces.find((s) => s.id === spaceId)?.folders.push(folder);
  return { layout: next, folder };
}

/** Renames a space or a folder (by id). Blank names are ignored. */
export function rename(layout: Layout, id: string, name: string): Layout {
  const clean = name.trim();
  if (!clean) return layout;
  const next = clone(layout);
  for (const s of next.spaces) {
    if (s.id === id) s.name = clean;
    for (const f of s.folders) if (f.id === id) f.name = clean;
  }
  return next;
}

/** Deletes a folder: what was in it stays in its space, loose (at the top, in order). */
export function deleteFolder(layout: Layout, id: string): Layout {
  const next = clone(layout);
  for (const s of next.spaces) {
    const folder = s.folders.find((f) => f.id === id);
    if (!folder) continue;
    s.folders = s.folders.filter((f) => f.id !== id);
    s.items = [...folder.items, ...s.items];
  }
  return next;
}

/**
 * Deletes a space: its folders and items move to `into` (another space;
 * the first other one if not given). The last space can't be deleted.
 */
export function deleteSpace(layout: Layout, id: string, into?: string): Layout {
  if (layout.spaces.length < 2) return layout;
  const next = clone(layout);
  const gone = next.spaces.find((s) => s.id === id);
  if (!gone) return layout;
  next.spaces = next.spaces.filter((s) => s.id !== id);
  const target = next.spaces.find((s) => s.id === into) ?? next.spaces[0]!;
  target.folders.push(...gone.folders);
  target.items.push(...gone.items);
  return next;
}
