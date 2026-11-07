import { ArrowDownIcon, ArrowUpIcon, FolderIcon, FolderPlusIcon, GripVerticalIcon, LayersIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { BalladMark } from '@/components/shared/BalladMark';
import { afterConfirm } from '@/components/shared/Confirm';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { usePlayLayout } from '@/play/scenes/layout';
import { useMusicLayout } from '@/tabletop/music/actions';
import { useAreas, useEncounterLayout, useEntryLayout, useMapLayouts, useMonsterLayouts, useStorylineLayout, type Area, type Arrangement } from '@/components/shell/layouts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/lib/hooks';
import { addFolder, addSpace, deleteFolder, deleteSpace, itemsIn, moveFolder, moveSpace, rename } from '@/lib/layout';
import type { EntryKind, LayoutFolder, LayoutSpace } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useUi, type ManageDialog } from '@/stores/ui';

/**
 * Manage Spaces and Manage Folders (the app menu): every list you can
 * arrange (Encounters, the Bestiary, NPCs, Places, Maps, Lore, the Timeline's storylines;
 * a Writing world's Characters…) as a tab
 * down the left, and its spaces, or its folders space by space, to make,
 * rename, reorder (drag, or the arrows), move and delete. The same
 * arrangement the sidebars show (components/shell/layouts): the GM's
 * world's, or a player's own.
 */
