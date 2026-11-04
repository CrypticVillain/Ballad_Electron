import { useNavigate } from '@tanstack/react-router';
import { CheckIcon, LockIcon, RefreshCwIcon, Share2Icon, Trash2Icon, UndoIcon, UsersIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Portrait } from '@/components/shared/Portrait';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { useEntryLayout, useMapLayouts } from '@/components/shell/layouts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenuItem } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCharacter, useLive, useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import { whereIs } from '@/lib/layout';
import type { EntryKind, Layout, PlayerCharacter, ShareCollection, SharedPlace, SharedVia } from '@/lib/model';
import { kindInfo } from '@/lib/sections';
import { reshare, setRecipients, shareItems, showShared, unlockShared, unshare, updateShares, useWorldShares, seeShared } from '@/lib/shared';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { useUi, type ShareTarget } from '@/stores/ui';

/**
 * Sharing, on screen (lib/shared does the work):
 *
 *   - ShareButton / UpdateSharedButton: the DM's, on an NPC's or a map's page;
 *   - ShareDialog: who gets it (one thing, or a whole space or folder), and
 *     whether the DM's structure goes along;
 *   - SharedTracker: everything the DM has shared, to update, change who has
 *     it, or stop sharing;
 *   - SharedSwitch: the player's, on a shared thing: Unlock to edit it, then
 *     DM's Original / Your Version to switch between the two.
 */

/** The campaign's characters, the people things are shared with. */
function useParty(): PlayerCharacter[] {
  const pcs = useWorldRecords('pcs');
  return useMemo(() => pcs.filter((pc) => !pc.archivedAt).sort((a, b) => (a.name || 'Unnamed').localeCompare(b.name || 'Unnamed')), [pcs]);
}

const who = (pc: PlayerCharacter) => pc.name || 'Unnamed Character';
const names = (ids: string[], party: PlayerCharacter[]) => {
  const list = ids.map((id) => party.find((pc) => pc.id === id)).filter((pc): pc is PlayerCharacter => Boolean(pc));
  if (list.length && list.length === party.length) return 'Everyone';
  return list.map((pc) => who(pc).split(' ')[0]).join(', ') || 'Nobody';
};

// ── The DM's buttons ───────────────────────────────────────────────────

/** Share (or "Shared · 3"): opens the Share popup for this one thing. */
export function ShareButton({ collection, id, name }: { collection: ShareCollection; id: string; name: string }) {
  const shares = useWorldShares();
  const share = shares.find((s) => s.sourceId === id);
  const party = useParty();
  return (
    <>
      {share?.status === 'changed' && <UpdateSharedButton shareId={share.id} name={name} />}
      <Hint label={share ? `Shared with ${names(share.recipients, party)}. Click to change who has it.` : 'Players see nothing until you share it'}>
        <Button variant="outline" size="sm" className={cn('rounded-full font-mono text-xs tracking-[0.08em] uppercase', share && 'border-online/60')} onClick={() => useUi.getState().setShare({ collection, ids: [id], title: name })}>
          {share ? <UsersIcon /> : <Share2Icon />}
          {share ? `Shared · ${share.recipients.length}` : 'Share'}
        </Button>
      </Hint>
    </>
  );
}

/** Update Shared: sends your edits since you shared it to the players who have it. */
export function UpdateSharedButton({ shareId, name }: { shareId: string; name: string }) {
  return (
    <Hint label="You’ve changed it since you shared it. Players still have the old version until you send this.">
      <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => updateShared([shareId], name)}>
        <RefreshCwIcon /> Update Shared
      </Button>
    </Hint>
  );
}

/** Sends updates, and says so. */
export function updateShared(shareIds: string[], what: string) {
  const n = updateShares(shareIds);
  toast(n ? 'Shared Copies Updated' : 'Nothing To Update', { description: n ? `${what}: the players have your latest.` : 'They already have your latest.' });
}

/** Stops sharing, with Undo. */
export function stopSharing(shareId: string, name: string) {
  unshare(shareId);
  toast('Stopped Sharing', { description: `${name}: the players no longer have it.`, action: { label: 'Undo', onClick: () => reshare(shareId) } });
}

/**
 * The DM's sidebar, for sharing: each thing's share status (for its row), and
 * the right-click items: Share…, Update Shared and Stop Sharing on a thing;
 * Share Space… / Share Folder… and Update Shared on a space or folder. Nothing
 * for players.
 */
