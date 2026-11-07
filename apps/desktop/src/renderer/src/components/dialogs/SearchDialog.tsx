import { useNavigate } from '@tanstack/react-router';
import { BookOpenIcon, CameraIcon, CircleUserIcon, ContactIcon, DicesIcon, GlobeIcon, MapPinIcon, MaximizeIcon, MoonIcon, PenLineIcon, PlusIcon, SettingsIcon, ShieldIcon, SkullIcon, SwordsIcon, WaypointsIcon, Grid3x3Icon } from 'lucide-react';
import { SECTION_ICON } from '@/components/shell/WorldMenu';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { openSection, openWorld } from '@/lib/actions';
import { useBooks, useLive, useRole, useSection, useSectionWorlds, useWorld, useWorldRecords } from '@/lib/hooks';
import { SECTIONS, type EntryKind } from '@/lib/model';
import { kindInfo, SECTION_INFO } from '@/lib/sections';
import { formatWords } from '@/lib/text';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { Portrait } from '@/components/shared/Portrait';
import { useWorldEntries } from '@/lib/shared';

const KIND_ICON: Record<EntryKind, typeof CircleUserIcon> = { character: CircleUserIcon, place: MapPinIcon, lore: BookOpenIcon, crew: ContactIcon };

/**
 * Search (Ctrl+K) — find anything in the open world (production, campaign):
 * scenes (title, text and note), its world-bible entries, timeline events,
 * shots, player characters, monsters and encounters; another world of the
 * section; or run a command (switch section, new world, focus, theme…).
 */
