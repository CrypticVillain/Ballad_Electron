import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { PinIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Empty, Led } from '@/components/shared/bits';
import { Sidebar, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { createEntry } from '@/lib/actions';
import { useLive, useRecord, useWorld, useWorldRecords } from '@/lib/hooks';
import { ENTRY_KINDS, type Entry, type EntryKind } from '@/lib/model';
import { EntrySheet } from './EntrySheet';

export const KIND_INFO: Record<EntryKind, { plural: string; singular: string; code: string; groups: string[]; empty: string }> = {
  character: { plural: 'Characters', singular: 'Character', code: 'CHR', groups: ['Main Cast', 'Supporting', 'Minor'], empty: 'Who is this story about? Add your first character.' },
  place: { plural: 'Places', singular: 'Place', code: 'PLC', groups: [], empty: 'Where does it happen? Add your first place.' },
  lore: { plural: 'Lore', singular: 'Lore Entry', code: 'LOR', groups: [], empty: 'History, factions, materials, magic: add your first piece of lore.' },
};

export const isKind = (value: string): value is EntryKind => (ENTRY_KINDS as readonly string[]).includes(value);

/** A kind's entries grouped: its usual groups first (Main Cast, Supporting, Minor), then the rest by name. */
export function groupEntries(entries: Entry[], kind: EntryKind): [string, Entry[]][] {
  const groups = new Map<string, Entry[]>();
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const group = entry.group || KIND_INFO[kind].plural;
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  const known = KIND_INFO[kind].groups;
  const rank = (g: string) => (known.includes(g) ? known.indexOf(g) : known.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

/** /bible/$kind: opens the kind's first entry, or says how to start. */
export function BibleIndex() {
  const { kind } = useParams({ from: '/bible/$kind' });
  const entries = useWorldRecords('entries');
  if (!isKind(kind)) return <Navigate to="/" replace />;
  const first = groupEntries(
    entries.filter((e) => e.kind === kind),
    kind,
  )[0]?.[1][0];
  if (first) return <Navigate to="/bible/$kind/$entryId" params={{ kind, entryId: first.id }} replace />;
  return (
    <>
      <BibleSidebar kind={kind} />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty title={`No ${KIND_INFO[kind].plural} Yet`} action={<NewEntryButton kind={kind} />}>
          {KIND_INFO[kind].empty}
        </Empty>
      </main>
    </>
  );
}

/** /bible/$kind/$entryId — one entry's sheet, beside its kind's list. */
export function BibleScreen() {
  const { kind, entryId } = useParams({ from: '/bible/$kind/$entryId' });
  const entry = useRecord('entries', entryId);
  if (!isKind(kind)) return <Navigate to="/" replace />;
  if (!entry) return <Navigate to="/bible/$kind" params={{ kind }} replace />;
  return (
    <>
      <BibleSidebar kind={kind} />
      <EntrySheet key={entry.id} entry={entry} />
    </>
  );
}

function NewEntryButton({ kind }: { kind: EntryKind }) {
  const world = useWorld();
  const navigate = useNavigate();
  if (!world) return null;
  return (
    <Button onClick={() => void navigate({ to: '/bible/$kind/$entryId', params: { kind, entryId: createEntry(world.id, kind).id } })}>
      New {KIND_INFO[kind].singular}
    </Button>
  );
}

/**
 * The world bible's sidebar: the kind's pinned entries, then its groups
 * (Main Cast, Supporting…), each entry with the number of scenes it's in.
 */
function BibleSidebar({ kind }: { kind: EntryKind }) {
  const world = useWorld();
  const navigate = useNavigate();
  const entries = useWorldRecords('entries');
  const scenes = useLive('scenes');
  const ofKind = useMemo(() => entries.filter((e) => e.kind === kind), [entries, kind]);
  const pinned = ofKind.filter((e) => e.pinned);

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
      lead={<Led tone={entry.pinned ? 'accent' : 'off'} />}
      label={entry.name || 'Untitled'}
      meta={sceneCounts.get(entry.id) || undefined}
    />
  );

  return (
    <Sidebar
      title={KIND_INFO[kind].plural}
      addLabel={`New ${KIND_INFO[kind].singular}`}
      onAdd={world ? () => void navigate({ to: '/bible/$kind/$entryId', params: { kind, entryId: createEntry(world.id, kind).id } }) : undefined}
    >
      {pinned.length > 0 && (
        <SidebarSection title="Pinned">
          {pinned.map((entry) => (
            <SidebarLink key={entry.id} to={`/bible/${kind}/${entry.id}`} icon={PinIcon} label={entry.name || 'Untitled'} />
          ))}
        </SidebarSection>
      )}
      {groupEntries(ofKind, kind).map(([group, list]) => (
        <SidebarSection key={group} title={`${group} · ${list.length}`}>
          {list.map(row)}
        </SidebarSection>
      ))}
      <div className="mt-auto flex flex-col gap-1 px-2.5 text-xs text-muted-foreground">
        {ENTRY_KINDS.filter((k) => k !== kind).map((other) => (
          <Link key={other} to="/bible/$kind" params={{ kind: other }} className="hover:text-foreground">
            {KIND_INFO[other].plural} →
          </Link>
        ))}
      </div>
    </Sidebar>
  );
}