export function useShareMenus(collection: ShareCollection, nameOf: (id: string) => string) {
  const dm = useRole() === 'dm';
  const shares = useWorldShares();
  const byId = useMemo(() => new Map(shares.map((s) => [s.sourceId, s])), [shares]);
  if (!dm) return { status: (_id: string) => undefined, itemMenu: undefined, groupMenu: undefined };
  const share = (ids: string[], title: string) => useUi.getState().setShare({ collection, ids, title });
  return {
    status: (id: string) => byId.get(id)?.status,
    itemMenu: (id: string) => {
      const had = byId.get(id);
      return (
        <>
          <ContextMenuItem onSelect={() => share([id], nameOf(id))}>
            <Share2Icon /> {had ? 'Who Has It…' : 'Share…'}
          </ContextMenuItem>
          {had?.status === 'changed' && (
            <ContextMenuItem onSelect={() => updateShared([had.id], nameOf(id))}>
              <RefreshCwIcon /> Update Shared
            </ContextMenuItem>
          )}
          {had && (
            <ContextMenuItem variant="destructive" onSelect={() => stopSharing(had.id, nameOf(id))}>
              <XIcon /> Stop Sharing
            </ContextMenuItem>
          )}
        </>
      );
    },
    groupMenu: (ids: string[], name: string, what: 'space' | 'folder') => {
      const changed = ids.map((id) => byId.get(id)).filter((s) => s?.status === 'changed');
      return (
        <>
          <ContextMenuItem onSelect={() => share(ids, `The ${name} ${what === 'space' ? 'Space' : 'Folder'}`)}>
            <Share2Icon /> Share {what === 'space' ? 'Space' : 'Folder'}…
          </ContextMenuItem>
          {changed.length > 0 && (
            <ContextMenuItem onSelect={() => updateShared(changed.map((s) => s!.id), `${name}: ${changed.length}`)}>
              <RefreshCwIcon /> Update Shared · {changed.length}
            </ContextMenuItem>
          )}
        </>
      );
    },
  };
}

/** On a player's sidebar row: an orange dot when the DM has sent an update they haven't opened yet. */
export function UpdatedDot({ via }: { via?: SharedVia }) {
  if (!via?.updated) return null;
  return (
    <Hint label="Updated by the DM">
      <span role="img" aria-label="Updated by the DM" className="size-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
    </Hint>
  );
}

