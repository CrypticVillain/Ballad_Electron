import { Navigate, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  BookOpenIcon,
  CopyPlusIcon,
  ExternalLinkIcon,
  FeatherIcon,
  GemIcon,
  ImagePlusIcon,
  LandmarkIcon,
  MapIcon,
  PlusIcon,
  ScaleIcon,
  ScrollTextIcon,
  SearchIcon,
  ShieldIcon,
  SkullIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { RulesText } from '@/components/dnd/RulesText';
import { Empty, Label } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON, Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { createMap, createMonster, updateRecord } from '@/lib/actions';
import { matches, nameRank, SRD_CREDIT, useItems, useSpells } from '@/lib/compendium';
import { CLASSES as SRD_CLASSES, SPECIES as SRD_SPECIES } from '@/lib/compendium/classes';
import { ABILITY_NAME, actionKind, modifier, signed, usesFromText } from '@/lib/dnd';
import { useCharacter, useRole, useWorld } from '@/lib/hooks';
import { DYSON_MAPS, LICENSE_NOTE, LICENSES, sourceName, SOURCES, useLibrary, type Block, type DysonMap, type Library, type LibraryMonster } from '@/lib/library';
import { ABILITIES, newId, type Feature } from '@/lib/model';
import { cn } from '@/lib/utils';
import { Chip, DetailColumn, ItemDetail, ListColumn, Row, SpellDetail } from '@/screens/dnd/CompendiumScreen';
import { HeaderPicture, pictureKey, RowPicture, usePictures } from '@/components/shared/Portrait';

/**
 * Library — every piece of open-licensed material the app carries, for DMs
 * and players alike: monsters and NPCs, spells, items, feats, backgrounds,
 * species, classes and subclasses, rules and conditions (the SRD 5.1 and 5.2,
 * Kobold Press, EN Publishing's Level Up, Green Ronin's Tal'Dorei open
 * content and more, from Open5e), Dyson Logos's free commercial maps, a page
 * on adventures and settings, and Sources: who made each, its license, what
 * a seller must do, and how much it overlaps the rest.
 *
 * Copy a creature to the Bestiary (DM), add a spell, item or feature to your
 * character (Player), or add a map to your Maps. Spells and items here are the
 * same ones the Spells and Inventory pages list.
 */
const KINDS = ['monsters', 'npcs', 'spells', 'items', 'feats', 'backgrounds', 'species', 'classes', 'rules', 'maps', 'adventures', 'sources'] as const;
type Kind = (typeof KINDS)[number];
const KIND: Record<Kind, { label: string; icon: LucideIcon }> = {
  monsters: { label: 'Monsters', icon: SkullIcon },
  npcs: { label: 'NPCs', icon: UsersIcon },
  spells: { label: 'Spells', icon: SparklesIcon },
  items: { label: 'Items', icon: GemIcon },
  feats: { label: 'Feats', icon: FeatherIcon },
  backgrounds: { label: 'Backgrounds', icon: ScrollTextIcon },
  species: { label: 'Species', icon: UserRoundIcon },
  classes: { label: 'Classes & Subclasses', icon: ShieldIcon },
  rules: { label: 'Rules & Conditions', icon: BookOpenIcon },
  maps: { label: 'Maps', icon: MapIcon },
  adventures: { label: 'Adventures & Settings', icon: LandmarkIcon },
  sources: { label: 'Sources & Licenses', icon: ScaleIcon },
};
const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);

/** /library: the first page. */
export function LibraryIndex() {
  return <Navigate to="/library/$kind" params={{ kind: 'monsters' }} replace />;
}

/** /library/$kind?id=… */
export function LibraryScreen() {
  const { kind } = useParams({ from: '/library/$kind' });
  const { id } = useSearch({ from: '/library/$kind' });
  const library = useLibrary();
  if (!isKind(kind)) return <Navigate to="/library/$kind" params={{ kind: 'monsters' }} replace />;
  return (
    <>
      <LibrarySidebar kind={kind} library={library} />
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Library', KIND[kind].label]} />
        {!library && !['maps', 'adventures', 'sources'].includes(kind) ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">Opening the Library…</div>
        ) : kind === 'maps' ? (
          <MapsPage />
        ) : kind === 'adventures' ? (
          <AdventuresPage />
        ) : kind === 'sources' ? (
          <SourcesPage />
        ) : (
          <Browser key={kind} kind={kind} library={library!} id={id} />
        )}
      </main>
    </>
  );
}

