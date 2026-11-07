import { CircleUserRoundIcon, FileTextIcon, EraserIcon, EyeIcon, EyeOffIcon, ImageIcon, PenLineIcon, PlusIcon, StickyNoteIcon, Trash2Icon, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Hint } from '@/components/shared/Hint';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { live, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { accountName, useAccounts } from '@/stores/accounts';
import { useVault } from '@/stores/vault';
import { clearMark } from '@/tabletop/battlemap/marks/actions';
import { removeTokens } from '@/tabletop/battlemap/tokens/actions';
import { useBoardTokens } from '@/tabletop/battlemap/tokens/hooks';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import { addLoreDocumentHandout, addNoteHandout, addPictureHandout, deleteHandout, setObjectHidden, type SceneObject } from './handouts';
import type { PlayScene } from './model';
import { usePlayUi } from './ui';

/**
 * Play → Scenes: what's in a scene, under it in the sidebar (the GM's): its
 * tokens, its handouts and everyone's marks, each with an eye. A lit eye:
 * the players see it (the scene's shown, and it isn't hidden); a dark one
 * (crossed out): it's hidden. A plain eye: not hidden, but the scene isn't
 * shown yet. Click the eye, or right-click the row, to hide or show it. A
 * row opens its object: a token picked on the board, a handout in the
 * board's place, marks on what they're drawn on. Add Handout makes a
 * picture or a note, hidden until shown.
 */

type Row = SceneObject & { name: string; icon: LucideIcon; open: () => void; remove?: { label: string; run: () => void } };

/** Whose marks they are, as a row says it. */
function useMarkNames(world: World, me: string) {
  const accounts = useAccounts((s) => s.accounts);
  return (accountId: string) => {
    if (accountId === me) return 'Your Marks';
    const member = world.tabletop?.members?.some((m) => m.accountId === accountId);
    const account = accounts.find((a) => a.id === accountId);
    return member ? `${account ? accountName(account) : 'A Player'}’s Marks` : 'The GM’s Marks';
  };
}

export function SceneObjects({ world, scene, shown, me }: { world: World; scene: PlayScene; shown: boolean; me: string }) {
  const tokens = useBoardTokens(scene.id);
  const allHandouts = useVault((s) => s.vault.handouts);
  const allMarks = useVault((s) => s.vault.marks);
  const allEntries = useVault((s) => s.vault.entries);
  /** The campaign's lore documents, to bring into the scene. */
  const loreDocuments = useMemo(
    () =>
      live(allEntries)
        .filter((e) => e.worldId === world.id && e.kind === 'lore' && e.document)
        .sort((a, b) => (a.name || 'Document').localeCompare(b.name || 'Document')),
    [allEntries, world.id],
  );
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const setHandoutId = usePlayUi((s) => s.setHandoutId);
  const setSelected = useBoardUi((s) => s.setSelected);
  const markName = useMarkNames(world, me);
  const handouts = useMemo(
    () =>
      live(allHandouts)
        .filter((h) => h.sceneId === scene.id)
        .sort((a, b) => a.order - b.order),
    [allHandouts, scene.id],
  );
  const marks = useMemo(() => live(allMarks).filter((m) => m.sceneId === scene.id), [allMarks, scene.id]);
  const onHandout = new Map(handouts.map((h) => [h.id, h]));

  const openScene = () => setSceneId(scene.id);
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Tokens',
      rows: tokens.map((v) => ({
        kind: 'token',
        id: v.token.id,
        hidden: v.token.hidden,
        name: v.name,
        icon: CircleUserRoundIcon,
        open: () => {
          openScene();
          setSelected([v.token.id]);
        },
        remove: {
          label: 'Take Off The Map',
          run: () => {
            const undo = removeTokens([v.token.id]);
            toast('Token Removed', { description: v.name, action: { label: 'Undo', onClick: undo } });
          },
        },
      })),
    },
    {
      title: 'Handouts',
      rows: handouts.map((h) => ({
        kind: 'handout',
        id: h.id,
        hidden: h.hidden,
        name: h.name || 'Handout',
        icon: h.image ? ImageIcon : StickyNoteIcon,
        open: () => {
          setSceneId(scene.id);
          setHandoutId(h.id);
        },
        remove: { label: 'Delete Handout', run: () => deleteHandout(h) },
      })),
    },
    {
      title: 'Marks',
      rows: marks.map((m) => {
        const on = onHandout.get(m.onId);
        return {
          kind: 'mark',
          id: m.id,
          hidden: m.hidden,
          name: on ? `${markName(m.accountId)} · ${on.name || 'Handout'}` : markName(m.accountId),
          icon: PenLineIcon,
          open: () => {
            setSceneId(scene.id);
            if (on) setHandoutId(on.id);
          },
          remove: {
            label: 'Clear These Marks',
            run: () => {
              const undo = clearMark(m.id);
              toast('Marks Cleared', { description: markName(m.accountId), action: { label: 'Undo', onClick: undo } });
            },
          },
        };
      }),
    },
  ];

  return (
    // The scene's row is draggable and has a menu of its own: these rows keep their drags and right-clicks to themselves.
    <div draggable onDragStart={(e) => (e.preventDefault(), e.stopPropagation())} onContextMenu={(e) => e.stopPropagation()} className="mb-1 ml-[18px] flex flex-col border-l pl-1.5">
      {groups.map(
        (g) =>
          g.rows.length > 0 && (
            <div key={g.title} role="group" aria-label={`${scene.name || 'Untitled Scene'}: ${g.title}`} className="flex flex-col">
              <span className="px-2 pt-1.5 pb-0.5 font-mono text-[9.5px] tracking-[0.08em] text-muted-foreground uppercase">
                {g.title} · {g.rows.length}
              </span>
              {g.rows.map((row) => (
                <ObjectRow key={row.id} row={row} shown={shown} />
              ))}
            </div>
          ),
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <PlusIcon className="size-3.5" /> Add Handout
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() =>
              void addPictureHandout(scene).then((h) => {
                if (!h) return;
                setSceneId(scene.id);
                setHandoutId(h.id);
              })
            }
          >
            <ImageIcon /> A Picture…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const h = addNoteHandout(scene);
              setSceneId(scene.id);
              setHandoutId(h.id);
            }}
          >
            <StickyNoteIcon /> A Note
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileTextIcon /> A Document From Lore
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              {loreDocuments.length ? (
                loreDocuments.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onSelect={() => {
                      const h = addLoreDocumentHandout(scene, n);
                      setSceneId(scene.id);
                      setHandoutId(h.id);
                    }}
                  >
                    <FileTextIcon /> <span className="max-w-56 truncate">{n.name || 'Document'}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No documents in Lore yet</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** An eye: lit, the players see it; plain, they will once the scene's shown; crossed out and dark, it's hidden. */
export function VisibilityEye({ hidden, shown, label, onToggle }: { hidden: boolean; shown: boolean; label: string; onToggle: () => void }) {
  const tip = hidden ? 'Hidden from the players · click to show' : shown ? 'The players see it · click to hide' : 'Shows when the scene does · click to hide';
  return (
    <Hint label={tip}>
      <button
        type="button"
        aria-label={`${hidden ? 'Show' : 'Hide'} ${label}`}
        aria-pressed={!hidden}
        data-visible={!hidden && shown ? '' : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn('flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent', hidden ? 'text-foreground/35' : shown ? 'text-primary' : 'text-muted-foreground')}
      >
        {hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className={cn('size-3.5', shown && 'drop-shadow-[0_0_4px_var(--primary)]')} />}
      </button>
    </Hint>
  );
}

function ObjectRow({ row, shown }: { row: Row; shown: boolean }) {
  const Icon = row.icon;
  const toggle = () => setObjectHidden(row, !row.hidden);
  const item: ReactNode = (
    <div className="group/object flex min-h-[28px] items-center gap-1 rounded-md pr-1 hover:bg-sidebar-accent">
      <button type="button" onClick={row.open} className={cn('flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left text-[12.5px]', row.hidden && 'text-muted-foreground')}>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">{row.name}</span>
      </button>
      <VisibilityEye hidden={row.hidden} shown={shown} label={row.name} onToggle={toggle} />
    </div>
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{item}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled className="max-w-56 truncate font-medium opacity-100">
          {row.name}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={toggle}>
          {row.hidden ? <EyeIcon /> : <EyeOffIcon />} {row.hidden ? 'Show To The Players' : 'Hide From The Players'}
        </ContextMenuItem>
        {row.remove && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={row.remove.run}>
              {row.kind === 'mark' ? <EraserIcon /> : <Trash2Icon />} {row.remove.label}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
