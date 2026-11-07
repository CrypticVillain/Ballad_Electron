import { SearchIcon, SwordsIcon, XIcon } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { PillTabs } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { Portrait } from '@/components/shared/Portrait';
import { Input } from '@/components/ui/input';
import { useWorldRecords } from '@/lib/hooks';
import type { Encounter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { sizeFromKind } from '../geometry/tokens';
import { TOKEN_SIZES } from '../model';
import { TOKEN_MIME, type TokenSource } from '../tokens/actions';
import type { TokenView } from '../tokens/resolve';

/**
 * Tabletop → Battle maps: Add Tokens (T). The party, the campaign's Bestiary,
 * its NPCs and its encounters (all of an encounter's combatants at once), and
 * a plain token: drag one onto the board where it goes, or click it to put
 * it on the free square nearest the middle of the view. Party members already
 * on the map are marked (they're on it once). On an encounter's own map, its
 * combatants not on it yet come first.
 */

type Tab = 'here' | 'party' | 'bestiary' | 'npcs' | 'encounters';

type Row = { key: string; drag?: { kind: TokenSource['kind']; id: string | null }; source?: TokenSource; encounter?: Encounter; name: string; detail?: string; image?: string; placed?: boolean };

export function TokenTray({
  views,
  encounter,
  onAdd,
  onAddEncounter,
  onClose,
}: {
  views: TokenView[];
  /** The map is this encounter's: its combatants not on it yet are offered first. */
  encounter?: Encounter;
  onAdd: (source: TokenSource) => void;
  onAddEncounter: (encounter: Encounter, onlyMissing: boolean) => void;
  onClose: () => void;
}) {
  const tabs: { value: Tab; label: string }[] = [
    ...(encounter ? [{ value: 'here' as const, label: 'This Fight' }] : []),
    { value: 'party', label: 'Party' },
    { value: 'bestiary', label: 'Bestiary' },
    { value: 'npcs', label: 'NPCs' },
    ...(encounter ? [] : [{ value: 'encounters' as const, label: 'Encounters' }]),
  ];
  const [tab, setTab] = useState<Tab>(encounter ? 'here' : 'party');
  const encounters = useWorldRecords('encounters');
  const [query, setQuery] = useState('');
  const pcs = useWorldRecords('pcs');
  const monsters = useWorldRecords('monsters');
  const entries = useWorldRecords('entries');
  const onBoard = useMemo(() => new Set(views.filter((v) => v.token.kind === 'pc').map((v) => v.token.refId)), [views]);

  const rows: Row[] = useMemo(() => {
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
    if (tab === 'here' && encounter) {
      const onMap = new Set(views.map((v) => v.token.combatantId));
      return encounter.combatants.map((c) => ({ key: c.id, encounter: { ...encounter, combatants: [c] }, name: c.name || 'Combatant', detail: c.kind === 'pc' ? 'Party' : c.kind === 'monster' ? `AC ${c.ac} · ${c.maxHp} HP` : undefined, placed: onMap.has(c.id) }));
    }
    if (tab === 'encounters') {
      return [...encounters].sort(byName).map((e) => ({ key: e.id, encounter: e, name: e.name || 'Untitled Encounter', detail: `${e.combatants.length} ${e.combatants.length === 1 ? 'combatant' : 'combatants'}` }));
    }
    if (tab === 'party') {
      return [...pcs].sort(byName).map((pc) => ({ key: pc.id, drag: { kind: 'pc', id: pc.id }, source: { kind: 'pc', pc }, name: pc.name || 'Unnamed Character', detail: pc.className ? `${pc.className} ${pc.level}` : undefined, image: pc.image, placed: onBoard.has(pc.id) }));
    }
    if (tab === 'bestiary') {
      return monsters
        .filter((m) => !m.characterId)
        .sort(byName)
        .map((m) => ({ key: m.id, drag: { kind: 'monster', id: m.id }, source: { kind: 'monster', monster: m }, name: m.name || 'Creature', detail: [m.cr && `CR ${m.cr}`, TOKEN_SIZES.find((s) => s.value === sizeFromKind(m.kind))?.label].filter(Boolean).join(' · '), image: m.image }));
    }
    return entries
      .filter((e) => e.kind === 'character')
      .sort(byName)
      .map((e) => ({ key: e.id, drag: { kind: 'npc', id: e.id }, source: { kind: 'npc', entry: e }, name: e.name || 'Unnamed', detail: e.tagline || undefined, image: e.image }));
  }, [tab, pcs, monsters, entries, onBoard, encounter, encounters, views]);

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => `${r.name} ${r.detail ?? ''}`.toLowerCase().includes(q)) : rows;
  const startDrag = (e: DragEvent, row: Pick<Row, 'drag' | 'name'>) => {
    if (!row.drag) return e.preventDefault();
    e.dataTransfer.setData(TOKEN_MIME, JSON.stringify(row.drag));
    e.dataTransfer.setData('text/plain', row.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <section data-tray aria-label="Add Tokens" className="absolute top-16 left-3 flex max-h-[calc(100%-120px)] w-72 flex-col rounded-xl border bg-background/97 shadow-lg backdrop-blur">
      <header className="flex items-center gap-2 px-3 pt-3">
        <h2 className="label flex-1">Add Tokens</h2>
        <button type="button" aria-label="Close Add Tokens" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <XIcon className="size-3.5" />
        </button>
      </header>
      <div className="flex flex-col gap-2 px-3 py-2">
        <PillTabs label="Add from" value={tab} options={tabs} onChange={setTab} />
        {tab === 'here' && encounter && (
          <button type="button" onClick={() => onAddEncounter(encounter, true)} className="rounded-lg border border-dashed px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground">
            Place The Rest Of The Fight
          </button>
        )}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search tokens" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={cn(FIELD, 'h-8 pl-8')} />
        </div>
      </div>
      <ul aria-label={tabs.find((t) => t.value === tab)?.label} className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {shown.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              draggable={Boolean(row.drag)}
              onDragStart={(e) => startDrag(e, row)}
              onClick={() => (row.encounter ? onAddEncounter(row.encounter, false) : row.source && onAdd(row.source))}
              aria-label={`Add ${row.name}`}
              className="flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted active:cursor-grabbing"
            >
              {tab === 'encounters' ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <SwordsIcon className="size-4" />
                </span>
              ) : (
                <Portrait image={row.image} name={row.name} className="size-8 shrink-0 rounded-full text-[11px]" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px]">{row.name}</span>
                {row.detail && <span className="truncate font-mono text-[10.5px] text-muted-foreground">{row.detail}</span>}
              </span>
              {row.placed && <span className="font-mono text-[10px] text-online">On The Map</span>}
            </button>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">{q ? `Nothing matches “${query}”.` : tab === 'party' ? 'No party yet.' : tab === 'bestiary' ? 'The Bestiary is empty. Copy creatures in from the Library.' : tab === 'encounters' ? 'No encounters yet.' : tab === 'here' ? 'This fight has no one in it yet.' : 'No NPCs yet.'}</li>}
      </ul>
      <footer className="border-t px-3 py-2">
        <button
          type="button"
          draggable
          onDragStart={(e) => startDrag(e, { drag: { kind: 'other', id: null }, name: 'Token' })}
          onClick={() => onAdd({ kind: 'other' })}
          className="w-full rounded-lg border border-dashed px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          A Plain Token (a marker, a trap, anything)
        </button>
      </footer>
    </section>
  );
}