function LibrarySidebar({ kind, library }: { kind: Kind; library: Library | null }) {
  const navigate = useNavigate();
  const spells = useSpells();
  const items = useItems();
  const counts: Partial<Record<Kind, number>> = library
    ? {
        monsters: library.monsters.length,
        npcs: library.monsters.filter(isNpc).length,
        spells: spells.filter((s) => !s.hidden).length,
        items: items.filter((s) => !s.hidden).length,
        feats: library.feats.length,
        backgrounds: library.backgrounds.length,
        species: library.species.length,
        classes: library.classes.length,
        rules: library.rules.length,
        maps: DYSON_MAPS.length,
        sources: SOURCES.filter((s) => s.included).length + 3,
      }
    : { maps: DYSON_MAPS.length };
  return (
    <Sidebar title="Library">
      <SidebarSection title="Browse">
        {KINDS.map((k) => {
          const { label, icon: Icon } = KIND[k];
          return (
            <button key={k} type="button" aria-current={k === kind ? 'page' : undefined} onClick={() => void navigate({ to: '/library/$kind', params: { kind: k }, search: {} })} className={cn(SIDEBAR_ROW, k === kind && SIDEBAR_ROW_ON)}>
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {counts[k] !== undefined && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{counts[k]!.toLocaleString('en-US')}</span>}
            </button>
          );
        })}
      </SidebarSection>
      <p className="mt-auto px-2.5 text-[10.5px] leading-snug text-muted-foreground">Open-licensed material only. Credits and licenses: Sources & Licenses.</p>
    </Sidebar>
  );
}

const isNpc = (m: LibraryMonster) => /^Humanoid/.test(m.type);

// ── The list-and-detail browser ─────────────────────────────────────────

type Entry = { id: string; name: string; src: string; meta: string; search: string };

const CR_BANDS: { label: string; test: (cr: number) => boolean }[] = [
  { label: '0–1', test: (cr) => cr <= 1 },
  { label: '2–4', test: (cr) => cr >= 2 && cr <= 4 },
  { label: '5–10', test: (cr) => cr >= 5 && cr <= 10 },
  { label: '11–16', test: (cr) => cr >= 11 && cr <= 16 },
  { label: '17+', test: (cr) => cr >= 17 },
];
const crNumber = (cr: string) => (cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr));

