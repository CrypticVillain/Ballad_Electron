import { ChevronRightIcon, FolderIcon, FolderInputIcon, FolderOpenIcon, FolderPlusIcon, LayersIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { create } from 'zustand';
import { Label } from '@/components/shared/bits';
import { afterConfirm } from '@/components/shared/Confirm';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu';
import { addFolder, addSpace, deleteFolder, deleteSpace, itemsIn, moveFolder, moveItem, moveSpace, rename, type Target } from '@/lib/layout';
import type { Layout, LayoutFolder, LayoutSpace } from '@/lib/model';
import { cn } from '@/lib/utils';

/**
 * Spaces — a sidebar's items (NPCs, places, lore, maps) arranged two levels
 * deep: spaces ("Allies", "Villains", "Campaign Maps") hold folders, and
 * both hold items. When it's yours to arrange (`editable`):
 *
 *   - drag an item onto a space or folder to move it there, or onto another
 *     item to put it just before it;
 *   - drag a folder onto a space (or before another folder), and a space
 *     before another space;
 *   - right-click anything for Move To, New Folder, Rename and Delete, and
 *     New Space at the bottom. Deleting keeps what was inside: a folder's
 *     items stay in its space; a space's folders and items go to the next.
 *
 * Read-only (a player looking at the DM's), empty spaces and folders are left
 * out, so nothing about what isn't shared shows. Which ones you've closed is
 * remembered on this computer.
 */

// ── Which spaces and folders are closed (this computer's, by `scope`) ──
const CLOSED_KEY = 'ballad:closed-spaces';
const readClosed = (): Record<string, true> => {
  try {
    return JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '{}') as Record<string, true>;
  } catch {
    return {};
  }
};
const useClosed = create<{ closed: Record<string, true> }>(() => ({ closed: readClosed() }));
function setClosed(key: string, closed: boolean) {
  const next = { ...useClosed.getState().closed };
  if (closed) next[key] = true;
  else delete next[key];
  useClosed.setState({ closed: next });
  try {
    localStorage.setItem(CLOSED_KEY, JSON.stringify(next));
  } catch {
    /* kept for this session only */
  }
}

type Dragging = { kind: 'item' | 'folder' | 'space'; id: string } | null;
/** Where a drop would land, for the marker: a line before something, or something lit to drop into. */
type Over = { id: string; how: 'before' | 'into' } | null;

const DRAG_TYPE = 'application/x-ballad-arrange';

