import { Link, useNavigate } from '@tanstack/react-router';
import { CameraIcon, CheckIcon, PinIcon, PlusIcon, SwordsIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { DotMeter, Label, Led } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { AREA } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createEncounter, restore, trash, updateScene } from '@/lib/actions';
import { confirmDelete } from '@/components/dnd/Sharing';
import { relativeTime } from '@/lib/dates';
import { duration, scriptLength, shotTotals } from '@/lib/film';
import { useLive, useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import { NOTE_CATEGORIES, SCENE_STATUSES, newId, type ChecklistItem, type Entry, type Scene, type SceneStatus, type Section } from '@/lib/model';
import { kindInfo } from '@/lib/sections';
import { formatWords, initials } from '@/lib/text';
import { cn } from '@/lib/utils';
import { NOTE_INFO } from './notes';
import { statusLabel } from './Binder';
import { Portrait } from '@/components/shared/Portrait';
import { useWorldEntries } from '@/lib/shared';

const GOALS = [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
const KIND_ORDER = { character: 0, crew: 1, place: 2, lore: 3 };
/** A session's statuses, in the order they happen (an idea counts as planned). */
const SESSION_STATUSES: SceneStatus[] = ['outline', 'draft', 'done'];

/**
 * ScenePanel — the scene's details beside the text, in its section's terms.
 * Every detail is a small tile (its name above its value), so nothing is
 * stretched across the column:
 *
 *   Writing      status; POV, place and when; the word goal; who's in it; a note
 *   Filmmaking   status; location and time; length on the page and on screen, and shots; the cast; a note
 *   D&D session  planned / prepped / played; date and place; who and what came up (add more by hand); the DM's
 *                encounters to run; a checklist (the DM's secrets and clues, a player's leads); notes
 *   D&D note     its category, pinned, when it was made; who and what it's about; a checklist; delete
 */
export function ScenePanel({ scene, section }: { scene: Scene; section: Section }) {
  if (section === 'dnd' && scene.kind === 'note') return <NotePanel scene={scene} />;
  return section === 'dnd' ? <SessionPanel scene={scene} /> : <WritingPanel scene={scene} section={section} />;
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside aria-label={label} className="flex w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar/50 px-4 py-5">
      {children}
    </aside>
  );
}

// ── Writing and Filmmaking ──────────────────────────────────────────────

function WritingPanel({ scene, section }: { scene: Scene; section: Section }) {
  const entries = useWorldRecords('entries');
  const characters = useMemo(() => entries.filter((e) => e.kind === 'character').sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  const places = useMemo(() => entries.filter((e) => e.kind === 'place').sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  const shots = useLive('shots');
  const sceneShots = shotTotals(shots.filter((s) => s.sceneId === scene.id));
  const length = scriptLength(scene.words);
  const film = section === 'film';

  return (
    <Panel label="Scene details">
      <Block title="Scene" meta={`Edited ${relativeTime(scene.updatedAt)}`}>
        <StatusSwitch scene={scene} section={section} statuses={[...SCENE_STATUSES]} />
        <div className="grid grid-cols-2 gap-1.5">
          {!film && (
            <Tile label="POV">
              <SelectField
                label="Point of view"
                variant="inline"
                value={scene.povId}
                onChange={(povId) => updateScene(scene.id, { povId })}
                options={entryOptions(characters)}
                className="max-w-full truncate data-[size=default]:h-auto"
              />
            </Tile>
          )}
          <Tile label={kindInfo('place', section).singular}>
            <SelectField
              label={kindInfo('place', section).singular}
              variant="inline"
              value={scene.placeId}
              onChange={(placeId) => updateScene(scene.id, { placeId })}
              options={entryOptions(places)}
              className="max-w-full truncate data-[size=default]:h-auto"
            />
          </Tile>
          <Tile label={film ? 'Time' : 'When'} wide={!film}>
            <input
              aria-label={film ? 'Time of day' : 'When'}
              value={scene.when}
              placeholder={film ? 'Day / Night' : '402 A.F. · 9th Tide'}
              onChange={(e) => updateScene(scene.id, { when: e.target.value })}
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/60"
            />
          </Tile>
        </div>
      </Block>

      {section === 'writing' && (
        <Block title="Words" meta={`${formatWords(scene.words)}${scene.targetWords > 0 ? ` / ${formatWords(scene.targetWords)}` : ''}`}>
          {scene.targetWords > 0 && <DotMeter value={scene.words / scene.targetWords} total={20} />}
          <Tile label="Goal" row>
            <SelectField
              label="Word goal"
              variant="inline"
              align="end"
              value={scene.targetWords}
              onChange={(targetWords) => updateScene(scene.id, { targetWords })}
              options={GOALS.map((g) => ({
                value: g,
                label: g ? formatWords(g) : 'None',
              }))}
            />
          </Tile>
        </Block>
      )}

      {film && (
        <Block title="Length">
          <div className="grid grid-cols-2 gap-1.5">
            <Tile label="Pages">{length.pages.toFixed(1)}</Tile>
            <Tile label="On Screen">≈ {duration(length.screenMinutes * 60)}</Tile>
            <Tile label="Read Aloud">≈ {duration(length.spokenMinutes * 60)}</Tile>
            <Tile label="Shots">{sceneShots.count ? `${sceneShots.done} / ${sceneShots.count} · ${duration(sceneShots.seconds)}` : 'None'}</Tile>
          </div>
          <Link to="/shots" search={{ scene: scene.id }} className="inline-flex items-center gap-1.5 self-start font-mono text-[11px] text-link hover:underline">
            <CameraIcon className="size-3.5" /> Shot List For This Scene
          </Link>
        </Block>
      )}

      <InScene
        scene={scene}
        section={section}
        title="In This Scene"
        empty={film ? 'Pick a location, or type @ to name cast or crew.' : 'Pick a POV and a place, or type @ in the scene to name someone.'}
      />

      <NoteField scene={scene} label="Scene Note" placeholder={film ? 'What this scene has to land, coverage ideas…' : 'What this scene has to do, what to save for later…'} />
    </Panel>
  );
}

// ── D&D: a session ──────────────────────────────────────────────────────

function SessionPanel({ scene }: { scene: Scene }) {
  const player = useRole() === 'player';
  const entries = useWorldEntries();
  const places = useMemo(() => entries.filter((e) => e.kind === 'place').sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  const number = useSessionNumber(scene);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(scene.when) ? scene.when : null;
  // A journal entry is planned (a session to come) or played; prepping is the DM's.
  const noun = player ? 'Entry' : 'Session';

  return (
    <Panel label={`${noun} details`}>
      <Block title={number ? `${noun} ${number}` : noun} meta={`Edited ${relativeTime(scene.updatedAt)}`}>
        <StatusSwitch scene={scene} section="dnd" statuses={player ? ['outline', 'done'] : SESSION_STATUSES} />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
          <Tile label={scene.status === 'done' ? 'Played On' : 'Date'}>
            {day || !scene.when ? (
              <DateField label="Played on" variant="bare" value={day} placeholder="Pick a day" onChange={(when) => updateScene(scene.id, { when: when ?? '' })} className="w-full min-w-0 text-[12.5px]" />
            ) : (
              <input aria-label="Played on" value={scene.when} onChange={(e) => updateScene(scene.id, { when: e.target.value })} className="w-full min-w-0 bg-transparent outline-none" />
            )}
          </Tile>
          <Tile label="Words">
            <span className="font-mono text-[12.5px] tabular-nums">
              {formatWords(scene.words)}
              {scene.words > 0 && <span className="text-muted-foreground"> · {Math.max(1, Math.round(scene.words / 230))} min</span>}
            </span>
          </Tile>
          <Tile label="Place" wide>
            <SelectField
              label="Place"
              variant="inline"
              value={scene.placeId}
              onChange={(placeId) => updateScene(scene.id, { placeId })}
              options={entryOptions(places)}
              className="max-w-full truncate data-[size=default]:h-auto"
            />
          </Tile>
        </div>
      </Block>

      <InScene scene={scene} section="dnd" title="In This Session" empty="Type @ in the text, or add an NPC or place here." />

      {!player && <Encounters scene={scene} />}

      <Checklist
        scene={scene}
        title={player ? 'Leads & To-Dos' : 'Secrets & Clues'}
        placeholder={player ? 'Find out who hired the smugglers' : 'The ledger was forged in Saltreach'}
        hint={player ? undefined : 'Tick one off once the party learns it.'}
      />

      <NoteField
        scene={scene}
        label={player ? 'Quick Notes' : 'Prep Notes'}
        placeholder={player ? 'Names, prices, things to bring up next time…' : 'Hooks, the opening scene, what to cut if time runs short…'}
      />
    </Panel>
  );
}

/** A session's number in its book, counted across its arcs (notes don't count); 0 if it isn't in one. */
export function useSessionNumber(scene: Scene): number {
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  return useMemo(() => {
    const order = new Map(parts.filter((p) => p.bookId === scene.bookId).map((p) => [p.id, p.order]));
    const sessions = scenes.filter((s) => s.bookId === scene.bookId && s.kind !== 'note' && order.has(s.partId)).sort((a, b) => order.get(a.partId)! - order.get(b.partId)! || a.order - b.order);
    return sessions.findIndex((s) => s.id === scene.id) + 1;
  }, [parts, scenes, scene.bookId, scene.id]);
}

/** The DM's encounters for the session: open one in the tracker, add one, or start a new one. */
function Encounters({ scene }: { scene: Scene }) {
  const world = useWorld();
  const navigate = useNavigate();
  const encounters = useWorldRecords('encounters');
  const ids = scene.encounterIds ?? [];
  const planned = ids.map((id) => encounters.find((e) => e.id === id)).filter((e) => e !== undefined);
  const others = encounters.filter((e) => !ids.includes(e.id));
  const set = (encounterIds: string[]) => updateScene(scene.id, { encounterIds });

  return (
    <Block
      title="Encounters"
      action={
        world && (
          <SelectField
            label="Add an encounter"
            variant="inline"
            align="end"
            value={null as string | null}
            onChange={(id) => {
              if (id === NEW) {
                const encounter = createEncounter(world.id, {
                  name: scene.title ? `${scene.title} · Fight` : 'New Encounter',
                });
                set([...ids, encounter.id]);
                void navigate({
                  to: '/encounters/$encounterId',
                  params: { encounterId: encounter.id },
                });
              } else if (id) set([...ids, id]);
            }}
            options={[
              { value: null, label: <AddLabel /> },
              ...others.map((e) => ({
                value: e.id as string | null,
                label: e.name || 'Untitled Encounter',
              })),
              { value: NEW, label: '+ New Encounter' },
            ]}
            className="text-[11px] text-muted-foreground data-[size=default]:h-auto"
          />
        )
      }
    >
      {planned.length ? (
        <ul className="flex flex-col gap-1">
          {planned.map((encounter) => (
            <li key={encounter.id} className="group/row flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
              <SwordsIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <Link to="/encounters/$encounterId" params={{ encounterId: encounter.id }} className="min-w-0 flex-1 truncate text-[13px] hover:underline">
                {encounter.name || 'Untitled Encounter'}
              </Link>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{encounter.round ? `Round ${encounter.round}` : `${encounter.combatants.length} in it`}</span>
              <RemoveX label={`Take ${encounter.name} off this session`} onClick={() => set(ids.filter((id) => id !== encounter.id))} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">No fights planned. Add one to open it from here at the table.</p>
      )}
    </Block>
  );
}

const NEW = '__new';

// ── D&D: a note ─────────────────────────────────────────────────────────

function NotePanel({ scene }: { scene: Scene }) {
  const navigate = useNavigate();
  const category = scene.category ?? 'general';
  const info = NOTE_INFO[category];
  const remove = () =>
    confirmDelete({
      noun: 'Note',
      name: scene.title || 'Untitled Note',
      area: 'dnd:sessions',
      remove: () => {
        trash('scenes', scene.id);
        return () => restore('scenes', scene.id);
      },
      after: () => void navigate({ to: '/manuscript' }),
    });

  return (
    <Panel label="Note details">
      <Block title={info.label} meta={`Edited ${relativeTime(scene.updatedAt)}`}>
        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Category">
          {NOTE_CATEGORIES.map((c) => {
            const { label, icon: Icon } = NOTE_INFO[c];
            const on = c === category;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => updateScene(scene.id, { category: c })}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border bg-background px-1 py-1.5 text-[10.5px] text-muted-foreground hover:text-foreground',
                  on && 'border-primary bg-primary/10 text-foreground',
                )}
              >
                <Icon className={cn('size-4', on && 'text-primary')} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={Boolean(scene.pinned)}
            onClick={() => updateScene(scene.id, { pinned: !scene.pinned })}
            className={cn('flex flex-col items-start gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-left hover:border-foreground/30', scene.pinned && 'border-primary')}
          >
            <span className="label text-[9px]">Pinned</span>
            <span className="flex items-center gap-1.5 text-[12.5px]">
              <PinIcon className={cn('size-3.5', scene.pinned ? 'fill-primary text-primary' : 'text-muted-foreground')} /> {scene.pinned ? 'On Top' : 'No'}
            </span>
          </button>
          <Tile label="Made">
            <span className="text-[12.5px]">
              {new Date(scene.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </Tile>
        </div>
      </Block>

      <InScene scene={scene} section="dnd" title="About" empty="Type @ in the note, or add an NPC or place here." />

      <Checklist scene={scene} title={info.checklist} placeholder="Add an item" />

      <Button variant="ghost" size="sm" onClick={remove} className="mt-auto self-start text-muted-foreground hover:text-destructive">
        <Trash2Icon /> Delete Note
      </Button>
    </Panel>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────

function Block({ title, meta, action, children }: { title: string; meta?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label>{title}</Label>
        {meta && <span className="truncate font-mono text-[10.5px] text-muted-foreground">{meta}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

/** A detail: its name small above its value. `wide` spans both columns; `row` puts the name beside the value. */
function Tile({ label, wide, row, children }: { label: string; wide?: boolean; row?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-[12.5px]', row ? 'items-center justify-between' : 'flex-col', wide && 'col-span-2')}>
      <span className="label text-[9px]">{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}

/** The status as a row of buttons, each with its light. */
function StatusSwitch({ scene, section, statuses }: { scene: Scene; section: Section; statuses: SceneStatus[] }) {
  const current = scene.status === 'idea' && !statuses.includes('idea') ? 'outline' : scene.status;
  return (
    <div role="radiogroup" aria-label="Status" className="flex rounded-lg border bg-background p-0.5">
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={status === current}
          onClick={() => updateScene(scene.id, { status })}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-1 py-1 text-[12px] text-muted-foreground hover:text-foreground',
            status === current && 'bg-muted font-medium text-foreground',
          )}
        >
          <Led tone={status !== current ? 'off' : status === 'done' ? 'online' : status === 'draft' ? 'accent' : 'muted'} />
          {statusLabel(status, section)}
        </button>
      ))}
    </div>
  );
}

/** Everyone and everything in the scene: the POV, the place, what the text mentions, and what was added by hand. */
function InScene({ scene, section, title, empty }: { scene: Scene; section: Section; title: string; empty: string }) {
  const entries = useWorldEntries();
  const tagged = scene.tagged ?? [];
  const inScene = useMemo(() => {
    const ids = [scene.povId, scene.placeId, ...scene.links, ...tagged].filter((id): id is string => Boolean(id));
    return [...new Set(ids)]
      .map((id) => entries.find((e) => e.id === id))
      .filter((e): e is Entry => Boolean(e))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.povId, scene.placeId, scene.links, scene.tagged, entries]);
  const addable = entries.filter((e) => (e.kind === 'character' || e.kind === 'place') && !inScene.some((x) => x.id === e.id)).sort((a, b) => a.name.localeCompare(b.name));
  const dnd = section === 'dnd';

  return (
    <Block
      title={title}
      action={
        dnd &&
        addable.length > 0 && (
          <SelectField
            label="Add someone or somewhere"
            variant="inline"
            align="end"
            value={null as string | null}
            onChange={(id) => id && updateScene(scene.id, { tagged: [...tagged, id] })}
            options={[
              { value: null, label: <AddLabel /> },
              ...addable.map((e) => ({
                value: e.id as string | null,
                label: `${e.name || 'Untitled'} · ${kindInfo(e.kind, section).singular}`,
              })),
            ]}
            className="text-[11px] text-muted-foreground data-[size=default]:h-auto"
          />
        )
      }
    >
      {inScene.length ? (
        <div className="flex flex-wrap gap-1.5">
          {inScene.map((entry) => {
            const byHand = tagged.includes(entry.id) && !scene.links.includes(entry.id) && entry.id !== scene.placeId && entry.id !== scene.povId;
            return (
              <span key={entry.id} className="group/row inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-background pr-2 pl-1 text-[12.5px] hover:border-foreground/30">
                <Link to="/bible/$kind/$entryId" params={{ kind: entry.kind, entryId: entry.id }} className="flex items-center gap-2">
                  {entry.image ? (
                    <Portrait image={entry.image} name={entry.name} className={cn('size-[22px] rounded-full', entry.id === scene.povId && section === 'writing' && 'ring-2 ring-primary')} />
                  ) : (
                    <span
                      className={cn(
                        'flex size-[22px] items-center justify-center rounded-full font-mono text-[9.5px]',
                        entry.id === scene.povId && section === 'writing' ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background',
                        entry.kind !== 'character' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {initials(entry.name || '?')}
                    </span>
                  )}
                  {entry.name || 'Untitled'}
                  {entry.id === scene.povId && section === 'writing' && <span className="font-mono text-[10px] text-muted-foreground">POV</span>}
                </Link>
                {byHand && (
                  <RemoveX
                    label={`Take ${entry.name} off`}
                    onClick={() =>
                      updateScene(scene.id, {
                        tagged: tagged.filter((id) => id !== entry.id),
                      })
                    }
                  />
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">{empty}</p>
      )}
    </Block>
  );
}

/** Things to tick off: click to tick, edit in place, Enter in the last field adds one. */
function Checklist({ scene, title, placeholder, hint }: { scene: Scene; title: string; placeholder: string; hint?: string }) {
  const items = scene.checklist ?? [];
  const [draft, setDraft] = useState('');
  const set = (checklist: ChecklistItem[]) => updateScene(scene.id, { checklist });
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    set([...items, { id: newId(), text, done: false }]);
    setDraft('');
  };
  const done = items.filter((i) => i.done).length;

  return (
    <Block title={title} meta={items.length ? `${done} / ${items.length}` : undefined}>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="group/row flex items-start gap-2 py-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.text}
              onClick={() => set(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-muted-foreground/60',
                item.done && 'border-primary bg-primary text-primary-foreground',
              )}
            >
              {item.done && <CheckIcon className="size-3" strokeWidth={3} />}
            </button>
            <textarea
              aria-label="Item"
              rows={1}
              value={item.text}
              onChange={(e) => set(items.map((i) => (i.id === item.id ? { ...i, text: e.target.value.replace(/\n/g, ' ') } : i)))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
              onBlur={(e) => !e.target.value.trim() && set(items.filter((i) => i.id !== item.id))}
              className={cn('field-sizing-content min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-[13px] leading-snug outline-none', item.done && 'text-muted-foreground line-through')}
            />
            <RemoveX label={`Remove ${item.text}`} onClick={() => set(items.filter((i) => i.id !== item.id))} />
          </li>
        ))}
        <li className="flex items-center gap-2 py-1">
          <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            aria-label={`Add to ${title}`}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            onBlur={add}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
        </li>
      </ul>
      {hint && items.length > 0 && done === 0 && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </Block>
  );
}

/** The panel's note: grows with what's written. */
function NoteField({ scene, label, placeholder }: { scene: Scene; label: string; placeholder: string }) {
  return (
    <section className="flex flex-col gap-2">
      <label htmlFor="scene-note" className="label">
        {label}
      </label>
      <Textarea
        id="scene-note"
        value={scene.note}
        placeholder={placeholder}
        onChange={(e) => updateScene(scene.id, { note: e.target.value })}
        className={cn(AREA, 'field-sizing-content min-h-24 resize-none bg-background text-[13px] leading-relaxed')}
      />
    </section>
  );
}

function AddLabel() {
  return (
    <span className="flex items-center gap-1">
      <PlusIcon className="size-3.5" /> Add
    </span>
  );
}

function RemoveX({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="shrink-0 rounded text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100">
      <XIcon className="size-3.5" />
    </button>
  );
}

const entryOptions = (list: Entry[]) => [
  { value: null, label: 'None' },
  ...list.map((e) => ({
    value: e.id as string | null,
    label: e.name || 'Untitled',
  })),
];