/** A shared thing's mark in the DM's sidebar: shared (people), or changed since (an orange dot too). */
export function SharedMark({ status }: { status?: 'current' | 'changed' | 'gone' }) {
  if (!status) return null;
  return (
    <span className="relative flex shrink-0" aria-label={status === 'changed' ? 'Shared; changed since' : 'Shared'}>
      <UsersIcon className="size-3.5 text-muted-foreground" />
      {status === 'changed' && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
    </span>
  );
}

// ── The Share popup ────────────────────────────────────────────────────

export function ShareDialog() {
  const target = useUi((s) => s.share);
  return target ? <ShareForm key={target.ids.join()} target={target} onClose={() => useUi.getState().setShare(null)} /> : null;
}

function ShareForm({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const world = useWorld();
  const party = useParty();
  const shares = useWorldShares();
  const vault = useVault((s) => s.vault);
  const kind = target.collection === 'entries' ? vault.entries[target.ids[0]!]?.kind : undefined;
  const single = target.ids.length === 1;
  const existing = single ? shares.find((s) => s.sourceId === target.ids[0]) : undefined;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(existing ? existing.recipients : party.map((pc) => pc.id)));
  const [items, setItems] = useState<Set<string>>(() => new Set(target.ids));
  const [structure, setStructure] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const nameOf = (id: string) => (target.collection === 'entries' ? vault.entries[id]?.name : vault.maps[id]?.name) || 'Untitled';
  const changed = target.ids.filter((id) => shares.find((s) => s.sourceId === id)?.status === 'changed');
  const noun = target.collection === 'maps' ? 'map' : kind ? kindInfo(kind, 'dnd').singular : 'thing';

  if (!world) return null;
  const go = (layout: Layout | undefined) => {
    const ids = target.ids.filter((id) => items.has(id));
    const places: Record<string, SharedPlace> = {};
    if (structure && layout) {
      for (const id of ids) {
        const at = whereIs(layout, id);
        if (at) places[id] = { space: at.space.name, folder: at.folder?.name };
      }
    }
    const recipients = [...picked];
    if (existing && !recipients.length) {
      stopSharing(existing.id, nameOf(existing.sourceId));
      return onClose();
    }
    const n = shareItems({ worldId: world.id, collection: target.collection, ids, recipients, mode: single ? 'exact' : 'add', places: structure ? places : undefined, refresh });
    toast(n ? 'Shared' : 'Nothing Shared', { description: n ? `${single ? nameOf(ids[0]!) : `${n} ${noun}s`} with ${names(recipients, party)}.` : 'Pick who gets it.' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Share {target.title}</DialogTitle>
          <DialogDescription>
            {single
              ? 'Players get it as it is now. Your later edits reach them only when you Update Shared. They can’t change yours, but they can keep a version of their own.'
              : `Each ${noun} is shared on its own. ${existing ? '' : 'Anyone who already has one keeps it.'}`}
          </DialogDescription>
        </DialogHeader>

        {!single && (
          <section className="flex flex-col gap-1.5">
            <Heading
              title={`${items.size} of ${target.ids.length} ${noun}s`}
              all={items.size === target.ids.length}
              onAll={(on) => setItems(new Set(on ? target.ids : []))}
            />
            <div className="flex max-h-40 flex-col overflow-y-auto rounded-lg border">
              {target.ids.map((id) => (
                <Tick key={id} checked={items.has(id)} onChange={(on) => setItems(toggle(items, id, on))}>
                  <span className="truncate">{nameOf(id)}</span>
                  {shares.find((s) => s.sourceId === id) && <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">Shared · {names(shares.find((s) => s.sourceId === id)!.recipients, party)}</span>}
                </Tick>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <Heading title="Share With" all={picked.size === party.length && party.length > 0} onAll={(on) => setPicked(new Set(on ? party.map((pc) => pc.id) : []))} />
          {party.length ? (
            <div className="flex max-h-56 flex-col overflow-y-auto rounded-lg border">
              {party.map((pc) => (
                <Tick key={pc.id} checked={picked.has(pc.id)} onChange={(on) => setPicked(toggle(picked, pc.id, on))}>
                  <Portrait image={pc.image} name={pc.name} className="size-6 rounded-full" text="text-[9px]" />
                  <span className="truncate font-medium">{who(pc)}</span>
                  {pc.player && <span className="truncate text-muted-foreground">· {pc.player}</span>}
                </Tick>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-3 text-[13px] text-muted-foreground">No characters in this campaign yet: add the party first.</p>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-[13px]">
            <Checkbox checked={structure} onCheckedChange={(v) => setStructure(v === true)} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Share the organizational structure</span>
              <span className="text-muted-foreground">It starts in your space and folder in their sidebar. Each player can still arrange theirs however they like; it changes nobody else’s.</span>
            </span>
          </label>
          {changed.length > 0 && (
            <label className="flex items-start gap-2.5 text-[13px]">
              <Checkbox checked={refresh} onCheckedChange={(v) => setRefresh(v === true)} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Also send my latest edits</span>
                <span className="text-muted-foreground">
                  {changed.length === 1 ? 'It’s' : `${changed.length} are`} changed since you shared {changed.length === 1 ? 'it' : 'them'}. Without this, everyone gets the version already shared.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <LayoutFor collection={target.collection} kind={kind}>
            {(layout) => (
              <Button variant={existing && !picked.size ? 'destructive' : 'default'} disabled={!items.size || (!picked.size && !existing)} onClick={() => go(layout)}>
                {existing && !picked.size ? 'Stop Sharing' : existing ? 'Save' : <><Share2Icon /> Share</>}
              </Button>
            )}
          </LayoutFor>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The DM's sidebar layout of what's being shared (for its structure). */
function LayoutFor({ collection, kind, children }: { collection: ShareCollection; kind?: EntryKind; children: (layout: Layout | undefined) => ReactNode }) {
  return collection === 'maps' ? <MapsLayout>{children}</MapsLayout> : kind ? <EntryLayout kind={kind}>{children}</EntryLayout> : <>{children(undefined)}</>;
}
function MapsLayout({ children }: { children: (layout: Layout) => ReactNode }) {
  return <>{children(useMapLayouts().campaign.layout)}</>;
}
function EntryLayout({ kind, children }: { kind: EntryKind; children: (layout: Layout) => ReactNode }) {
  return <>{children(useEntryLayout(kind).layout)}</>;
}

const toggle = (set: Set<string>, id: string, on: boolean) => {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

function Heading({ title, all, onAll }: { title: string; all: boolean; onAll: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="label">{title}</span>
      <button type="button" onClick={() => onAll(!all)} className="text-[12px] text-muted-foreground hover:text-foreground">
        {all ? 'None' : 'All'}
      </button>
    </div>
  );
}

function Tick({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 border-t px-3 py-1.5 text-[13px] first:border-t-0 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {children}
    </label>
  );
}

// ── The tracker ────────────────────────────────────────────────────────

/** Everything the DM has shared in this campaign: what, with whom, whether it's changed since. */
export function SharedTracker() {
  const open = useUi((s) => s.sharedTracker);
  return open ? <TrackerBody onClose={() => useUi.getState().setSharedTracker(false)} /> : null;
}

function TrackerBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const shares = useWorldShares();
  const party = useParty();
  const entries = useLive('entries');
  const maps = useLive('maps');
  const [person, setPerson] = useState<string>('');
  const [kindFilter, setKindFilter] = useState<string>('');
  const label = (s: (typeof shares)[number]) => {
    if (s.collection === 'maps') return 'Map';
    const k = (s.snapshot as { kind?: EntryKind }).kind;
    return k ? kindInfo(k, 'dnd').singular : 'Entry';
  };
  const nameOf = (s: (typeof shares)[number]) =>
    (s.collection === 'entries' ? entries.find((e) => e.id === s.sourceId)?.name : maps.find((m) => m.id === s.sourceId)?.name) || (s.snapshot as { name?: string }).name || 'Untitled';
  const kinds = [...new Set(shares.map(label))].sort();
  const list = shares
    .filter((s) => !person || s.recipients.includes(person))
    .filter((s) => !kindFilter || label(s) === kindFilter)
    .sort((a, b) => label(a).localeCompare(label(b)) || nameOf(a).localeCompare(nameOf(b)));
  const changed = shares.filter((s) => s.status === 'changed');
  const open = (s: (typeof shares)[number]) => {
    onClose();
    if (s.collection === 'maps') void navigate({ to: '/maps/$mapId', params: { mapId: s.sourceId } });
    else {
      const k = (s.snapshot as { kind?: EntryKind }).kind ?? 'character';
      void navigate({ to: '/bible/$kind/$entryId', params: { kind: k, entryId: s.sourceId } });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-64px)] flex-col sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Shared With Players</DialogTitle>
          <DialogDescription>Everything you’ve shared in this campaign. Players have it as you last sent it; Update sends your edits since.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <SelectField label="Shared with" variant="chip" value={person} onChange={setPerson} options={[{ value: '', label: 'Everyone' }, ...party.map((pc) => ({ value: pc.id, label: who(pc) }))]} />
          <SelectField label="Kind" variant="chip" value={kindFilter} onChange={setKindFilter} options={[{ value: '', label: 'Every Kind' }, ...kinds.map((k) => ({ value: k, label: `${k}s` }))]} />
          <span className="flex-1 font-mono text-[11px] text-muted-foreground">{list.length} shared</span>
          <Button size="sm" disabled={!changed.length} onClick={() => updateShared(changed.map((s) => s.id), `${changed.length} ${changed.length === 1 ? 'thing' : 'things'}`)}>
            <RefreshCwIcon /> Update All Changed{changed.length ? ` · ${changed.length}` : ''}
          </Button>
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {list.length ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  <th className="py-2 font-normal">Shared</th>
                  <th className="py-2 font-normal">With</th>
                  <th className="py-2 font-normal">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-b-0">
                    <td className="py-2 pr-3">
                      <button type="button" onClick={() => open(s)} className="flex min-w-0 flex-col text-left hover:underline">
                        <span className="truncate font-medium">{nameOf(s)}</span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          {label(s)}
                          {s.version > 1 && ` · Update ${s.version - 1}`}
                          {s.place && ` · ${[s.place.space, s.place.folder].filter(Boolean).join(' / ')}`}
                        </span>
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <Recipients shareId={s.id} recipients={s.recipients} party={party} />
                    </td>
                    <td className="py-2 pr-3">
                      {s.status === 'current' ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CheckIcon className="size-3.5 text-online" /> Up to date
                        </span>
                      ) : s.status === 'changed' ? (
                        <span className="font-medium text-primary">Changed since</span>
                      ) : (
                        <span className="text-muted-foreground">You deleted yours</span>
                      )}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {s.status === 'changed' && (
                        <Button size="xs" variant="outline" onClick={() => updateShared([s.id], nameOf(s))}>
                          <RefreshCwIcon /> Update
                        </Button>
                      )}
                      <Hint label="Stop sharing it">
                        <Button size="icon-xs" variant="ghost" aria-label={`Stop sharing ${nameOf(s)}`} onClick={() => stopSharing(s.id, nameOf(s))} className="ml-1 text-muted-foreground hover:text-destructive">
                          <Trash2Icon />
                        </Button>
                      </Hint>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-1 py-8 text-center text-[13px] text-muted-foreground">{shares.length ? 'Nothing matches.' : 'Nothing shared yet. Share an NPC, place, lore entry or map from its page or the sidebar (right-click).'}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Who has a shared thing: the names, click to change. */
function Recipients({ shareId, recipients, party }: { shareId: string; recipients: string[]; party: PlayerCharacter[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex max-w-56 items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left hover:bg-muted">
          <UsersIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{names(recipients, party)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {party.map((pc) => (
          <label key={pc.id} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted">
            <Checkbox
              checked={recipients.includes(pc.id)}
              onCheckedChange={(v) => setRecipients(shareId, v === true ? [...recipients, pc.id] : recipients.filter((id) => id !== pc.id))}
            />
            <span className="truncate">{who(pc)}</span>
          </label>
        ))}
        <p className="px-2 pt-1 pb-1.5 text-[11.5px] text-muted-foreground">Untick everyone to stop sharing it.</p>
      </PopoverContent>
    </Popover>
  );
}

// ── The player's switch ────────────────────────────────────────────────

/**
 * On a thing shared with you: Unlock to make a version of your own and edit
 * it; after that, switch between the DM's original (read-only) and your
 * version (the last you saved) as often as you like.
 *
 * Updates from the DM: opening something that was updated is reading it (its
 * sidebar dot goes). One that arrives while it's already open isn't: its dot
 * stays, with Updated By The DM up here, until you click that or leave it.
 */
export function SharedSwitch({ via }: { via: SharedVia }) {
  const pc = useCharacter();
  const latest = useRef({ via, pc });
  useEffect(() => {
    latest.current = { via, pc };
  });
  useEffect(() => {
    // Opened: an update already waiting is read now.
    const opened = latest.current;
    if (opened.pc && opened.via.updated) seeShared(opened.via.shareId, opened.pc.id);
    // Left: an update that came while it was open is read now.
    return () => {
      const left = latest.current;
      if (left.pc && left.via.updated) seeShared(left.via.shareId, left.pc.id);
    };
  }, []);
  if (!pc) return null;
  const updated = via.updated && (
    <Hint label="The DM sent a newer version while you had this open. Click once you’ve read it (or leave it).">
      <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => seeShared(via.shareId, pc.id)}>
        <span className="size-2 rounded-full bg-primary-foreground" /> Updated By The DM
      </Button>
    </Hint>
  );
  if (!via.edited) {
    return (
      <>
        {updated}
        <Hint label="It’s the DM’s, read-only. Unlock it to keep a version of your own you can edit (the DM’s stays as it is).">
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => unlockShared(via.shareId, pc.id)}>
            <LockIcon /> Unlock To Edit
          </Button>
        </Hint>
      </>
    );
  }
  const edited = via.showing === 'edited';
  return (
    <>
      {updated}
      <Hint label={edited ? 'Revert: show the DM’s original. Your version is kept: switch back any time.' : 'Show your version again (as you last saved it), to edit.'}>
        <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => showShared(via.shareId, pc.id, edited ? 'original' : 'edited')}>
          {edited ? <UndoIcon /> : <LockIcon />}
          {edited ? 'Revert To DM’s' : 'Back To Mine'}
        </Button>
      </Hint>
      <span className={cn('rounded-full px-2.5 py-1 font-mono text-[10.5px] tracking-[0.08em] uppercase', edited ? 'bg-online/15 text-online' : 'bg-muted text-muted-foreground')}>{edited ? 'Your Version' : 'DM’s Original'}</span>
    </>
  );
}
