import { Link, useNavigate } from '@tanstack/react-router';
import { PinIcon, PinOffIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Label, Led } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { addRelationship, restore, trash, updateEntry } from '@/lib/actions';
import { useBooks, useCharacter, useLive, useRole, useSection, useWorldRecords } from '@/lib/hooks';
import { deleteShared, editShared, pinShared, useWorldEntries } from '@/lib/shared';
import { confirmDelete, ShareButton, SharedSwitch } from '@/components/tabletop/Sharing';
// A Writing world's lore: its kind, and a language's lexicon (writing/lore).
import { LanguagePanel, LoreTypeBar } from '@/writing/lore/LorePanels';
import { LocationPhotos } from '@/film/locations/LocationPhotos';
import { byOrder, type Entry, type Spec } from '@/lib/model';
import { roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { StatusLed } from '@/screens/manuscript/Binder';
import { kindInfo } from '@/lib/sections';
import { Portrait, PortraitPicker } from '@/components/shared/Portrait';
import { moveItem, whereIs } from '@/lib/layout';
import { useEntryLayout } from '@/components/shell/layouts';
import { NameSuggest } from '@/names/NameSuggest';

const COVER = { character: 'cover-accent', place: 'cover-dots', lore: 'cover-grid', crew: 'cover-grid' } as const;

/**
 * EntrySheet — a character, place or lore entry as a spec sheet (Harmony's
 * profile card): a faceplate with its code and name, the spec rows and notes
 * on the left, and on the right its relationships, the scenes it's in and
 * the timeline events it's part of. Everything edits in place.
 *
 * Tabletop: the GM shares it from here (Share, Update Shared). A player sees what
 * was shared with them, read-only, until they unlock it to keep a version of
 * their own; then they switch between theirs and the GM's original.
 */
export function EntrySheet({ entry }: { entry: Entry }) {
  const navigate = useNavigate();
  const section = useSection();
  const player = useRole() === 'player';
  const pc = useCharacter();
  const via = entry.via;
  /** A player's shared entry, showing the GM's original: read-only (Unlock To Edit makes their own). */
  const locked = player && via?.showing !== 'edited';
  /** Changes it: the GM's record, or the player's own version of it. */
  const set = (changes: Partial<Entry>) => {
    if (!player) updateEntry(entry.id, changes);
    else if (via && pc && !locked) editShared(via.shareId, pc.id, changes);
  };
  const info = kindInfo(entry.kind, section);
  const { layout, save, editable: arrangeable } = useEntryLayout(entry.kind);
  const place = whereIs(layout, entry.id);
  const kept = [place?.space.name, place?.folder?.name].filter(Boolean).join(' / ') || info.plural;
  const entries = useWorldEntries();
  const relationships = useWorldRecords('relationships');
  const events = useWorldRecords('events');
  const shootDays = useWorldRecords('shootDays');
  const storylines = useWorldRecords('storylines');
  const books = useBooks();
  const parts = useLive('parts');
  const scenes = useLive('scenes');

  /** "CHR-003": its place among its kind, oldest first. */
  const code = useMemo(() => {
    const index = entries
      .filter((e) => e.kind === entry.kind)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .findIndex((e) => e.id === entry.id);
    return `${info.code}-${String(index + 1).padStart(3, '0')}`;
  }, [entries, entry.id, entry.kind, info.code]);

  /** The scenes it's in, in reading order, with their "II · 3" position. */
  const appearances = useMemo(() => {
    const found: { id: string; position: string; title: string; status: (typeof scenes)[number]['status']; role: string | null }[] = [];
    for (const book of books) {
      parts
        .filter((p) => p.bookId === book.id)
        .sort(byOrder)
        .forEach((part, p) => {
          scenes
            .filter((s) => s.partId === part.id)
            .sort(byOrder)
            .forEach((scene, s) => {
              const role = scene.povId === entry.id ? 'POV' : scene.placeId === entry.id ? 'Setting' : scene.links.includes(entry.id) ? null : undefined;
              if (role !== undefined) found.push({ id: scene.id, position: `${roman(p + 1)} · ${s + 1}`, title: scene.title || 'Untitled Scene', status: scene.status, role });
            });
        });
    }
    return found;
  }, [books, parts, scenes, entry.id]);

  const links = player ? (via?.links ?? []).filter((l) => entries.some((e) => e.id === l.otherId)) : relationships.filter((r) => r.fromId === entry.id || r.toId === entry.id);
  const timeline = events.filter((e) => e.links.includes(entry.id)).sort((a, b) => a.year - b.year);
  const firstSeen = appearances[0]?.position;

  const remove = () =>
    confirmDelete({ noun: info.singular, name: entry.name || 'Untitled', area: `${section}:bible`, sharedId: entry.id, remove: () => deleteShared('entries', entry.id), after: () => void navigate({ to: '/bible/$kind', params: { kind: entry.kind } }) });

  const setSpec = (index: number, change: Partial<Spec>) => set({ specs: entry.specs.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  const togglePin = () => (player ? via && pc && pinShared(via.shareId, pc.id, !entry.pinned) : updateEntry(entry.id, { pinned: !entry.pinned }));

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={[info.plural, ...(place ? [place.space.name] : []), ...(place?.folder ? [place.folder.name] : []), entry.name || 'Untitled']}>
        <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={togglePin}>
          {entry.pinned ? <PinOffIcon /> : <PinIcon />}
          {entry.pinned ? 'Unpin' : 'Pin'}
        </Button>
        {player ? via && <SharedSwitch via={via} /> : section === 'tabletop' && <ShareButton collection="entries" id={entry.id} name={entry.name || 'Untitled'} />}
        {!player && (
          <Hint label={`Delete ${info.singular}`}>
            <Button variant="outline" size="icon-sm" aria-label={`Delete ${info.singular}`} className="rounded-full" onClick={remove}>
              <Trash2Icon />
            </Button>
          </Hint>
        )}
      </TopBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-7 pt-6 pb-10">
          <section className="overflow-hidden rounded-2xl border">
            <div className={cn('relative h-24', COVER[entry.kind])}>
              <span className={cn('absolute top-3 left-4 font-mono text-[10px] tracking-[0.18em] uppercase', entry.kind === 'place' ? 'text-background/80' : 'text-foreground')}>
                {code} · {kept}
              </span>
              {entry.pinned && (
                <span className={cn('absolute top-3 right-4 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase', entry.kind === 'place' ? 'text-background/80' : 'text-foreground')}>
                  <Led tone="accent" /> Pinned
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-5 px-6 pb-5">
              <div className="-mt-12 size-[104px] shrink-0 rounded-3xl bg-background p-[5px]">
                <PortraitPicker image={entry.image} label={entry.name || info.singular} editable={!locked} onChange={(image) => set({ image })} className="block size-full rounded-[20px]">
                  <Portrait image={entry.image} name={entry.name} className="size-full rounded-[20px]" text="font-display text-[40px] font-black" />
                </PortraitPicker>
              </div>
              <div className="flex min-w-[280px] flex-1 flex-col gap-1">
                <span className="flex items-center gap-1">
                  <input
                    aria-label="Name"
                    value={entry.name}
                    readOnly={locked}
                    placeholder={`NEW ${info.singular.toUpperCase()}`}
                    onChange={(e) => set({ name: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent font-display text-[44px] leading-none font-black uppercase outline-none placeholder:text-muted-foreground/40"
                  />
                  {/* The name generator's wand: characters, NPCs and places, in Writing and Tabletop. */}
                  {!locked && section !== 'film' && (entry.kind === 'character' || entry.kind === 'place') && <NameSuggest kind={entry.kind === 'place' ? 'place' : 'person'} onPick={(name) => set({ name })} />}
                </span>
                <input
                  aria-label="Tagline"
                  value={entry.tagline}
                  readOnly={locked}
                  placeholder={locked ? '' : info.tagline}
                  onChange={(e) => set({ tagline: e.target.value })}
                  className="w-full bg-transparent text-[15px] text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="mt-4 grid min-w-[400px] flex-1 grid-cols-4 gap-2">
                <QuickTile label="Scenes" value={appearances.length} />
                <QuickTile label="Links" value={links.length} />
                <QuickTile label={section === 'film' ? 'Shoot Days' : 'Events'} value={section === 'film' ? shootDays.filter((d) => d.placeId === entry.id).length : timeline.length} />
                <QuickTile label="First Seen" value={firstSeen ?? '—'} small />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-[420px] flex-[3] flex-col gap-4">
              {section === 'writing' && entry.kind === 'lore' && <LoreTypeBar entry={entry} locked={locked} />}
              <Card title="Spec Sheet">
                <dl className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2 font-mono text-[12.5px]">
                    <dt className="w-[120px] shrink-0 text-muted-foreground">Kept In</dt>
                    <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/50" />
                    <dd className="flex max-w-[60%] min-w-0 justify-end pr-[18px]">
                      {arrangeable && place ? (
                        <SelectField
                          label="Space and folder"
                          variant="inline"
                          align="end"
                          value={`${place.space.id}/${place.folder?.id ?? ''}`}
                          onChange={(to) => {
                            const [space, folder] = to.split('/');
                            save(moveItem(layout, entry.id, { space: space!, folder: folder || undefined }));
                          }}
                          options={layout.spaces.flatMap((s) => [{ value: `${s.id}/`, label: s.name }, ...s.folders.map((f) => ({ value: `${s.id}/${f.id}`, label: `${s.name} / ${f.name}` }))])}
                          className="font-mono text-[12.5px]"
                        />
                      ) : (
                        <span className="truncate">{kept}</span>
                      )}
                    </dd>
                  </div>
                  {entry.specs.map((spec, i) => (
                    <div key={i} className="group/spec flex items-baseline gap-2 font-mono text-[12.5px]">
                      <dt className="min-w-[120px] shrink-0">
                        <input aria-label="Field name" value={spec.label} readOnly={locked} placeholder="Field" onChange={(e) => setSpec(i, { label: e.target.value })} className="max-w-[200px] min-w-[120px] bg-transparent text-muted-foreground outline-none [field-sizing:content]" />
                      </dt>
                      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/50" />
                      <dd className="flex max-w-[60%] min-w-0 items-baseline gap-1">
                        <input
                          aria-label={spec.label || 'Value'}
                          value={spec.value}
                          readOnly={locked}
                          placeholder="—"
                          onChange={(e) => setSpec(i, { value: e.target.value })}
                          className="max-w-full min-w-8 bg-transparent text-right outline-none [field-sizing:content] placeholder:text-muted-foreground/50"
                        />
                        <button
                          type="button"
                          hidden={locked}
                          aria-label={`Remove ${spec.label || 'row'}`}
                          onClick={() => set({ specs: entry.specs.filter((_, j) => j !== i) })}
                          className="self-center rounded text-muted-foreground opacity-0 group-hover/spec:opacity-100 hover:text-foreground focus-visible:opacity-100"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </dd>
                    </div>
                  ))}
                </dl>
                {!locked && (
                  <Button variant="ghost" size="xs" className="self-start text-muted-foreground" onClick={() => set({ specs: [...entry.specs, { label: '', value: '' }] })}>
                    <PlusIcon /> Add Row
                  </Button>
                )}
              </Card>

              <Card title="About">
                <Textarea
                  aria-label="About"
                  rows={6}
                  value={entry.about}
                  readOnly={locked}
                  placeholder={locked ? '' : entry.kind === 'character' ? 'Who they are, what they hide, how they talk…' : 'What it is, and why it matters to the story…'}
                  onChange={(e) => set({ about: e.target.value })}
                  className={cn(AREA, 'resize-y text-[14px] leading-relaxed')}
                />
              </Card>
              {section === 'writing' && entry.kind === 'lore' && entry.loreType === 'language' && <LanguagePanel entry={entry} locked={locked} />}
              {section === 'film' && entry.kind === 'place' && <LocationPhotos entry={entry} locked={locked} />}
            </div>

            <div className="flex min-w-[300px] flex-[2] flex-col gap-4">
              {player ? <SharedRelationships entry={entry} /> : <Relationships entry={entry} />}

              <Card title="Appears In" meta={`${appearances.length} ${appearances.length === 1 ? (section === 'tabletop' ? 'Session' : 'Scene') : section === 'tabletop' ? 'Sessions' : 'Scenes'}`}>
                {appearances.length ? (
                  <div className="-mx-1 flex flex-col">
                    {appearances.slice(0, 12).map((a) => (
                      <Link key={a.id} to="/manuscript/$sceneId" params={{ sceneId: a.id }} className="flex items-center gap-3 rounded-md border-t border-border/60 px-1 py-2 text-[13.5px] first:border-t-0 hover:bg-muted">
                        <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">{a.position}</span>
                        <span className="min-w-0 flex-1 truncate">{a.title}</span>
                        {a.role && <span className="font-mono text-[10px] text-muted-foreground uppercase">{a.role}</span>}
                        <StatusLed status={a.status} />
                      </Link>
                    ))}
                    {appearances.length > 12 && <span className="px-1 pt-2 font-mono text-[11px] text-muted-foreground">+ {appearances.length - 12} more</span>}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Not in any scene yet. Type @ or # in a scene to name it.</p>
                )}
              </Card>

              {timeline.length > 0 && (
                <Card title="Timeline">
                  <div className="-mx-1 flex flex-col">
                    {timeline.map((event) => {
                      const storyline = storylines.find((s) => s.id === event.storylineId);
                      return (
                        <Link
                          key={event.id}
                          to="/timeline"
                          search={{ event: event.id }}
                          className="flex items-center gap-3 rounded-md border-t border-border/60 px-1 py-2 text-[13.5px] first:border-t-0 hover:bg-muted"
                        >
                          <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">{event.year}</span>
                          <span className="size-2 shrink-0 rounded-[3px]" style={{ background: `var(--story-${storyline?.color ?? 1})` }} />
                          <span className="min-w-0 flex-1 truncate">{event.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/** A shared entry's relationships, as the GM shared them, to the others shared with you. */
function SharedRelationships({ entry }: { entry: Entry }) {
  const entries = useWorldEntries();
  const links = (entry.via?.links ?? []).map((l) => ({ ...l, other: entries.find((e) => e.id === l.otherId) })).filter((l) => l.other);
  return (
    <Card title="Relationships" meta={links.length ? String(links.length) : undefined}>
      {links.length ? (
        <div className="-mx-1 flex flex-col">
          {links.map(({ other, label, outgoing }) => (
            <Link key={other!.id} to="/bible/$kind/$entryId" params={{ kind: other!.kind, entryId: other!.id }} className="flex items-center gap-3 border-t border-border/60 px-1 py-2 first:border-t-0 hover:bg-muted">
              <Portrait image={other!.image} name={other!.name} className="size-7 rounded-full" text="text-[10px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-semibold">{other!.name}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{outgoing ? label || 'Linked' : `${label || 'Linked'} (from ${other!.name.split(' ')[0]})`}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">None that you know of.</p>
      )}
    </Card>
  );
}

/** Its relationships, both ways ("Tomas Varga · Older sister"), and a row to add one. */
function Relationships({ entry }: { entry: Entry }) {
  const section = useSection();
  const entries = useWorldEntries();
  const relationships = useWorldRecords('relationships');
  const [otherId, setOtherId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const links = relationships.filter((r) => r.fromId === entry.id || r.toId === entry.id);
  const others = entries.filter((e) => e.id !== entry.id && e.name).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  const add = () => {
    if (!otherId) return;
    addRelationship(entry.worldId, entry.id, otherId, label.trim());
    setOtherId(null);
    setLabel('');
  };

  return (
    <Card title="Relationships" meta={links.length ? String(links.length) : undefined}>
      {links.length > 0 && (
        <div className="-mx-1 flex flex-col">
          {links.map((link) => {
            const other = entries.find((e) => e.id === (link.fromId === entry.id ? link.toId : link.fromId));
            if (!other) return null;
            return (
              <div key={link.id} className="group/rel flex items-center gap-3 border-t border-border/60 px-1 py-2 first:border-t-0">
                <Portrait image={other.image} name={other.name} className="size-7 rounded-full" text="text-[10px]" />
                <Link to="/bible/$kind/$entryId" params={{ kind: other.kind, entryId: other.id }} className="flex min-w-0 flex-1 flex-col hover:underline">
                  <span className="truncate text-[13.5px] font-semibold">{other.name}</span>
                  <span className="truncate text-[12.5px] text-muted-foreground">
                    {link.fromId === entry.id ? link.label || 'Linked' : `${link.label || 'Linked'} (from ${other.name.split(' ')[0]})`}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove link to ${other.name}`}
                  onClick={() =>
                    confirmDelete({
                      noun: 'Link',
                      verb: 'Remove',
                      name: `the link to ${other.name || 'Untitled'}`,
                      area: `${section}:bible`,
                      remove: () => {
                        trash('relationships', link.id);
                        return () => restore('relationships', link.id);
                      },
                    })
                  }
                  className="rounded text-muted-foreground opacity-0 group-hover/rel:opacity-100 hover:text-foreground focus-visible:opacity-100"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-2 border-t pt-3">
        <SelectField
          label="Link to"
          value={otherId}
          onChange={setOtherId}
          options={[{ value: null, label: 'Link to…' }, ...others.map((o) => ({ value: o.id as string | null, label: `${o.name} · ${kindInfo(o.kind, section).singular}` }))]}
        />
        <div className="flex gap-2">
          <Input
            aria-label="How they're linked"
            value={label}
            placeholder="How? (Brother, rival, owes a debt…)"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className={cn(FIELD, 'text-[13px]')}
          />
          <Button variant="outline" disabled={!otherId} onClick={add} className="h-9">
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Card({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{title}</Label>
        {meta && <span className="font-mono text-[11px] text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function QuickTile({ label, value, small }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/50 px-3 py-2.5">
      <span className="label text-[9.5px] whitespace-nowrap">{label}</span>
      <span className={cn(small ? 'pt-1 font-mono text-[13px]' : 'font-display text-2xl leading-none font-black')}>{value}</span>
    </div>
  );
}