export function SearchDialog() {
  const navigate = useNavigate();
  const open = useUi((s) => s.search);
  const section = useSection();
  const info = SECTION_INFO[section];
  const world = useWorld();
  const worlds = useSectionWorlds();
  const books = useBooks();
  const scenes = useLive('scenes');
  // A player finds what's shared with them (as they see it), not the GM's.
  const entries = useWorldEntries();
  const events = useWorldRecords('events');
  const shots = useWorldRecords('shots');
  const pcs = useWorldRecords('pcs');
  const monsters = useWorldRecords('monsters');
  const encounters = useWorldRecords('encounters');
  // Play: open it, the campaigns and the commands; the rest is Tabletop's to search.
  const play = section === 'play';
  const prefs = usePreferences();
  const player = useRole() === 'player';
  const bookIds = new Set(books.map((b) => b.id));
  const close = () => useUi.getState().setSearch(false);
  const go = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={(o) => useUi.getState().setSearch(o)} title="Search" description={`Search this ${info.container.toLowerCase()}`} className="sm:max-w-[640px]">
      <CommandInput placeholder={`Search ${world?.name ?? 'Ballad'}, or type a command…`} />
      <CommandList className="max-h-[440px]">
        <CommandEmpty>Nothing found.</CommandEmpty>
        {play && world && (
          <CommandGroup heading="Play">
            <CommandItem value={`open play ${world.name}`} onSelect={go(() => void window.api.table?.open(window.api.config.registry.activeId, world.id))}>
              <Grid3x3Icon />
              <span className="truncate">Open Play: {world.name || 'Untitled Campaign'}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {!play && (
        <CommandGroup heading={section === 'tabletop' ? 'Sessions' : 'Scenes'}>
          {scenes
            .filter((s) => bookIds.has(s.bookId))
            .map((scene) => (
              <CommandItem key={scene.id} value={`scene ${scene.title} ${scene.note} ${scene.text.slice(0, 600)} ${scene.id}`} onSelect={go(() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } }))}>
                <PenLineIcon />
                <span className="truncate">{scene.title || `Untitled ${info.scene}`}</span>
                <CommandShortcut>{formatWords(scene.words)}</CommandShortcut>
              </CommandItem>
            ))}
        </CommandGroup>
        )}
        {!play && (
        <CommandGroup heading={section === 'film' ? 'Cast, Crew & Locations' : 'World Bible'}>
          {entries
            .map((entry) => {
              const Icon = KIND_ICON[entry.kind];
              return (
                <CommandItem key={entry.id} value={`${entry.kind} ${entry.name} ${entry.tagline} ${entry.group} ${entry.id}`} onSelect={go(() => void navigate({ to: '/bible/$kind/$entryId', params: { kind: entry.kind, entryId: entry.id } }))}>
                  {entry.image ? <Portrait image={entry.image} name={entry.name} className="size-5 rounded-full" /> : <Icon />}
                  <span className="truncate">{entry.name || 'Untitled'}</span>
                  <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">{entry.tagline || kindInfo(entry.kind, section).singular}</span>
                </CommandItem>
              );
            })}
        </CommandGroup>
        )}
        {section === 'film' && (
          <CommandGroup heading="Shots">
            {shots.map((shot) => (
              <CommandItem key={shot.id} value={`shot ${shot.size} ${shot.move} ${shot.description} ${shot.id}`} onSelect={go(() => void navigate({ to: '/shots', search: { scene: shot.sceneId } }))}>
                <CameraIcon />
                <span className="truncate">{shot.description || 'Untitled Shot'}</span>
                <CommandShortcut>{shot.size}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {section === 'tabletop' && (
          <>
            <CommandGroup heading="Party">
              {pcs.map((pc) => (
                <CommandItem key={pc.id} value={`pc ${pc.name} ${pc.player} ${pc.className} ${pc.id}`} onSelect={go(() => void navigate({ to: '/party/$pcId', params: { pcId: pc.id } }))}>
                  {pc.image ? <Portrait image={pc.image} name={pc.name} className="size-5 rounded-full" /> : <ShieldIcon />}
                  <span className="truncate">{pc.name || 'Unnamed Character'}</span>
                  <CommandShortcut>
                    {pc.className} {pc.level}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {!player && (
              <CommandGroup heading="Bestiary & Encounters">
                {monsters.map((m) => (
                  <CommandItem key={m.id} value={`monster ${m.name} ${m.kind} ${m.id}`} onSelect={go(() => void navigate({ to: '/bestiary/$monsterId', params: { monsterId: m.id } }))}>
                    {m.image ? <Portrait image={m.image} name={m.name} className="size-5 rounded-md" /> : <SkullIcon />}
                    <span className="truncate">{m.name || 'Unnamed Creature'}</span>
                    <CommandShortcut>CR {m.cr}</CommandShortcut>
                  </CommandItem>
                ))}
                {encounters.map((e) => (
                  <CommandItem key={e.id} value={`encounter ${e.name} ${e.id}`} onSelect={go(() => void navigate({ to: '/encounters/$encounterId', params: { encounterId: e.id } }))}>
                    <SwordsIcon />
                    <span className="truncate">{e.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
        {section !== 'film' && !play && (
          <CommandGroup heading="Timeline">
            {events.map((event) => (
              <CommandItem key={event.id} value={`event ${event.title} ${event.summary} ${event.year} ${event.id}`} onSelect={go(() => void navigate({ to: '/timeline', search: { event: event.id } }))}>
                <WaypointsIcon />
                <span className="truncate">{event.title}</span>
                <CommandShortcut>{event.year}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {worlds.length > 1 && (
          <CommandGroup heading={info.containers}>
            {worlds
              .filter((w) => w.id !== world?.id)
              .map((w) => (
                <CommandItem
                  key={w.id}
                  value={`world ${w.name} ${w.id}`}
                  onSelect={go(() => void navigate({ to: '/' }).then(() => openWorld(w.id)))}
                >
                  <GlobeIcon />
                  Open {w.name || `Untitled ${info.container}`}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Commands">
          {SECTIONS.filter((s) => s !== section).map((s) => {
            const Icon = SECTION_ICON[s];
            return (
              <CommandItem
                key={s}
                value={`switch section ${SECTION_INFO[s].label}`}
                onSelect={go(() => void navigate({ to: '/' }).then(() => openSection(s)))}
              >
                <Icon /> Switch To {SECTION_INFO[s].label}
              </CommandItem>
            );
          })}
          {!play && (
            <CommandItem value={`new ${info.container}`} onSelect={go(() => useUi.getState().openWorldDialog({ kind: 'create' }))}>
              <PlusIcon /> New {info.container}
            </CommandItem>
          )}
          {(section === 'tabletop' || play) && (
            <CommandItem value="dice roll" onSelect={go(() => useUi.getState().setDice(true))}>
              <DicesIcon /> Roll Dice
              <CommandShortcut>Ctrl+D</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem value="focus mode" onSelect={go(() => useUi.getState().setFocus(true))}>
            <MaximizeIcon /> Focus Mode
            <CommandShortcut>Ctrl+Shift+F</CommandShortcut>
          </CommandItem>
          <CommandItem value="toggle dark light theme" onSelect={go(() => prefs.setPreference('theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark'))}>
            <MoonIcon /> Switch Light / Dark
          </CommandItem>
          <CommandItem value="settings preferences" onSelect={go(() => useUi.getState().setSettings(true))}>
            <SettingsIcon /> Settings
            <CommandShortcut>Ctrl+,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
