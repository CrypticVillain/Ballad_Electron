import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { createEntry } from '@/lib/actions';
import { useRole, useSection, useWorld } from '@/lib/hooks';
import { kindInfo } from '@/lib/sections';
import { usePreferences, type SavedName } from '@/stores/preferences';
import { genreById, genreForWorld, type Genre, type NameKind } from './generator';

/**
 * The name generator's state, shared by the Names page and the small
 * suggest popovers: the genre (yours for this section, else what the open
 * world's genre suggests), keeping names, and turning one into an entry.
 */

/** The genre the open world's own genre suggests ("Low Fantasy" → Low Fantasy & Medieval), if any. */
export function useSuggestedGenre(): string | null {
  return genreForWorld(useWorld()?.genre);
}

/** The genre in use here, and how to change it. */
export function useNameGenre(): [Genre, (id: string) => void] {
  const section = useSection();
  const suggested = useSuggestedGenre();
  const chosen = usePreferences((s) => s.nameGenres[section]);
  const id = chosen ?? suggested ?? (section === 'tabletop' ? 'high-fantasy' : 'contemporary');
  const set = (next: string) => {
    const prefs = usePreferences.getState();
    prefs.setPreference('nameGenres', { ...prefs.nameGenres, [section]: next });
  };
  return [genreById(id), set];
}

export const isSaved = (saved: SavedName[], name: string) => saved.some((n) => n.name === name);

/** Keeps a name, or (kept already) lets it go. */
export function toggleSaved(name: string, genre: string, kind: NameKind) {
  const prefs = usePreferences.getState();
  const saved = prefs.savedNames;
  prefs.setPreference('savedNames', isSaved(saved, name) ? saved.filter((n) => n.name !== name) : [{ name, genre, kind }, ...saved].slice(0, 300));
}

export function copyName(name: string) {
  void navigator.clipboard.writeText(name).then(
    () => toast('Copied', { description: name }),
    () => toast.error('Couldn’t copy that'),
  );
}

/**
 * Turning a name into a character (an NPC in Tabletop) or a place, where you can
 * make them: a Writing world, or a campaign you run. Null where you can't.
 */
export function useMakeEntry(): ((name: string, kind: NameKind) => void) | null {
  const world = useWorld();
  const section = useSection();
  const role = useRole();
  const navigate = useNavigate();
  if (!world || (section !== 'writing' && section !== 'tabletop') || role === 'player') return null;
  return (name, kind) => {
    const entryKind = kind === 'place' ? 'place' : 'character';
    const entry = createEntry(world.id, entryKind, { name });
    toast(`${kindInfo(entryKind, section).singular} Made`, { description: name });
    void navigate({ to: '/bible/$kind/$entryId', params: { kind: entryKind, entryId: entry.id } });
  };
}

/** What making one is called here: "Make A Character", "Make An NPC", "Make A Place". */
export function makeLabel(kind: NameKind, section: string): string {
  if (kind === 'place') return 'Make A Place';
  return section === 'tabletop' ? 'Make An NPC' : 'Make A Character';
}