export function ManageLayoutDialog() {
  const mode = useUi((s) => s.manage);
  const areas = useAreas();
  const [tab, setTab] = useState<string>('');
  const open = mode !== null;
  const current = areas.find((a) => a.key === tab) ?? areas[0];
  const player = useRole() === 'player';
  return (
    <Dialog open={open} onOpenChange={(o) => !o && useUi.getState().setManage(null)}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[min(620px,calc(100vh-64px))] gap-0 overflow-hidden p-0 sm:max-w-[820px]">
        <Tabs orientation="vertical" value={current?.key ?? ''} onValueChange={setTab} className="min-w-0 flex-1 flex-row gap-0">
          <nav className="flex w-[200px] shrink-0 flex-col border-r bg-sidebar p-3">
            <DialogTitle className="px-2.5 pt-1.5 pb-3 font-display text-xl leading-tight font-black uppercase">{mode === 'folders' ? 'Manage Folders' : 'Manage Spaces'}</DialogTitle>
            <DialogDescription className="sr-only">{mode === 'folders' ? 'The folders in each list, by space' : 'The spaces in each list'}</DialogDescription>
            <TabsList aria-label="Lists" className="w-full gap-0.5 bg-transparent p-0 group-data-[orientation=vertical]/tabs:h-auto">
              {areas.map((area) => (
                <TabsTrigger
                  key={area.key}
                  value={area.key}
                  className="h-[34px] flex-none justify-start rounded-md border-0 px-2.5 text-[13.5px] font-normal text-sidebar-foreground shadow-none hover:bg-sidebar-accent data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground data-[state=active]:shadow-none group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none dark:text-sidebar-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-sidebar-accent dark:data-[state=active]:text-sidebar-accent-foreground"
                >
                  {area.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="mt-auto flex flex-col gap-3 px-2.5 pt-3">
              <button type="button" onClick={() => useUi.getState().setManage(mode === 'folders' ? 'spaces' : 'folders')} className="flex items-center gap-2 text-left text-[12.5px] text-muted-foreground hover:text-foreground">
                {mode === 'folders' ? <LayersIcon className="size-3.5" /> : <FolderIcon className="size-3.5" />}
                {mode === 'folders' ? 'Manage Spaces' : 'Manage Folders'} →
              </button>
              <span className="flex items-center gap-2.5">
                <BalladMark className="size-7" />
                <span className="text-[11.5px] leading-snug text-muted-foreground">{player ? 'Your own arrangement: the GM’s isn’t changed.' : 'What the sidebars show.'}</span>
              </span>
            </div>
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {!areas.length && <p className="text-sm text-muted-foreground">Nothing to arrange here yet.</p>}
            {areas.map((area) => (
              <TabsContent key={area.key} value={area.key}>
                {area.kind ? (
                  <EntryArea area={area} kind={area.kind} mode={mode ?? 'spaces'} />
                ) : area.key === 'music' ? (
                  <MusicArea area={area} mode={mode ?? 'spaces'} />
                ) : area.key === 'play' ? (
                  <PlayArea area={area} mode={mode ?? 'spaces'} />
                ) : area.key === 'encounters' ? (
                  <EncountersArea area={area} mode={mode ?? 'spaces'} />
                ) : area.key === 'monsters' ? (
                  <MonstersArea area={area} mode={mode ?? 'spaces'} />
                ) : area.key === 'storylines' ? (
                  <StorylinesArea area={area} mode={mode ?? 'spaces'} />
                ) : (
                  <MapsArea area={area} mode={mode ?? 'spaces'} />
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EntryArea({ area, kind, mode }: { area: Area; kind: EntryKind; mode: NonNullable<ManageDialog> }) {
  const arrangement = useEntryLayout(kind);
  const visible = new Set(arrangement.entries.map((e) => e.id));
  return <AreaEditor area={area} mode={mode} arrangement={arrangement} visible={visible} />;
}

function MapsArea({ area, mode }: { area: Area; mode: NonNullable<ManageDialog> }) {
  const { campaign, own } = useMapLayouts();
  const arrangement = own ?? campaign;
  const visible = new Set(arrangement.maps.map((m) => m.id));
  return <AreaEditor area={{ ...area, label: own ? 'Your Maps' : area.label }} mode={mode} arrangement={arrangement} visible={visible} />;
}

function MonstersArea({ area, mode }: { area: Area; mode: NonNullable<ManageDialog> }) {
  const { campaign, own } = useMonsterLayouts();
  const arrangement = own ?? campaign;
  const visible = new Set(arrangement.monsters.map((m) => m.id));
  return <AreaEditor area={{ ...area, label: own ? 'Your Bestiary' : area.label }} mode={mode} arrangement={arrangement} visible={visible} />;
}

function MusicArea({ area, mode }: { area: Area; mode: NonNullable<ManageDialog> }) {
  const { layout, tracks, editable, save } = useMusicLayout();
  const visible = new Set(tracks.map((t) => t.id));
  return <AreaEditor area={area} mode={mode} arrangement={{ layout, editable, save }} visible={visible} />;
}

function PlayArea({ area, mode }: { area: Area; mode: NonNullable<ManageDialog> }) {
  const { layout, scenes, editable, save } = usePlayLayout();
  const visible = new Set(scenes.map((s) => s.id));
  return <AreaEditor area={area} mode={mode} arrangement={{ layout, editable, save }} visible={visible} />;
}

function EncountersArea({ area, mode }: { area: Area; mode: NonNullable<ManageDialog> }) {
  const arrangement = useEncounterLayout();
  const visible = new Set(arrangement.encounters.map((e) => e.id));
  return <AreaEditor area={area} mode={mode} arrangement={arrangement} visible={visible} />;
}

function StorylinesArea({ area, mode }: { area: Area; mode: NonNullable<ManageDialog> }) {
  const arrangement = useStorylineLayout();
  const visible = new Set(arrangement.storylines.map((s) => s.id));
  return <AreaEditor area={area} mode={mode} arrangement={arrangement} visible={visible} />;
}

const plural = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;

/** One list's spaces, or its folders, to arrange. */
function AreaEditor({ area, mode, arrangement, visible }: { area: Area; mode: NonNullable<ManageDialog>; arrangement: Arrangement; visible: Set<string> }) {
  const { layout, save, editable } = arrangement;
  const [fresh, setFresh] = useState<string | null>(null);
  const noun = area.noun.toLowerCase() === 'npc' ? 'NPC' : area.noun.toLowerCase();
  const count = (ids: string[]) => ids.filter((id) => visible.has(id)).length;
  const drag = useDrag(editable);

  const newSpace = () => {
    const made = addSpace(layout, 'New Space');
    save(made.layout);
    setFresh(made.space.id);
  };
  const newFolder = (space: LayoutSpace) => {
    const made = addFolder(layout, space.id, 'New Folder');
    save(made.layout);
    setFresh(made.folder.id);
  };
  const removeSpace = (space: LayoutSpace, i: number) => {
    const into = layout.spaces[i + 1] ?? layout.spaces[i - 1];
    if (!into) return;
    const items = count(itemsIn(space));
    const go = () => save(deleteSpace(layout, space.id, into.id));
    if (items || space.folders.length) {
      const what = [space.folders.length && plural(space.folders.length, 'folder'), items && plural(items, noun)].filter(Boolean).join(' and ');
      afterConfirm(`Delete the ${space.name} space?`, `Its ${what} move to ${into.name}; nothing else is deleted.`, go, 'Delete Space', 'all:organizing');
    } else go();
  };
  const removeFolder = (folder: LayoutFolder, space: LayoutSpace) => {
    const items = count(folder.items);
    const go = () => save(deleteFolder(layout, folder.id));
    if (items) afterConfirm(`Delete the ${folder.name} folder?`, `Its ${plural(items, noun)} stay in ${space.name}; nothing else is deleted.`, go, 'Delete Folder', 'all:organizing');
    else go();
  };

  if (mode === 'spaces') {
    return (
      <section className="flex flex-col gap-4">
        <Heading title={`${area.label} · Spaces`} note={`The top-level groups in the ${area.label} sidebar. Each holds folders and ${noun}s. Drag a row, or use the arrows, to change the order.`} />
        <ol className="flex flex-col rounded-xl border">
          {layout.spaces.map((space, i) => (
            <Row
              key={space.id}
              icon={<LayersIcon className="size-4 text-muted-foreground" />}
              drag={drag.row({ kind: 'space', id: space.id }, (d) => (d.kind === 'space' ? () => save(moveSpace(layout, d.id, space.id)) : null))}
              over={drag.over === space.id}
              name={space.name}
              autoFocus={fresh === space.id}
              editable={editable}
              onRename={(name) => save(rename(layout, space.id, name))}
              meta={[plural(space.folders.length, 'folder'), plural(count(itemsIn(space)), noun)].join(' · ')}
              up={i > 0 ? () => save(moveSpace(layout, space.id, layout.spaces[i - 1]!.id)) : undefined}
              down={i < layout.spaces.length - 1 ? () => save(moveSpace(layout, space.id, layout.spaces[i + 2]?.id)) : undefined}
              remove={layout.spaces.length > 1 ? () => removeSpace(space, i) : undefined}
              label={`${space.name} space`}
            />
          ))}
        </ol>
        {editable && (
          <Button variant="outline" size="sm" onClick={newSpace} className="self-start">
            <PlusIcon /> New Space
          </Button>
        )}
      </section>
    );
  }

  const spaceOptions = layout.spaces.map((s) => ({ value: s.id, label: s.name }));
  return (
    <section className="flex flex-col gap-5">
      <Heading title={`${area.label} · Folders`} note={`The folders in each space. Drag a folder within a space or onto another space's heading, pick its space, or use the arrows.`} />
      {layout.spaces.map((space) => (
        <div key={space.id} className="flex flex-col gap-2">
          <div {...drag.target(`space:${space.id}`, (d) => (d.kind === 'folder' ? () => save(moveFolder(layout, d.id, { space: space.id })) : null))} className={cn('flex items-center gap-2 rounded-md px-1', drag.over === `space:${space.id}` && 'bg-primary/10 ring-1 ring-primary/50')}>
            <LayersIcon className="size-3.5 text-muted-foreground" />
            <span className="label min-w-0 flex-1 truncate">{space.name}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">{plural(space.folders.length, 'folder')}</span>
            {editable && (
              <Button variant="ghost" size="xs" onClick={() => newFolder(space)}>
                <FolderPlusIcon /> New Folder
              </Button>
            )}
          </div>
          {space.folders.length ? (
            <ol className="flex flex-col rounded-xl border">
              {space.folders.map((folder, i) => (
                <Row
                  key={folder.id}
                  icon={<FolderIcon className="size-4 text-muted-foreground" />}
                  drag={drag.row({ kind: 'folder', id: folder.id }, (d) => (d.kind === 'folder' ? () => save(moveFolder(layout, d.id, { space: space.id, before: folder.id })) : null))}
                  over={drag.over === folder.id}
                  name={folder.name}
                  autoFocus={fresh === folder.id}
                  editable={editable}
                  onRename={(name) => save(rename(layout, folder.id, name))}
                  meta={plural(count(folder.items), noun)}
                  extra={
                    editable && layout.spaces.length > 1 ? (
                      <SelectField label={`Space of ${folder.name}`} variant="chip" align="end" value={space.id} options={spaceOptions} onChange={(to) => save(moveFolder(layout, folder.id, { space: to }))} className="max-w-36" />
                    ) : undefined
                  }
                  up={i > 0 ? () => save(moveFolder(layout, folder.id, { space: space.id, before: space.folders[i - 1]!.id })) : undefined}
                  down={i < space.folders.length - 1 ? () => save(moveFolder(layout, folder.id, { space: space.id, before: space.folders[i + 2]?.id })) : undefined}
                  remove={() => removeFolder(folder, space)}
                  label={`${folder.name} folder`}
                />
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No folders{editable ? ': New Folder makes one, or drag one here.' : '.'}</p>
          )}
        </div>
      ))}
    </section>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="font-display text-lg font-black uppercase">{title}</h2>
      <p className="text-sm text-muted-foreground">{note}</p>
    </header>
  );
}

type Dragged = { kind: 'space' | 'folder'; id: string };
type DropProps = { draggable?: boolean; onDragStart?: (e: DragEvent) => void; onDragEnd?: () => void; onDragOver?: (e: DragEvent) => void; onDragLeave?: (e: DragEvent) => void; onDrop?: (e: DragEvent) => void };

/** Dragging rows: what's being dragged, where it would land (`over`), and the props for rows and drop targets. */
function useDrag(editable: boolean) {
  const dragging = useRef<Dragged | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** A drop target: `accept` gives what dropping the dragged thing does, or null when it can't land here. */
  const target = (id: string, accept: (d: Dragged) => (() => void) | null): DropProps =>
    editable
      ? {
          onDragOver: (e) => {
            const d = dragging.current;
            if (!d || d.id === id || !accept(d)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (over !== id) setOver(id);
          },
          onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === id ? null : o));
          },
          onDrop: (e) => {
            const d = dragging.current;
            const act = d && d.id !== id ? accept(d) : null;
            if (!act) return;
            e.preventDefault();
            act();
            dragging.current = null;
            setOver(null);
          },
        }
      : {};
  /** A row you drag (`self`) that's also a target. */
  const row = (self: Dragged, accept: (d: Dragged) => (() => void) | null): DropProps =>
    editable
      ? {
          draggable: true,
          onDragStart: (e) => {
            dragging.current = self;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-ballad-arrange', self.id);
          },
          onDragEnd: () => {
            dragging.current = null;
            setOver(null);
          },
          ...target(self.id, accept),
        }
      : {};
  return { over, target, row };
}

/** A space or folder: its name (typed into), what's in it, and its controls. */
function Row({
  icon,
  drag,
  over,
  name,
  autoFocus,
  editable,
  onRename,
  meta,
  extra,
  up,
  down,
  remove,
  label,
}: {
  icon: ReactNode;
  drag: DropProps;
  over: boolean;
  name: string;
  autoFocus: boolean;
  editable: boolean;
  onRename: (name: string) => void;
  meta: string;
  extra?: ReactNode;
  up?: () => void;
  down?: () => void;
  remove?: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (autoFocus) input.current?.select();
  }, [autoFocus]);
  const commit = () => {
    if (draft.trim() && draft.trim() !== name) onRename(draft);
    else setDraft(name);
  };
  return (
    <li {...drag} className={cn('group/row flex items-center gap-2 border-t px-3 py-2 first:border-t-0', over && 'shadow-[inset_0_2px_0_var(--color-primary)]')}>
      {editable && <GripVerticalIcon aria-hidden className="size-4 shrink-0 cursor-grab text-muted-foreground/60" />}
      {icon}
      <input
        ref={input}
        aria-label={`Name of the ${label}`}
        readOnly={!editable}
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(name);
            e.stopPropagation();
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[14px] font-medium outline-none hover:border-input focus:border-primary read-only:hover:border-transparent"
      />
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{meta}</span>
      {extra}
      {editable && (
        <span className="flex shrink-0 items-center">
          <Hint label="Move up">
            <Button variant="ghost" size="icon-xs" aria-label={`Move the ${label} up`} disabled={!up} onClick={up}>
              <ArrowUpIcon />
            </Button>
          </Hint>
          <Hint label="Move down">
            <Button variant="ghost" size="icon-xs" aria-label={`Move the ${label} down`} disabled={!down} onClick={down}>
              <ArrowDownIcon />
            </Button>
          </Hint>
          <Hint label={remove ? 'Delete' : 'The last space can’t be deleted'}>
            <span>
              <Button variant="ghost" size="icon-xs" aria-label={`Delete the ${label}`} disabled={!remove} onClick={remove} className="text-muted-foreground hover:text-destructive">
                <Trash2Icon />
              </Button>
            </span>
          </Hint>
        </span>
      )}
    </li>
  );
}
