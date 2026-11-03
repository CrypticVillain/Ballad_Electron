import { Link, useNavigate } from '@tanstack/react-router';
import { PinIcon, PinOffIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Label, Led } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { addRelationship, restore, trash, updateEntry } from '@/lib/actions';
import { useBooks, useLive, useWorldRecords } from '@/lib/hooks';
import { byOrder, type Entry, type Spec } from '@/lib/model';
import { initials, roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { StatusLed } from '@/screens/manuscript/Binder';
import { KIND_INFO } from './BibleScreen';

const COVER = { character: 'cover-accent', place: 'cover-dots', lore: 'cover-grid' } as const;

/**
 * EntrySheet — a character, place or lore entry as a spec sheet (Harmony's
 * profile card): a faceplate with its code and name, the spec rows and notes
 * on the left, and on the right its relationships, the scenes it's in and
 * the timeline events it's part of. Everything edits in place.
 */
export function EntrySheet({ entry }: { entry: Entry }) {
  const navigate = useNavigate();
  const info = KIND_INFO[entry.kind];
  const entries = useWorldRecords('entries');
  const relationships = useWorldRecords('relationships');
  const events = useWorldRecords('events');
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

  const links = relationships.filter((r) => r.fromId === entry.id || r.toId === entry.id);
  const timeline = events.filter((e) => e.links.includes(entry.id)).sort((a, b) => a.year - b.year);
  const firstSeen = appearances[0]?.position;

  const remove = () => {
    trash('entries', entry.id);
    void navigate({ to: '/bible/$kind', params: { kind: entry.kind } });
    toast(`${info.singular} Deleted`, { description: entry.name || 'Untitled', action: { label: 'Undo', onClick: () => restore('entries', entry.id) } });
  };

  const setSpec = (index: number, change: Partial<Spec>) => updateEntry(entry.id, { specs: entry.specs.map((s, i) => (i === index ? { ...s, ...change } : s)) });

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={[info.plural, entry.group || info.plural, entry.name || 'Untitled']}>
        <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => updateEntry(entry.id, { pinned: !entry.pinned })}>
          {entry.pinned ? <PinOffIcon /> : <PinIcon />}
          {entry.pinned ? 'Unpin' : 'Pin'}
        </Button>
        <Hint label={`Delete ${info.singular}`}>
          <Button variant="outline" size="icon-sm" aria-label={`Delete ${info.singular}`} className="rounded-full" onClick={remove}>
            <Trash2Icon />
          </Button>
        </Hint>
      </TopBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-7 pt-6 pb-10">
          <section className="overflow-hidden rounded-2xl border">
            <div className={cn('relative h-24', COVER[entry.kind])}>
              <span className={cn('absolute top-3 left-4 font-mono text-[10px] tracking-[0.18em] uppercase', entry.kind === 'place' ? 'text-background/80' : 'text-foreground')}>
                {code} · {entry.group || info.plural}
              </span>
              {entry.pinned && (
                <span className={cn('absolute top-3 right-4 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase', entry.kind === 'place' ? 'text-background/80' : 'text-foreground')}>
                  <Led tone="accent" /> Pinned
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-5 px-6 pb-5">
              <div className="-mt-12 size-[104px] shrink-0 rounded-3xl bg-background p-[5px]">
                <div className="flex size-full items-center justify-center rounded-[20px] bg-foreground text-background">
                  <span className="font-display text-[40px] font-black">{initials(entry.name || '?')}</span>
                </div>
              </div>
              <div className="flex min-w-[280px] flex-1 flex-col gap-1">
                <input
                  aria-label="Name"
                  value={entry.name}
                  placeholder={`NEW ${info.singular.toUpperCase()}`}
                  onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
                  className="w-full bg-transparent font-display text-[44px] leading-none font-black uppercase outline-none placeholder:text-muted-foreground/40"
                />
                <input
                  aria-label="Tagline"
                  value={entry.tagline}
                  placeholder="One line about them"
                  onChange={(e) => updateEntry(entry.id, { tagline: e.target.value })}
                  className="w-full bg-transparent text-[15px] text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="mt-4 grid min-w-[400px] flex-1 grid-cols-4 gap-2">
                <QuickTile label="Scenes" value={appearances.length} />
                <QuickTile label="Links" value={links.length} />
                <QuickTile label="Events" value={timeline.length} />
                <QuickTile label="First Seen" value={firstSeen ?? '—'} small />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-[420px] flex-[3] flex-col gap-4">
              <Card title="Spec Sheet">
                <dl className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2 font-mono text-[12.5px]">
                    <dt className="w-[120px] shrink-0 text-muted-foreground">Group</dt>
                    <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/50" />
                    <dd className="flex max-w-[60%] min-w-0 justify-end pr-[18px]">
                      <input
                        aria-label="Group"
                        value={entry.group}
                        placeholder={info.groups[0] ?? 'Add a group'}
                        onChange={(e) => updateEntry(entry.id, { group: e.target.value })}
                        className="max-w-full min-w-8 bg-transparent text-right outline-none [field-sizing:content] placeholder:text-muted-foreground/50"
                      />
                    </dd>
                  </div>
                  {entry.specs.map((spec, i) => (
                    <div key={i} className="group/spec flex items-baseline gap-2 font-mono text-[12.5px]">
                      <dt className="min-w-[120px] shrink-0">
                        <input aria-label="Field name" value={spec.label} placeholder="Field" onChange={(e) => setSpec(i, { label: e.target.value })} className="max-w-[200px] min-w-[120px] bg-transparent text-muted-foreground outline-none [field-sizing:content]" />
                      </dt>
                      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/50" />
                      <dd className="flex max-w-[60%] min-w-0 items-baseline gap-1">
                        <input
                          aria-label={spec.label || 'Value'}
                          value={spec.value}
                          placeholder="—"
                          onChange={(e) => setSpec(i, { value: e.target.value })}
                          className="max-w-full min-w-8 bg-transparent text-right outline-none [field-sizing:content] placeholder:text-muted-foreground/50"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${spec.label || 'row'}`}
                          onClick={() => updateEntry(entry.id, { specs: entry.specs.filter((_, j) => j !== i) })}
                          className="self-center rounded text-muted-foreground opacity-0 group-hover/spec:opacity-100 hover:text-foreground focus-visible:opacity-100"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </dd>
                    </div>
                  ))}
                </dl>
                <Button variant="ghost" size="xs" className="self-start text-muted-foreground" onClick={() => updateEntry(entry.id, { specs: [...entry.specs, { label: '', value: '' }] })}>
                  <PlusIcon /> Add Row
                </Button>
              </Card>

              <Card title="About">
                <Textarea
                  aria-label="About"
                  rows={6}
                  value={entry.about}
                  placeholder={entry.kind === 'character' ? 'Who they are, what they hide, how they talk…' : 'What it is, and why it matters to the story…'}
                  onChange={(e) => updateEntry(entry.id, { about: e.target.value })}
                  className={cn(AREA, 'resize-y text-[14px] leading-relaxed')}
                />
              </Card>
            </div>

            <div className="flex min-w-[300px] flex-[2] flex-col gap-4">
              <Relationships entry={entry} />

              <Card title="Appears In" meta={`${appearances.length} ${appearances.length === 1 ? 'Scene' : 'Scenes'}`}>
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

/** Its relationships, both ways ("Tomas Varga · Older sister"), and a row to add one. */
function Relationships({ entry }: { entry: Entry }) {
  const entries = useWorldRecords('entries');
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
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-[10px] text-background">{initials(other.name)}</span>
                <Link to="/bible/$kind/$entryId" params={{ kind: other.kind, entryId: other.id }} className="flex min-w-0 flex-1 flex-col hover:underline">
                  <span className="truncate text-[13.5px] font-semibold">{other.name}</span>
                  <span className="truncate text-[12.5px] text-muted-foreground">
                    {link.fromId === entry.id ? link.label || 'Linked' : `${link.label || 'Linked'} (from ${other.name.split(' ')[0]})`}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove link to ${other.name}`}
                  onClick={() => trash('relationships', link.id)}
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
          options={[{ value: null, label: 'Link to…' }, ...others.map((o) => ({ value: o.id as string | null, label: `${o.name} · ${KIND_INFO[o.kind].singular}` }))]}
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