export function Spaces<T>({
  scope,
  layout,
  items,
  render,
  nameOf,
  editable,
  onChange,
  noun = 'item',
  itemMenu,
  groupMenu,
}: {
  /** What these are, for remembering which are closed ("npc", "maps"…). */
  scope: string;
  /** The arranged layout (lib/layout `arrange`), every item placed. */
  layout: Layout;
  /** The items by id. */
  items: Map<string, T>;
  render: (item: T) => ReactNode;
  nameOf: (item: T) => string;
  editable: boolean;
  onChange: (layout: Layout) => void;
  /** What one item is called ("NPC", "map"), for empty folders and menus. */
  noun?: string;
  /** More right-click items for an item (the DM's Share…). */
  itemMenu?: (id: string) => ReactNode;
  /** More right-click items for a space or folder, given what's in it and where (Share Space…). */
  groupMenu?: (ids: string[], name: string, what: 'space' | 'folder') => ReactNode;
}) {
  const closed = useClosed((s) => s.closed);
  const dragging = useRef<Dragging>(null);
  const [over, setOver] = useState<Over>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const key = (id: string) => `${scope}:${id}`;
  const isOpen = (id: string) => !closed[key(id)];

  // ── Dragging ──
  const start = (e: DragEvent, kind: 'item' | 'folder' | 'space', id: string) => {
    e.stopPropagation();
    dragging.current = { kind, id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_TYPE, `${kind}:${id}`);
  };
  const end = () => {
    dragging.current = null;
    setOver(null);
  };
  /** A drop target: `accepts` says what it takes from what's being dragged (and how), `drop` does it. */
  const target = (id: string, accepts: (d: NonNullable<Dragging>) => 'before' | 'into' | null, drop: (d: NonNullable<Dragging>) => void) =>
    editable
      ? {
          onDragOver: (e: DragEvent) => {
            const d = dragging.current;
            const how = d && d.id !== id ? accepts(d) : null;
            if (!how) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (over?.id !== id || over.how !== how) setOver({ id, how });
          },
          onDragLeave: (e: DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o?.id === id ? null : o));
          },
          onDrop: (e: DragEvent) => {
            const d = dragging.current;
            if (!d || !accepts(d)) return;
            e.preventDefault();
            e.stopPropagation();
            drop(d);
            end();
          },
        }
      : {};
  const marker = (id: string) => (over?.id === id ? (over.how === 'into' ? 'bg-primary/10 ring-1 ring-primary/50' : 'shadow-[inset_0_2px_0_var(--color-primary)]') : '');

  const placeItem = (id: string, to: Target) => onChange(moveItem(layout, id, to));

  // ── Making, renaming, deleting ──
  const newSpace = () => {
    const made = addSpace(layout, 'New Space');
    onChange(made.layout);
    setRenaming(made.space.id);
  };
  const newFolder = (space: LayoutSpace, moving?: string) => {
    const made = addFolder(layout, space.id, 'New Folder');
    onChange(moving ? moveItem(made.layout, moving, { space: space.id, folder: made.folder.id }) : made.layout);
    setClosed(key(space.id), false);
    setRenaming(made.folder.id);
  };
  const removeFolder = (folder: LayoutFolder, space: LayoutSpace) => {
    const go = () => onChange(deleteFolder(layout, folder.id));
    if (folder.items.length) afterConfirm(`Delete the ${folder.name} folder?`, `Its ${folder.items.length} ${folder.items.length === 1 ? noun : `${noun}s`} stay in ${space.name}; nothing else is deleted.`, go, 'Delete Folder');
    else go();
  };
  const removeSpace = (space: LayoutSpace) => {
    const into = layout.spaces[layout.spaces.indexOf(space) + 1] ?? layout.spaces[layout.spaces.indexOf(space) - 1];
    if (!into) return;
    const count = itemsIn(space).length;
    const go = () => onChange(deleteSpace(layout, space.id, into.id));
    if (count || space.folders.length) {
      const what = [space.folders.length && `${space.folders.length} ${space.folders.length === 1 ? 'folder' : 'folders'}`, count && `${count} ${count === 1 ? noun : `${noun}s`}`].filter(Boolean).join(' and ');
      afterConfirm(`Delete the ${space.name} space?`, `Its ${what} move to ${into.name}; nothing else is deleted.`, go, 'Delete Space');
    } else go();
  };

  /** "Move To": every space, and its folders, but where the item already is. */
  const moveMenu = (id: string, here: { space: string; folder?: string }) => (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <FolderInputIcon /> Move To
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-80 overflow-y-auto">
        {layout.spaces.map((space) => (
          <div key={space.id}>
            <ContextMenuItem disabled={here.space === space.id && !here.folder} onSelect={() => placeItem(id, { space: space.id })}>
              <LayersIcon /> {space.name}
            </ContextMenuItem>
            {space.folders.map((folder) => (
              <ContextMenuItem key={folder.id} disabled={here.folder === folder.id} onSelect={() => placeItem(id, { space: space.id, folder: folder.id })} className="pl-7">
                <FolderIcon /> {folder.name}
              </ContextMenuItem>
            ))}
          </div>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );

  const itemRow = (id: string, space: LayoutSpace, folder?: LayoutFolder) => {
    const item = items.get(id);
    if (item === undefined) return null;
    const row = (
      <div
        key={id}
        draggable={editable}
        onDragStart={(e) => start(e, 'item', id)}
        onDragEnd={end}
        {...target(id, (d) => (d.kind === 'item' ? 'before' : null), (d) => placeItem(d.id, { space: space.id, folder: folder?.id, before: id }))}
        className={cn('rounded-md', folder && 'pl-4', marker(id))}
      >
        {render(item)}
      </div>
    );
    if (!editable) return row;
    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled className="max-w-56 truncate font-medium opacity-100">
            {nameOf(item)}
          </ContextMenuItem>
          <ContextMenuSeparator />
          {moveMenu(id, { space: space.id, folder: folder?.id })}
          <ContextMenuItem onSelect={() => newFolder(space, id)}>
            <FolderPlusIcon /> Into A New Folder
          </ContextMenuItem>
          {itemMenu && (
            <>
              <ContextMenuSeparator />
              {itemMenu(id)}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const folderBlock = (folder: LayoutFolder, space: LayoutSpace) => {
    if (!editable && !folder.items.some((id) => items.has(id))) return null;
    const open = isOpen(folder.id);
    const header =
      renaming === folder.id ? (
        <NameInput icon={<FolderIcon className="size-4 shrink-0 text-muted-foreground" />} initial={folder.name} onDone={(name) => {
            setRenaming(null);
            if (name !== null) onChange(rename(layout, folder.id, name));
          }} />
      ) : (
        <div
          draggable={editable}
          onDragStart={(e) => start(e, 'folder', folder.id)}
          onDragEnd={end}
          {...target(folder.id, (d) => (d.kind === 'item' ? 'into' : d.kind === 'folder' ? 'before' : null), (d) => (d.kind === 'item' ? placeItem(d.id, { space: space.id, folder: folder.id }) : onChange(moveFolder(layout, d.id, { space: space.id, before: folder.id }))))}
          className={cn('rounded-md', marker(folder.id))}
        >
          <CollapsibleTrigger className="group/folder flex min-h-[30px] w-full items-center gap-2 rounded-md px-2.5 text-left text-[13.5px] hover:bg-sidebar-accent">
            {open ? <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /> : <FolderIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
            <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{folder.items.length}</span>
          </CollapsibleTrigger>
        </div>
      );
    return (
      <Collapsible key={folder.id} open={open} onOpenChange={(next) => setClosed(key(folder.id), !next)}>
        {editable && renaming !== folder.id ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>{header}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => setRenaming(folder.id)}>
                <PencilIcon /> Rename Folder
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <FolderInputIcon /> Move To
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {layout.spaces.map((s) => (
                    <ContextMenuItem key={s.id} disabled={s.id === space.id} onSelect={() => onChange(moveFolder(layout, folder.id, { space: s.id }))}>
                      <LayersIcon /> {s.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              {groupMenu && folder.items.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  {groupMenu(folder.items, folder.name, 'folder')}
                </>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => removeFolder(folder, space)}>
                <Trash2Icon /> Delete Folder
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : (
          header
        )}
        <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
          {folder.items.map((id) => itemRow(id, space, folder))}
          {!folder.items.length && <p className="py-1 pl-10 text-[12px] text-muted-foreground/70">Empty: drag {noun}s here.</p>}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const spaceBlock = (space: LayoutSpace) => {
    const count = itemsIn(space).filter((id) => items.has(id)).length;
    if (!editable && !count) return null;
    const open = isOpen(space.id);
    const header =
      renaming === space.id ? (
        <NameInput icon={<LayersIcon className="size-3.5 shrink-0 text-muted-foreground" />} initial={space.name} onDone={(name) => {
            setRenaming(null);
            if (name !== null) onChange(rename(layout, space.id, name));
          }} />
      ) : (
        <div
          draggable={editable}
          onDragStart={(e) => start(e, 'space', space.id)}
          onDragEnd={end}
          {...target(space.id, (d) => (d.kind === 'space' ? 'before' : 'into'), (d) => (d.kind === 'space' ? onChange(moveSpace(layout, d.id, space.id)) : d.kind === 'folder' ? onChange(moveFolder(layout, d.id, { space: space.id })) : placeItem(d.id, { space: space.id })))}
          className={cn('group/space flex items-center rounded-md', marker(space.id))}
        >
          <CollapsibleTrigger className="flex min-h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2.5 text-left hover:bg-sidebar-accent">
            <ChevronRightIcon className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
            <Label className="min-w-0 flex-1 truncate">{space.name}</Label>
            <span className="font-mono text-[10.5px] text-muted-foreground">{count}</span>
          </CollapsibleTrigger>
          {editable && (
            <Hint label={`New folder in ${space.name}`}>
              <Button variant="ghost" size="icon-xs" aria-label={`New folder in ${space.name}`} onClick={() => newFolder(space)} className="ml-0.5 text-muted-foreground opacity-0 group-hover/space:opacity-100 focus-visible:opacity-100">
                <FolderPlusIcon />
              </Button>
            </Hint>
          )}
        </div>
      );
    return (
      <Collapsible key={space.id} open={open} onOpenChange={(next) => setClosed(key(space.id), !next)}>
        {editable && renaming !== space.id ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>{header}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => newFolder(space)}>
                <FolderPlusIcon /> New Folder
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => setRenaming(space.id)}>
                <PencilIcon /> Rename Space
              </ContextMenuItem>
              <ContextMenuItem onSelect={newSpace}>
                <PlusIcon /> New Space
              </ContextMenuItem>
              {groupMenu && itemsIn(space).length > 0 && (
                <>
                  <ContextMenuSeparator />
                  {groupMenu(itemsIn(space), space.name, 'space')}
                </>
              )}
              {layout.spaces.length > 1 && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onSelect={() => removeSpace(space)}>
                    <Trash2Icon /> Delete Space
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ) : (
          header
        )}
        <CollapsibleContent
          {...target(`${space.id}:body`, (d) => (d.kind === 'item' || d.kind === 'folder' ? 'into' : null), (d) => (d.kind === 'folder' ? onChange(moveFolder(layout, d.id, { space: space.id })) : placeItem(d.id, { space: space.id })))}
          className={cn('flex flex-col gap-0.5 rounded-md pt-0.5', over?.id === `${space.id}:body` && 'bg-primary/5')}
        >
          {space.folders.map((folder) => folderBlock(folder, space))}
          {space.items.map((id) => itemRow(id, space))}
          {editable && !space.items.length && !space.folders.length && <p className="py-1 pl-8 text-[12px] text-muted-foreground/70">Empty: drag {noun}s or folders here.</p>}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {layout.spaces.map(spaceBlock)}
      {editable && (
        <div {...target('end', (d) => (d.kind === 'space' ? 'before' : null), (d) => onChange(moveSpace(layout, d.id)))} className={cn('rounded-md', marker('end'))}>
          <button type="button" onClick={newSpace} className="flex min-h-7 w-full items-center gap-2 rounded-md px-2.5 text-[12.5px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <PlusIcon className="size-3.5" /> New Space
          </button>
        </div>
      )}
    </div>
  );
}

/** A space's or folder's name being typed: Enter or leaving saves, Esc cancels (null). */
function NameInput({ icon, initial, onDone }: { icon: ReactNode; initial: string; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(initial);
  return (
    <div className="flex items-center gap-1.5 px-2.5">
      {icon}
      <input
        autoFocus
        aria-label="Name"
        value={name}
        placeholder="Name"
        onFocus={(e) => e.target.select()}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onDone(name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onDone(name);
          if (e.key === 'Escape') onDone(null);
        }}
        className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-[12.5px] outline-none focus:border-primary"
      />
    </div>
  );
}
