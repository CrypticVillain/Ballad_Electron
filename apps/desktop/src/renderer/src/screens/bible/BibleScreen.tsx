import { Link, Navigate, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { PinIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Empty, Led } from '@/components/shared/bits';
import { Sidebar, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { createEntry } from '@/lib/actions';
import { useCharacter, useLive, useRole, useSection, useWorld } from '@/lib/hooks';
import { deleteShared, dropCopy, useWorldEntry } from '@/lib/shared';
import { confirmDelete, SharedMark, UpdatedDot, useShareMenus } from '@/components/tabletop/Sharing';
import { ENTRY_KINDS, type Entry, type EntryKind, type Section } from '@/lib/model';
import { kindInfo, SECTION_INFO, worldSection } from '@/lib/sections';
import { EntrySheet } from './EntrySheet';
import { Portrait } from '@/components/shared/Portrait';
import { Spaces } from '@/components/shell/Spaces';
import { useEntryLayout, useVisibleEntries } from '@/components/shell/layouts';
import { openNew } from '@/components/dialogs/NewDialog';
import { openNewLore } from '@/writing/lore/LorePanels';

export const isKind = (value: string): value is EntryKind => (ENTRY_KINDS as readonly string[]).includes(value);

/** A kind's entries grouped: its usual groups first (Main Cast, Supporting, Minor), then the rest by name. */
export function groupEntries(entries: Entry[], kind: EntryKind, section: Section): [string, Entry[]][] {
  const info = kindInfo(kind, section);
  const groups = new Map<string, Entry[]>();
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const group = entry.group || info.plural;
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  const rank = (g: string) => (info.groups.includes(g) ? info.groups.indexOf(g) : info.groups.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

/** /bible/$kind: opens the kind's first entry, or says how to start. */
export function BibleIndex() {
  const { kind } = useParams({ from: '/bible/$kind' });
  const section = useSection();
  const entries = useVisibleEntries(isKind(kind) ? kind : 'character');
  const player = useRole() === 'player';
  if (!isKind(kind) || !SECTION_INFO[section].kinds.includes(kind)) return <Navigate to="/" replace />;
  const first = groupEntries(entries, kind, section)[0]?.[1][0];
  if (first) return <Navigate to="/bible/$kind/$entryId" params={{ kind, entryId: first.id }} replace />;
  const info = kindInfo(kind, section);
  return (
    <>
      <BibleSidebar kind={kind} />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty title={player ? `No ${info.plural} Shared Yet` : `No ${info.plural} Yet`} action={player ? undefined : <NewEntryButton kind={kind} />}>
          {player ? 'What the GM shares with you shows here. It’s yours to arrange, and to keep your own version of.' : info.empty}
        </Empty>
      </main>
    </>
  );
}

/** /bible/$kind/$entryId — one entry's sheet, beside its kind's list. */
export function BibleScreen() {
  const { kind, entryId } = useParams({ from: '/bible/$kind/$entryId' });
  const entry = useWorldEntry(entryId);
  const world = useWorld();
  if (!isKind(kind)) return <Navigate to="/" replace />;
  // Another world's entry (switched away), or (Player view) one that isn't shared with you: back to the list.
  if (!entry || entry.worldId !== world?.id) return <Navigate to="/bible/$kind" params={{ kind }} replace />;
  return (
    <>
      <BibleSidebar kind={kind} />
      <EntrySheet key={entry.id} entry={entry} />
    </>
  );
}

/**
 * New NPC or New Place in a campaign starts at the New popup (from the
 * Library, or blank); everything else goes straight to a blank one.
 */
function useNewEntry(kind: EntryKind): (() => void) | null {
  const world = useWorld();
  const navigate = useNavigate();
  if (!world) return null;
  const blank = () => void navigate({ to: '/bible/$kind/$entryId', params: { kind, entryId: createEntry(world.id, kind).id } });
  if (world.section === 'tabletop' && (kind === 'character' || kind === 'place')) return () => openNew(kind === 'character' ? 'npc' : 'place', blank);
  // A Writing world's lore asks what kind first (writing/lore).
  if (world.section === 'writing' && kind === 'lore') return () => openNewLore(world.id);
  return blank;
}

function NewEntryButton({ kind }: { kind: EntryKind }) {
  const world = useWorld();
  const create = useNewEntry(kind);
  if (!world || !create) return null;
  return (
    <Button onClick={create}>
      New {kindInfo(kind, world.section).singular}
    </Button>
  );
}

/**
 * The world bible's sidebar: the kind's pinned entries, then its spaces
 * (to start, the section's groups: Allies, Villains…; Main Cast, Supporting…)
 * with folders inside them, each entry with the number of scenes it's in and
 * its picture. Drag entries, folders and spaces to arrange them, or
 * right-click one (components/shell/Spaces). The GM's rows show what's shared
 * (and changed since), and right-click shares; a player's list is what's
 * shared with them, arranged their own way.
 */
function BibleSidebar({ kind }: { kind: EntryKind }) {
  const world = useWorld();
  const section = useSection();
  const { layout, save, editable, entries: ofKind } = useEntryLayout(kind);
  const scenes = useLive('scenes');
  const pinned = ofKind.filter((e) => e.pinned);
  const info = kindInfo(kind, section);
  const byId = useMemo(() => new Map(ofKind.map((e) => [e.id, e])), [ofKind]);
  const player = useRole() === 'player';
  const pc = useCharacter();
  const sharing = useShareMenus('entries', (id) => byId.get(id)?.name || 'Untitled');
  const create = useNewEntry(kind);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  /** Delete, asked first: the GM's (players lose the shared version), or a player's own copy of one the GM deleted. */
  const remove = (id: string) => {
    const entry = byId.get(id);
    if (!entry) return;
    const name = entry.name || 'Untitled';
    const after = () => path === `/bible/${kind}/${id}` && void navigate({ to: '/bible/$kind', params: { kind } });
    if (!player) confirmDelete({ noun: info.singular, name, area: `${worldSection(section)}:bible`, sharedId: id, remove: () => deleteShared('entries', id), after });
    else if (entry.via?.ended && pc) confirmDelete({ noun: info.singular, name, area: `${worldSection(section)}:bible`, extra: 'It’s your own version: the GM deleted theirs.', remove: () => dropCopy(entry.via!.shareId, pc.id), after });
  };

  /** Scenes each entry is in (mentioned, POV or place). */
  const sceneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scene of scenes) {
      for (const id of new Set([...scene.links, scene.povId, scene.placeId])) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [scenes]);

  const row = (entry: Entry) => (
    <SidebarLink
      key={entry.id}
      to={`/bible/${kind}/${entry.id}`}
      lead={
        <>
          {!entry.image && <Led tone={entry.pinned ? 'accent' : 'off'} />}
          {entry.image && <Portrait image={entry.image} name={entry.name} className="size-5 rounded-full" />}
          <SharedMark status={sharing.status(entry.id)} />
          <UpdatedDot via={entry.via} />
        </>
      }
      label={entry.name || 'Untitled'}
      meta={sceneCounts.get(entry.id) || undefined}
    />
  );

  return (
    <Sidebar
      title={info.plural}
      addLabel={`New ${info.singular}`}
      onAdd={create && !player ? create : undefined}
    >
      {pinned.length > 0 && (
        <SidebarSection title="Pinned">
          {pinned.map((entry) => (
            <SidebarLink key={entry.id} to={`/bible/${kind}/${entry.id}`} icon={entry.image ? undefined : PinIcon} lead={
                entry.image || entry.via?.updated ? (
                  <>
                    {entry.image && <Portrait image={entry.image} name={entry.name} className="size-5 rounded-full" />}
                    <UpdatedDot via={entry.via} />
                  </>
                ) : undefined
              } label={entry.name || 'Untitled'} />
          ))}
        </SidebarSection>
      )}
      {world && (
        <Spaces
          scope={player ? `${pc?.id}:${kind}` : `${world.id}:${kind}`}
          layout={layout}
          items={byId}
          render={row}
          nameOf={(e) => e.name || 'Untitled'}
          editable={editable}
          noun={info.singular}
          onChange={save}
          itemMenu={sharing.itemMenu}
          groupMenu={sharing.groupMenu}
          onDelete={remove}
          deletable={(id) => !player || Boolean(byId.get(id)?.via?.ended)}
        />
      )}
      <div className="mt-auto flex flex-col gap-1 px-2.5 text-xs text-muted-foreground">
        {SECTION_INFO[section].kinds
          .filter((k) => k !== kind)
          .map((other) => (
            <Link key={other} to="/bible/$kind" params={{ kind: other }} className="hover:text-foreground">
              {kindInfo(other, section).plural} →
            </Link>
          ))}
      </div>
    </Sidebar>
  );
}
