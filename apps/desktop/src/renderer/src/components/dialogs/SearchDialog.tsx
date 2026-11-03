import { useNavigate } from '@tanstack/react-router';
import { BookOpenIcon, CircleUserIcon, GlobeIcon, MapPinIcon, MaximizeIcon, MoonIcon, PenLineIcon, PlusIcon, SettingsIcon, WaypointsIcon } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { openWorld } from '@/lib/actions';
import { useLive, useWorld, useWorldRecords } from '@/lib/hooks';
import { formatWords } from '@/lib/text';
import { KIND_INFO } from '@/screens/bible/BibleScreen';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';

const KIND_ICON = { character: CircleUserIcon, place: MapPinIcon, lore: BookOpenIcon };

/**
 * Search (Ctrl+K) — find any scene in the open world (title, prose and
 * note), any character, place or lore entry, any timeline event, or another
 * world; or run a command.
 */
export function SearchDialog() {
  const navigate = useNavigate();
  const open = useUi((s) => s.search);
  const world = useWorld();
  const worlds = useLive('worlds');
  const books = useWorldRecords('books');
  const scenes = useLive('scenes');
  const entries = useWorldRecords('entries');
  const events = useWorldRecords('events');
  const prefs = usePreferences();
  const bookIds = new Set(books.map((b) => b.id));
  const close = () => useUi.getState().setSearch(false);
  const go = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={(o) => useUi.getState().setSearch(o)} title="Search" description="Search scenes, characters, places, lore and events" className="sm:max-w-[640px]">
      <CommandInput placeholder="Search the world, or type a command…" />
      <CommandList className="max-h-[440px]">
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Scenes">
          {scenes
            .filter((s) => bookIds.has(s.bookId))
            .map((scene) => (
              <CommandItem key={scene.id} value={`scene ${scene.title} ${scene.note} ${scene.text.slice(0, 600)} ${scene.id}`} onSelect={go(() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } }))}>
                <PenLineIcon />
                <span className="truncate">{scene.title || 'Untitled Scene'}</span>
                <CommandShortcut>{formatWords(scene.words)}</CommandShortcut>
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandGroup heading="World Bible">
          {entries.map((entry) => {
            const Icon = KIND_ICON[entry.kind];
            return (
              <CommandItem key={entry.id} value={`${entry.kind} ${entry.name} ${entry.tagline} ${entry.group} ${entry.id}`} onSelect={go(() => void navigate({ to: '/bible/$kind/$entryId', params: { kind: entry.kind, entryId: entry.id } }))}>
                <Icon />
                <span className="truncate">{entry.name || 'Untitled'}</span>
                <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">{entry.tagline || KIND_INFO[entry.kind].singular}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Timeline">
          {events.map((event) => (
            <CommandItem key={event.id} value={`event ${event.title} ${event.summary} ${event.year} ${event.id}`} onSelect={go(() => void navigate({ to: '/timeline', search: { event: event.id } }))}>
              <WaypointsIcon />
              <span className="truncate">{event.title}</span>
              <CommandShortcut>{event.year}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        {worlds.length > 1 && (
          <CommandGroup heading="Worlds">
            {worlds
              .filter((w) => w.id !== world?.id)
              .map((w) => (
                <CommandItem
                  key={w.id}
                  value={`world ${w.name} ${w.id}`}
                  onSelect={go(() => {
                    openWorld(w.id);
                    void navigate({ to: '/' });
                  })}
                >
                  <GlobeIcon />
                  Open {w.name || 'Untitled World'}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Commands">
          <CommandItem value="new world" onSelect={go(() => useUi.getState().setNewWorld(true))}>
            <PlusIcon /> New World
          </CommandItem>
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
