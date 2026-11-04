/**
 * Making things from the Library: a Dyson Logos map in your Maps, a ready-made
 * fight in your Encounters, a Library NPC as one of your NPCs. Used by the
 * Library's own pages and by the New popup (components/dialogs/NewDialog).
 */
import { combatant, createEncounter, createMap, createMonster } from '@/lib/actions';
import type { Combatant, Encounter, Entry, GameMap, Monster } from '@/lib/model';
import type { Pick } from '@/lib/encounterMath';
import { bestiaryInput, sourceName, type DysonMap, type Library, type LibraryMonster } from './index';

/** Whose a new thing is: the campaign's (DM), or a character's own (player). */
export type Owner = { worldId: string | null; characterId: string | null };

/** Copies a Dyson Logos map beside the vault (the app's own, or downloaded) and makes it a map. Throws if it can't. */
export async function addLibraryMap(map: DysonMap, owner: Owner): Promise<GameMap> {
  const got = await window.api.files.importLibraryMap(map.file ? { bundled: map.file } : { url: map.image });
  if (!got) throw new Error('not saved');
  const scale = map.file ? 2000 / Math.max(1, map.width) : 3000 / Math.max(1, map.width);
  return createMap({ ...owner, name: map.title, image: got.file, width: Math.round(map.width * Math.min(1, scale)), height: Math.round(map.height * Math.min(1, scale)) });
}

/**
 * Makes a fight in the campaign's Encounters: each kind of creature comes from
 * the Bestiary if it's there already (by name), or is copied into it.
 */
export function addLibraryEncounter(worldId: string, library: Library, bestiary: Monster[], pictures: Map<string, string>, name: string, notes: string, picks: Pick[]): Encounter {
  const combatants: Combatant[] = [];
  const made = new Map<string, Monster>();
  for (const p of picks) {
    const m = library.monsters.find((x) => x.id === p.id);
    if (!m) continue;
    const monster = made.get(m.id) ?? bestiary.find((b) => !b.characterId && b.name.toLowerCase() === m.name.toLowerCase()) ?? createMonster(worldId, bestiaryInput(m, pictures.get(`monsters:${m.id}`)));
    made.set(m.id, monster);
    for (let i = 0; i < p.count; i++) {
      combatants.push(combatant({ kind: 'monster', refId: monster.id, name: `${monster.name}${p.count > 1 ? ` ${i + 1}` : ''}`, initiative: null, ac: monster.ac, hp: monster.hp, maxHp: monster.hp, conditions: [] }));
    }
  }
  return createEncounter(worldId, { name, notes, combatants });
}

/** A Library NPC as one of your NPCs (createEntry's input): who they are at a glance, and their stat block to read. */
export function npcEntryInput(m: LibraryMonster, image?: string): Partial<Entry> {
  const blocks = (title: string, list: { name: string; text: string }[]) => (list.length ? [title, ...list.map((b) => `${b.name}. ${b.text}`)].join('\n') : '');
  return {
    name: m.name,
    tagline: `${m.size} ${m.type.toLowerCase()}, ${m.alignment}`,
    image,
    specs: [
      { label: 'Armor Class', value: `${m.ac}${m.acNote ? ` (${m.acNote})` : ''}` },
      { label: 'Hit Points', value: `${m.hp}${m.hpDice ? ` (${m.hpDice})` : ''}` },
      { label: 'Challenge', value: m.cr },
      ...(m.languages ? [{ label: 'Languages', value: m.languages }] : []),
    ],
    about: [blocks('Traits', m.traits), blocks('Actions', m.actions), blocks('Reactions', m.reactions), `From the Library: ${sourceName(m.src)}.`].filter(Boolean).join('\n\n'),
  };
}