function Browser({ kind, library, id }: { kind: Exclude<Kind, 'maps' | 'adventures' | 'sources'>; library: Library; id?: string }) {
  const navigate = useNavigate();
  const spells = useSpells();
  const items = useItems();
  const [query, setQuery] = useState('');
  const [book, setBook] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const select = (next: string) => void navigate({ to: '/library/$kind', params: { kind }, search: { id: next }, replace: true });
  const pictures = usePictures();

  const entries: Entry[] = useMemo(() => {
    const blocks = (b: Block[]) => b.map((x) => `${x.name} ${x.text}`).join(' ');
    switch (kind) {
      case 'monsters':
      case 'npcs':
        return library.monsters.filter((m) => kind === 'monsters' || isNpc(m)).map((m) => ({ id: m.id, name: m.name, src: m.src, meta: `CR ${m.cr} · ${m.size} ${m.type}`, search: `${m.type} ${m.environments.join(' ')}` }));
      case 'spells':
        return spells.filter((s) => !s.hidden).map((s) => ({ id: s.id, name: s.name, src: s.book ?? 'homebrew', meta: `${s.level ? `Level ${s.level}` : 'Cantrip'} · ${s.school}`, search: `${s.school} ${s.classes.join(' ')}` }));
      case 'items':
        return items.filter((s) => !s.hidden).map((s) => ({ id: s.id, name: s.name, src: s.book ?? 'homebrew', meta: s.rarity ? `${s.rarity} ${s.type.split(',')[0]}` : s.type, search: `${s.type} ${s.category}` }));
      case 'feats':
        return library.feats.map((f) => ({ id: f.id, name: f.name, src: f.src, meta: [f.kind, f.prerequisite && `Requires ${f.prerequisite}`].filter(Boolean).join(' · '), search: blocks(f.benefits) }));
      case 'backgrounds':
        return library.backgrounds.map((f) => ({ id: f.id, name: f.name, src: f.src, meta: f.benefits.map((b) => b.name).filter(Boolean).slice(0, 3).join(', '), search: blocks(f.benefits) }));
      case 'species':
        return library.species.map((f) => ({ id: f.id, name: f.name, src: f.src, meta: f.parent ? `Subspecies of ${f.parent}` : 'Species', search: blocks(f.benefits) }));
      case 'classes':
        return library.classes.map((c) => ({ id: c.id, name: c.name, src: c.src, meta: c.parent ? `${c.parent} subclass` : 'Class', search: c.parent ?? '' }));
      case 'rules':
        return library.rules.map((r) => ({ id: r.id, name: r.name, src: r.src, meta: sourceName(r.src), search: r.text.slice(0, 2000) }));
    }
  }, [kind, library, spells, items]);

  const monsterTypes = kind === 'monsters' ? [...new Set(library.monsters.map((m) => m.type.split(' (')[0]!))].sort() : [];
  const books = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.src, (counts.get(e.src) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => sourceName(a[0]).localeCompare(sourceName(b[0])));
  }, [entries]);
  const monsterOf = (e: Entry) => library.monsters.find((m) => m.id === e.id);
  const list = entries
    .filter((e) => !book || e.src === book)
    .filter((e) => !band || ((kind === 'monsters' || kind === 'npcs') && CR_BANDS.find((b) => b.label === band)!.test(crNumber(monsterOf(e)?.cr ?? '0'))))
    .filter((e) => !type || e.meta.includes(type))
    .filter((e) => matches(query, e.name, e.meta, e.search))
    .sort((a, b) => nameRank(query, a.name) - nameRank(query, b.name) || a.name.localeCompare(b.name) || sourceName(a.src).localeCompare(sourceName(b.src)));
  const shown = list.slice(0, 600);
  const selected = entries.find((e) => e.id === id) ?? shown[0];

  return (
    <div className="flex min-h-0 flex-1">
      <ListColumn
        query={query}
        onQuery={setQuery}
        placeholder={`Search ${KIND[kind].label.toLowerCase()}`}
        count={list.length}
        ids={shown.map((e) => e.id)}
        selected={selected?.id}
        onSelect={select}
        onEnter={() => undefined}
      >
        <div className="flex flex-col gap-1.5 px-1 pb-2">
          {books.length > 1 && (
            <select aria-label="Book" value={book ?? ''} onChange={(e) => setBook(e.target.value || null)} className="h-8 rounded-lg border bg-background px-2 text-[12.5px]">
              <option value="">Every book · {entries.length.toLocaleString('en-US')}</option>
              {books.map(([b, n]) => (
                <option key={b} value={b}>
                  {b === 'homebrew' ? 'Homebrew' : sourceName(b)} · {n}
                </option>
              ))}
            </select>
          )}
          {(kind === 'monsters' || kind === 'npcs') && (
            <div className="flex flex-wrap gap-1">
              {CR_BANDS.map((b) => (
                <Chip key={b.label} on={band === b.label} onClick={() => setBand(band === b.label ? null : b.label)}>
                  CR {b.label}
                </Chip>
              ))}
            </div>
          )}
          {kind === 'monsters' && (
            <select aria-label="Type" value={type ?? ''} onChange={(e) => setType(e.target.value || null)} className="h-8 rounded-lg border bg-background px-2 text-[12.5px]">
              <option value="">Every type</option>
              {monsterTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
        {shown.map((e) => (
          <Row key={e.id} id={e.id} selected={e.id === selected?.id} onSelect={select} trail={<RowPicture image={pictures.get(pictureKey(kind, e.id))} />}>
            <span className="truncate text-[13.5px] font-medium">{e.name}</span>
            <span className="truncate text-[11.5px] text-muted-foreground">
              {e.meta} · {e.src === 'homebrew' ? 'Homebrew' : sourceName(e.src)}
            </span>
          </Row>
        ))}
        {list.length > shown.length && <p className="px-3 py-3 text-center text-[12px] text-muted-foreground">{list.length - shown.length} more: search or pick a book to narrow it.</p>}
        {!list.length && <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">Nothing matches.</p>}
      </ListColumn>
      <DetailColumn>{selected ? <Detail kind={kind} id={selected.id} library={library} /> : <Empty title="Nothing Here" />}</DetailColumn>
    </div>
  );
}

function Detail({ kind, id, library }: { kind: Exclude<Kind, 'maps' | 'adventures' | 'sources'>; id: string; library: Library }) {
  const navigate = useNavigate();
  const role = useRole();
  const pc = useCharacter();
  const spells = useSpells();
  const items = useItems();
  const player = role === 'player' ? pc : undefined;
  if (kind === 'spells') {
    const spell = spells.find((s) => s.id === id);
    return spell ? <SpellDetail key={id} spell={spell} pc={player} onEdit={() => void navigate({ to: '/spells', search: { id } })} /> : null;
  }
  if (kind === 'items') {
    const item = items.find((s) => s.id === id);
    return item ? <ItemDetail key={id} item={item} pc={player} onEdit={() => void navigate({ to: '/items', search: { id } })} /> : null;
  }
  if (kind === 'monsters' || kind === 'npcs') {
    const monster = library.monsters.find((m) => m.id === id);
    return monster ? <StatBlock monster={monster} /> : null;
  }
  if (kind === 'classes') {
    const c = library.classes.find((x) => x.id === id);
    if (!c) return null;
    return (
      <Article picture={pictureKey('classes', c.id)} name={c.name} line={c.parent ? `${c.parent} subclass` : `Class${c.hitDie ? ` · Hit die ${c.hitDie}` : ''}${c.saves.length ? ` · Saves ${c.saves.join(', ')}` : ''}`} src={c.src} text={c.text}>
        {c.features.map((f) => (
          <section key={`${f.level}-${f.name}`} className="flex flex-col gap-1.5 border-t pt-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">Level {f.level}</span>
              <span className="flex-1 text-[15px] font-semibold">{f.name}</span>
              {player && <AddFeature name={f.name} text={f.text} source={c.name} />}
            </div>
            <RulesText text={f.text} className="text-[13.5px]" />
          </section>
        ))}
      </Article>
    );
  }
  if (kind === 'rules') {
    const r = library.rules.find((x) => x.id === id);
    return r ? <Article picture={pictureKey('rules', r.id)} name={r.name} line="" src={r.src} text={r.text} /> : null;
  }
  const entry = library[kind].find((x) => x.id === id);
  if (!entry) return null;
  const whole = [entry.text, ...entry.benefits.map((b) => (b.name ? `***${b.name}.*** ${b.text}` : b.text))].filter(Boolean).join('\n\n');
  const line = kind === 'feats' ? [entry.kind ? `${entry.kind} feat` : 'Feat', entry.prerequisite && `Prerequisite: ${entry.prerequisite}`].filter(Boolean).join(' · ') : kind === 'species' ? (entry.parent ? `Subspecies of ${entry.parent}` : 'Species') : 'Background';
  return (
    <Article picture={pictureKey(kind, entry.id)} name={entry.name} line={line} src={entry.src} text={whole}>
      {player && (
        <div className="border-t pt-3">
          <AddFeature name={entry.name} text={whole} source={kind === 'feats' ? 'Feat' : kind === 'species' ? 'Species' : 'Background'} label />
        </div>
      )}
    </Article>
  );
}

function Article({ name, line, src, text, picture, children }: { name: string; line: string; src: string; text: string; picture: string; children?: ReactNode }) {
  const image = usePictures().get(picture);
  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-start gap-5 border-b pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-[0.1em] text-link uppercase">{sourceName(src)}</span>
          <h1 className="font-display text-[34px] leading-[1.05] font-black break-words uppercase">{name}</h1>
          {line && <p className="text-[14.5px] text-muted-foreground italic">{line}</p>}
        </div>
        <HeaderPicture id={picture} image={image} label={name} />
      </header>
      {text && <RulesText text={text} />}
      {children}
    </article>
  );
}

/** Adds a feat, trait or class feature to the character you play (Features & Traits). */
function AddFeature({ name, text, source, label }: { name: string; text: string; source: string; label?: boolean }) {
  const pc = useCharacter();
  if (!pc) return null;
  const has = (pc.traits ?? []).some((f) => f.name.toLowerCase() === name.toLowerCase());
  const add = () => {
    const feature: Feature = { id: newId(), name, source, text, uses: usesFromText(text), action: actionKind(text) };
    updateRecord('pcs', pc.id, { traits: [...(pc.traits ?? []), feature] });
    toast('Feature Added', { description: `${name}, on ${pc.name || 'your character'}’s sheet.` });
  };
  return (
    <Button size={label ? 'sm' : 'xs'} variant={label ? 'default' : 'outline'} disabled={has} onClick={add}>
      <PlusIcon /> {has ? 'On Your Sheet' : label ? `Add To ${pc.name.split(' ')[0] || 'Your'}’s Features` : 'Add'}
    </Button>
  );
}

// ── Monsters ────────────────────────────────────────────────────────────

/** A creature's stat block, with Copy To Bestiary for the DM. */
function StatBlock({ monster: m }: { monster: LibraryMonster }) {
  const role = useRole();
  const world = useWorld();
  const navigate = useNavigate();
  const image = usePictures().get(pictureKey('monsters', m.id));
  const copy = () => {
    if (!world) return;
    const section = (title: string, blocks: Block[]) => blocks.map((b) => ({ name: title ? `${title}: ${b.name}` : b.name, text: b.text }));
    const created = createMonster(world.id, {
      name: m.name,
      image,
      kind: `${m.size} ${m.type.toLowerCase()}, ${m.alignment}`,
      ac: m.ac,
      hp: m.hp,
      hpDice: m.hpDice,
      speed: m.speed,
      abilities: Object.fromEntries(ABILITIES.map((a, i) => [a, m.abilities[i] ?? 10])) as Record<(typeof ABILITIES)[number], number>,
      cr: m.cr,
      traits: [
        m.saves && `Saving Throws ${m.saves}`,
        m.skills && `Skills ${m.skills}`,
        m.vulnerable && `Damage Vulnerabilities ${m.vulnerable}`,
        m.resist && `Damage Resistances ${m.resist}`,
        m.immune && `Damage Immunities ${m.immune}`,
        m.conditionImmune && `Condition Immunities ${m.conditionImmune}`,
        m.senses && `Senses ${m.senses}`,
        m.languages && `Languages ${m.languages}`,
        ...m.traits.map((t) => `${t.name}. ${t.text}`),
        `Source: ${sourceName(m.src)}`,
      ]
        .filter(Boolean)
        .join('\n'),
      actions: [...section('', m.actions), ...section('Bonus Action', m.bonus), ...section('Reaction', m.reactions), ...section('Legendary', m.legendary)],
    });
    toast('Copied To The Bestiary', { description: m.name, action: { label: 'Open', onClick: () => void navigate({ to: '/bestiary/$monsterId', params: { monsterId: created.id } }) } });
  };
  const line = (label: string, value: string) => value && (
    <p className="text-[13.5px]">
      <span className="font-semibold">{label}</span> {value}
    </p>
  );
  const blocks = (title: string, list: Block[]) =>
    list.length > 0 && (
      <section className="flex flex-col gap-2">
        {title && <h3 className="border-b border-primary pb-1 font-display text-[18px] font-black text-primary uppercase">{title}</h3>}
        {list.map((b) => (
          <RulesText key={b.name} text={`***${b.name}.*** ${b.text}`} className="text-[13.5px]" />
        ))}
      </section>
    );
  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-start gap-5 border-b pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-[0.1em] text-link uppercase">{sourceName(m.src)}</span>
          <h1 className="font-display text-[34px] leading-[1.05] font-black break-words uppercase">{m.name}</h1>
          <p className="text-[14.5px] text-muted-foreground italic">
            {m.size} {m.type.toLowerCase()}, {m.alignment}
          </p>
          {role === 'dm' && world && (
            <span className="pt-1.5">
              <Button size="sm" onClick={copy}>
                <CopyPlusIcon /> Copy To Bestiary
              </Button>
            </span>
          )}
        </div>
        <HeaderPicture id={pictureKey('monsters', m.id)} image={image} label={m.name} />
      </header>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Fact label="Armor Class">
          {m.ac}
          {m.acNote && <span className="text-muted-foreground"> ({m.acNote})</span>}
        </Fact>
        <Fact label="Hit Points">
          {m.hp}
          {m.hpDice && <span className="text-muted-foreground"> ({m.hpDice})</span>}
        </Fact>
        <Fact label="Speed">{m.speed}</Fact>
        <Fact label="Challenge">
          {m.cr}
          {m.xp ? <span className="text-muted-foreground"> ({m.xp.toLocaleString('en-US')} XP)</span> : null}
        </Fact>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {ABILITIES.map((a, i) => (
          <div key={a} className="flex flex-col items-center rounded-xl border py-1.5">
            <span className="label text-[9px]">{a.toUpperCase()}</span>
            <span className="text-[16px] font-semibold">{m.abilities[i]}</span>
            <span className="font-mono text-[11px] text-muted-foreground" title={ABILITY_NAME[a]}>
              {signed(modifier(m.abilities[i] ?? 10))}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {line('Saving Throws', m.saves)}
        {line('Skills', m.skills)}
        {line('Damage Vulnerabilities', m.vulnerable)}
        {line('Damage Resistances', m.resist)}
        {line('Damage Immunities', m.immune)}
        {line('Condition Immunities', m.conditionImmune)}
        {line('Senses', m.senses)}
        {line('Languages', m.languages)}
        {line('Habitats', m.environments.join(', '))}
      </div>
      {blocks('', m.traits)}
      {blocks('Actions', m.actions)}
      {blocks('Bonus Actions', m.bonus)}
      {blocks('Reactions', m.reactions)}
      {blocks('Legendary Actions', m.legendary)}
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border px-3 py-2">
      <span className="label text-[9.5px]">{label}</span>
      <span className="text-[13.5px] leading-snug">{children}</span>
    </div>
  );
}

// ── Maps ────────────────────────────────────────────────────────────────

/** Dyson Logos's free commercial maps: the ones bundled with the app first, then the whole catalog (downloaded when you add one). */
function MapsPage() {
  const navigate = useNavigate();
  const role = useRole();
  const world = useWorld();
  const pc = useCharacter();
  const [query, setQuery] = useState('');
  const [bundledOnly, setBundledOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const owner = role === 'player' ? (pc ? { worldId: null, characterId: pc.id } : null) : world ? { worldId: world.id, characterId: null } : null;
  const list = DYSON_MAPS.filter((m) => (!bundledOnly || m.file) && matches(query, m.title)).sort((a, b) => Number(Boolean(b.file)) - Number(Boolean(a.file)));
  const shown = list.slice(0, 120);

  const add = async (map: DysonMap) => {
    if (!owner) return;
    setBusy(map.image);
    try {
      const got = await window.api.files.importLibraryMap(map.file ? { bundled: map.file } : { url: map.image });
      if (!got) throw new Error('not saved');
      const scale = map.file ? 2000 / Math.max(1, map.width) : 3000 / Math.max(1, map.width);
      const created = createMap({ ...owner, name: map.title, image: got.file, width: Math.round(map.width * Math.min(1, scale)), height: Math.round(map.height * Math.min(1, scale)) });
      toast('Map Added', { description: `${map.title} · Cartography by Dyson Logos`, action: { label: 'Open', onClick: () => void navigate({ to: '/maps/$mapId', params: { mapId: created.id } }) } });
    } catch {
      toast.error('That map couldn’t be added', { description: map.file ? 'Its file is missing from the app.' : 'It couldn’t be downloaded. Check the connection and try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-7 pt-6 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex max-w-[70ch] flex-col gap-1">
            <h1 className="font-display text-[30px] leading-none font-black uppercase">Dyson Logos Maps</h1>
            <p className="text-[13.5px] text-muted-foreground">
              {DYSON_MAPS.length} hand-drawn maps, free for personal and commercial use with credit: “Cartography by Dyson Logos”. {DYSON_MAPS.filter((m) => m.file).length} come with the app; the rest download from dysonlogos.blog when you add one. Only the maps are licensed, not the blog posts’ text.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border px-2.5 focus-within:border-primary">
              <SearchIcon className="size-4 text-muted-foreground" />
              <input aria-label="Search maps" value={query} placeholder="Search maps" onChange={(e) => setQuery(e.target.value)} className="w-48 bg-transparent text-[13.5px] outline-none" />
            </div>
            <Chip on={bundledOnly} onClick={() => setBundledOnly(!bundledOnly)}>
              In The App Only
            </Chip>
          </div>
        </header>
        {!owner && <p className="rounded-xl border px-4 py-3 text-[13px] text-muted-foreground">{role === 'player' ? 'Make a character to add maps to.' : 'Open a campaign to add maps to.'}</p>}
        <div className="grid grid-cols-2 gap-3 @container lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((m) => (
            <figure key={m.image} className="flex flex-col overflow-hidden rounded-xl border">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white">
                <img src={m.file ? `library/maps/${m.file}` : `${m.image}?w=400`} alt={m.title} loading="lazy" className="max-h-full max-w-full object-contain" />
              </div>
              <figcaption className="flex flex-col gap-2 border-t px-3 py-2.5">
                <span className="line-clamp-2 text-[13px] font-medium">{m.title}</span>
                <span className="flex items-center gap-1.5">
                  <Button size="xs" disabled={!owner || busy === m.image} onClick={() => void add(m)}>
                    <ImagePlusIcon /> {busy === m.image ? 'Adding…' : 'Add To Maps'}
                  </Button>
                  <a href={m.post} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground">
                    <ExternalLinkIcon className="size-3" /> Post
                  </a>
                  {m.file && <span className="ml-auto font-mono text-[10px] text-muted-foreground uppercase">In App</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        {list.length > shown.length && <p className="text-center text-[12.5px] text-muted-foreground">{list.length - shown.length} more: search to find them.</p>}
      </div>
    </div>
  );
}

// ── Adventures & settings ───────────────────────────────────────────────

function AdventuresPage() {
  const navigate = useNavigate();
  const go = (kind: Kind) => void navigate({ to: '/library/$kind', params: { kind }, search: {} });
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-8 pt-7 pb-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[30px] leading-none font-black uppercase">Adventures & Settings</h1>
          <p className="text-[14px] text-muted-foreground">
            Very little adventure and setting writing is open-licensed: publishers keep their stories, places and characters as Product Identity even when the rules are open. Here’s what is open, what’s in the app, and where to look.
          </p>
        </header>
        <Card title="In The App">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px]">
            <li>
              <b>Tal’Dorei Campaign Setting</b> (Green Ronin, OGL 1.0a): its open content: backgrounds, subclasses, a feat and creatures. Filter any page by the book “Tal’Dorei Campaign Setting”.{' '}
              <button type="button" className="text-link hover:underline" onClick={() => go('backgrounds')}>
                Backgrounds
              </button>
              {' · '}
              <button type="button" className="text-link hover:underline" onClick={() => go('classes')}>
                Subclasses
              </button>
            </li>
            <li>
              <b>Ready-made encounters</b>: thousands of creatures and NPCs with their habitats (forest, underdark, urban…), to copy into an encounter.{' '}
              <button type="button" className="text-link hover:underline" onClick={() => go('monsters')}>
                Monsters
              </button>
              {' · '}
              <button type="button" className="text-link hover:underline" onClick={() => go('npcs')}>
                NPCs
              </button>
            </li>
            <li>
              <b>Adventure sites</b>: Dyson Logos’s {DYSON_MAPS.length} maps of dungeons, towns, temples and caves, ready to add to your Maps and pin.{' '}
              <button type="button" className="text-link hover:underline" onClick={() => go('maps')}>
                Maps
              </button>
            </li>
            <li>
              <b>The rules to run them</b>: the SRD 5.1 and 5.2 rules, conditions, travel, environments and more.{' '}
              <button type="button" className="text-link hover:underline" onClick={() => go('rules')}>
                Rules
              </button>
            </li>
          </ul>
        </Card>
        <Card title="Open, But Not In The App">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px]">
            <li>
              <b>One Page Dungeon Contest</b> (dungeoncontest.com): hundreds of one-page adventures, most under CC BY-SA (share-alike: anything made from them must carry the same license), mostly written for no particular system.{' '}
              <a className="text-link hover:underline" href="https://www.dungeoncontest.com/" target="_blank" rel="noreferrer">
                dungeoncontest.com
              </a>
            </li>
            <li>
              <b>Dyson Logos’s blog posts</b>: each map’s post often has room keys and hooks, but only the maps themselves carry the free commercial license.
            </li>
          </ul>
        </Card>
        <Card title="Not Open">
          <p className="text-[13.5px]">
            Wizards of the Coast’s published adventures and settings (the Forgotten Realms, Eberron…), Kobold Press’s Midgard, Critical Role’s Exandria lore beyond Tal’Dorei’s open content, and Level Up’s adventures stay with their publishers. They can’t be shipped in the app, though your table can of course write its own notes about them.
          </p>
        </Card>
      </article>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border px-5 py-4">
      <Label>{title}</Label>
      {children}
    </section>
  );
}

// ── Sources & licenses ──────────────────────────────────────────────────

const KIND_NAME: Record<string, string> = { monsters: 'monsters', spells: 'spells', items: 'items', feats: 'feats', backgrounds: 'backgrounds', species: 'species', classes: 'classes', rules: 'rules' };

function SourcesPage() {
  const [license, setLicense] = useState<string | null>(null);
  const included = SOURCES.filter((s) => s.included);
  const own = [
    {
      key: 'app-srd',
      name: 'System Reference Document 5.1 (spells, items, species, classes)',
      publisher: 'Wizards of the Coast',
      via: '5e-bits/5e-database (MIT)',
      license: 'CC-BY-4.0',
      commercial: 'Yes, with the attribution notice.',
      what: `${SRD_SPECIES.length} species, ${SRD_CLASSES.length} classes level by level, 319 spells, 578 items`,
      overlap: 'The base everything else is compared against. SRD 5.2 rewrites most of it; Level Up rewrites most of its spells.',
      url: 'https://dnd.wizards.com/resources/systems-reference-document',
    },
    {
      key: 'app-backgrounds',
      name: 'Ballad’s backgrounds (Criminal, Sage, Soldier…)',
      publisher: 'Ballad',
      via: 'Written for the app',
      license: 'Ours',
      commercial: 'Yes: two skills each, no rules text copied.',
      what: '11 backgrounds by name and skills',
      overlap: 'Names match common backgrounds; only their skill pairs are used.',
      url: '',
    },
    {
      key: 'dyson',
      name: 'Dyson Logos Commercial Maps',
      publisher: 'Dyson Logos',
      via: 'dysonlogos.blog/maps/commercial-maps',
      license: 'Free commercial license',
      commercial: 'Yes, crediting “Cartography by Dyson Logos”. Maps only, not the posts’ text.',
      what: `${DYSON_MAPS.length} maps (${DYSON_MAPS.filter((m) => m.file).length} in the app, the rest downloaded on request)`,
      overlap: 'None: the only maps here.',
      url: 'https://dysonlogos.blog/maps/commercial-maps/',
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-7 pt-6 pb-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[30px] leading-none font-black uppercase">Sources & Licenses</h1>
          <p className="max-w-[80ch] text-[13.5px] text-muted-foreground">
            Everything in the Library and on the Spells and Inventory pages, where it’s from, who made it, and its license. All of it allows commercial use; what each license asks for is listed. Overlap is counted by name: an entry whose name is also in the app’s own SRD 5.1 data, or in another source, is usually that one rewritten (a 2024 version, a Level Up version), not a copy.
          </p>
          <p className="max-w-[80ch] rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-[13px]">
            Before selling: the OGL 1.0a asks that its full text ship with the content and that each source’s Section 15 copyright notice be kept (the notices below are built from each book’s details; check them against the books). Neither license gives trademark rights: “Dungeons & Dragons”, “D&D” and publishers’ logos can’t be used to market the app. This page isn’t legal advice.
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <Label>The App’s Own Data</Label>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-muted/50 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Made By</th>
                  <th className="px-3 py-2">License · Selling The App</th>
                  <th className="px-3 py-2">What’s In The App</th>
                  <th className="px-3 py-2">Overlap</th>
                </tr>
              </thead>
              <tbody>
                {own.map((s) => (
                  <tr key={s.key} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {s.name}
                        </a>
                      ) : (
                        s.name
                      )}
                      <div className="text-[11px] font-normal text-muted-foreground">via {s.via}</div>
                    </td>
                    <td className="px-3 py-2">{s.publisher}</td>
                    <td className="px-3 py-2">
                      <b>{s.license}</b> · {s.commercial}
                    </td>
                    <td className="px-3 py-2">{s.what}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.overlap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Label>{`From Open5e · ${included.length} Books`}</Label>
          <p className="text-[12.5px] text-muted-foreground">Collected by Open5e (github.com/open5e/open5e-api; its code is MIT, the books keep their own licenses). Open5e’s copy of the SRD 5.1 spells and items is left out: the app already has them.</p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-muted/50 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Book</th>
                  <th className="px-3 py-2">Made By</th>
                  <th className="px-3 py-2">License · Selling The App</th>
                  <th className="px-3 py-2">In The App</th>
                  <th className="px-3 py-2">Overlap By Name</th>
                </tr>
              </thead>
              <tbody>
                {included.map((s) => (
                  <tr key={s.key} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {s.name}
                        </a>
                      ) : (
                        s.name
                      )}
                      {s.year && <div className="text-[11px] font-normal text-muted-foreground">{s.year}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {s.publisher}
                      {s.authors && <div className="line-clamp-2 text-[11px] text-muted-foreground">{s.authors}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {s.licenses.map((l) => (
                        <div key={l}>
                          <b>{LICENSE_NOTE[l]?.name ?? l}</b> · {LICENSE_NOTE[l]?.commercial ?? ''}
                        </div>
                      ))}
                      {s.licenses.length > 1 && <div className="text-[11px] text-muted-foreground">Either license may be used.</div>}
                    </td>
                    <td className="px-3 py-2">
                      {Object.entries(s.counts)
                        .map(([k, n]) => `${n} ${KIND_NAME[k] ?? k}`)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {Object.entries(s.overlap)
                        .map(([k, o]) => {
                          const parts = [o.app ? `${o.app} with the app’s SRD 5.1` : '', ...Object.entries(o.others).map(([doc, n]) => `${n} with ${sourceName(doc)}`)].filter(Boolean);
                          return parts.length ? `${KIND_NAME[k] ?? k}: ${parts.join(', ')}` : '';
                        })
                        .filter(Boolean)
                        .join('; ') || 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Label>Credits</Label>
          <div className="flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-[12.5px]">
            <p>{SRD_CREDIT}</p>
            <p>Spell, item, species and class data converted from 5e-bits/5e-database (MIT License, Copyright 2018–2020 Adrian Padua, Christopher Ward).</p>
            <p>Library data collected by Open5e (open5e-api, Modified MIT License, Copyright 2018 Ean Moody).</p>
            <p>Cartography by Dyson Logos (dysonlogos.blog), under his free commercial map license.</p>
            <p className="pt-1 font-semibold">OGL 1.0a Section 15 notices</p>
            {SOURCES.filter((s) => s.ogl && s.included).map((s) => (
              <p key={s.key} className="text-muted-foreground">
                {s.credit}
              </p>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Label>License Texts</Label>
          <div className="flex flex-wrap gap-1.5">
            {LICENSES.map((l) => (
              <Chip key={l.key} on={license === l.key} onClick={() => setLicense(license === l.key ? null : l.key)}>
                {l.name}
              </Chip>
            ))}
          </div>
          {license && (
            <div className="max-h-[420px] overflow-y-auto rounded-xl border px-4 py-3">
              <RulesText text={LICENSES.find((l) => l.key === license)!.text} className="text-[12.5px]" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
