/**
 * seed.ts — first-run starter content, one in each section, so every screen
 * has something in it:
 *
 *   Writing      "The Glass Archipelago": a book in progress, its cast, places and lore, a timeline
 *   Filmmaking   "How Glass Is Made": a YouTube documentary's script, shots, shoot days and budget (seedSections.ts)
 *   D&D          "The Sunken Lantern": a campaign's sessions, party, creatures and an encounter (seedSections.ts)
 *
 * Everything here is marked `sample`; Settings → Data → Remove Starter
 * Content takes it all away. Writing opens first.
 */
import { addRelationship, createBook, createEntry, createEvent, createPart, createScene, createStoryline, logWords, openWorld } from '@/lib/actions';
import { addDays, today } from '@/lib/dates';
import { newId, now, type Entry, type SceneStatus } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { seedCampaign, seedProduction } from './seedSections';

/** One piece of a paragraph: text, or a mention of an entry. */
export type Piece = string | Entry;

/** A block (BlockNote's shape) of `type`, with mentions as inline content. */
export const block = (type: string, ...pieces: Piece[]) => ({
  id: newId(),
  type,
  props: {},
  content: pieces.map((piece) =>
    typeof piece === 'string' ? { type: 'text', text: piece, styles: {} } : { type: 'mention', props: { entryId: piece.id, name: piece.name, kind: piece.kind } },
  ),
  children: [],
});

/** A paragraph. */
export const p = (...pieces: Piece[]) => block('paragraph', ...pieces);

export function seedStarterContent() {
  const sample = { sample: true };
  const t = now();
  const world = {
    id: newId(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    section: 'writing' as const,
    name: 'The Glass Archipelago',
    genre: 'Low Fantasy',
    era: '402 A.F.',
    summary: 'A chain of islands lit by glass that never cools. Lamplighters keep the causeways, the glassworks keep the light, and nobody asks what the furnaces burn.',
    order: 0,
    ...sample,
  };
  useVault.getState().put('worlds', world);
  const w = world.id;

  // ── The cast, places and lore ──
  const character = (name: string, tagline: string, group: string, specs: [string, string][], about: string) =>
    createEntry(w, 'character', { name, tagline, group, specs: specs.map(([label, value]) => ({ label, value })), about, ...sample });
  const ines = character(
    'Ines Varga',
    'Lamplighter of the Causeway',
    'Main Cast',
    [['Age', '34'], ['Born', '368 A.F.'], ['Occupation', 'Lamplighter, Causeway North'], ['Allegiance', 'Tidewardens (lapsed)'], ['Wants', 'To learn why Tomas left'], ['Fears', 'Open water at night'], ['Voice', 'Short sentences. Counts things.']],
    'Ines left the Tidewardens the year the Magistrate took command, and nobody has asked her why. She keeps the forty-one lamps on the north causeway, keeps a ledger of the oil, and keeps the last letter her brother wrote unopened in the lamp house drawer.',
  );
  const tomas = character(
    'Tomas Varga',
    'Glassblower’s apprentice, missing',
    'Main Cast',
    [['Age', '29'], ['Born', '373 A.F.'], ['Occupation', 'Apprentice, Ossery Glassworks'], ['Last Seen', 'The 9th Tide, 401 A.F.']],
    'Apprenticed at the glassworks the year the Second Firing began. He wrote to Ines every month for eleven years, then crossed from Ossery on the night two furnaces failed and never reached the causeway.',
  );
  const corin = character(
    'Corin Hale',
    'Magistrate of the Tides',
    'Main Cast',
    [['Age', '51'], ['Occupation', 'Magistrate, commander of the Tidewardens'], ['Wants', 'The furnaces kept burning']],
    'He never raises his voice. He doesn’t need to; the Magistrate’s ferry carries his words from one island to the next.',
  );
  const sefa = character('Sefa Ondru', 'Glassblower at Ossery', 'Supporting', [['Occupation', 'Master glassblower'], ['Home', 'Port Ossery']], 'Ines’s oldest friend, and Tomas’s teacher. She knows more about the 9th Tide than she has said.');
  const wren = character('Old Wren', 'Ferryman of the strait', 'Supporting', [['Occupation', 'Ferryman'], ['Owes', 'Ines, a debt he won’t name']], 'Has rowed the strait for forty years and charges in stories, not coin.');
  character('Mother Ashe', 'Keeper of the tide tables', 'Supporting', [['Occupation', 'Tide-reader']], 'Reads the tides for the Tidewardens, and reads the Tidewardens for herself.');

  const place = (name: string, tagline: string, group: string, specs: [string, string][], about: string) =>
    createEntry(w, 'place', { name, tagline, group, specs: specs.map(([label, value]) => ({ label, value })), about, ...sample });
  const causeway = place('The Causeway', 'Forty-one lamps across the shallows', 'North Isles', [['Region', 'North Isles'], ['Length', 'Two miles at low tide']], 'A stone road that floods twice a day. The lamps are lit at dusk so the crossing can be made at night.');
  const ossery = place('Port Ossery', 'The glassworks city', 'The Strait', [['Region', 'The Strait'], ['Population', 'About 12,000'], ['Known For', 'The furnaces, Cold Glass']], 'The furnaces have burned without stopping since the Second Firing. At night the whole strait glows.');
  place('Saltmarrow', 'Where the ferries winter', 'South Isles', [['Region', 'South Isles']], 'A low island of salt pans and boatsheds.');

  const lore = (name: string, tagline: string, group: string, about: string) => createEntry(w, 'lore', { name, tagline, group, specs: [], about, ...sample });
  const firing = lore('The Second Firing', 'When the glassworks were relit, 390 A.F.', 'History', 'Eleven years ago the Magistrate relit every furnace in Ossery at once. They have not been allowed to cool since.');
  const coldGlass = lore('Cold Glass', 'Glass that holds light without heat', 'Materials', 'First made in 394 A.F. It glows for years once lit, and it is the reason the furnaces cannot stop.');
  lore('The Tidewardens', 'The order that keeps the crossings', 'Factions', 'Sworn to keep the causeways and the strait safe. Under Corin Hale, sworn to him.');
  lore('The Calendar of Tides', 'Thirteen tides to a year', 'Calendar', 'Years are counted After the First Firing (A.F.), and each year has thirteen tides.');

  for (const [from, to, label] of [
    [ines, tomas, 'Older sister · he’s missing since 401'],
    [ines, corin, 'Employee · doesn’t trust him'],
    [ines, sefa, 'Old friend'],
    [wren, ines, 'Owes her a debt'],
    [sefa, tomas, 'His teacher'],
  ] as const) {
    addRelationship(w, from.id, to.id, label, sample);
  }

  // ── Book 1 ──
  const book = createBook(w, { title: 'The Lamplighter’s Debt', partNoun: 'Act', targetWords: 90_000, ...sample });
  // Scenes look written over the last week, in order; the draft in progress was edited a few minutes ago (World Home picks it up).
  let age = 7 * 24 * 60;
  const scene = (partId: string, title: string, status: SceneStatus, when: string, blocks: ReturnType<typeof p>[], extra: { note?: string; povId?: string; placeId?: string; ago?: number } = {}) => {
    const { ago = (age -= 12 * 60), ...rest } = extra;
    const edited = new Date(Date.now() - Math.max(ago, 30) * 60_000).toISOString();
    return createScene(book.id, partId, { title, status, when, content: blocks, povId: ines.id, placeId: causeway.id, createdAt: edited, updatedAt: edited, ...rest, ...sample });
  };

  const act1 = createPart(book.id, { title: 'The Causeway', ...sample });
  scene(act1.id, 'The Lamp Count', 'done', '402 A.F. · 1st Tide', [
    p('There were forty-one lamps on the north causeway, and ', ines, ' lit them in the same order every night: east to west, against the wind, so the flame never blew back into her hands.'),
    p('She counted them as she went. Not because she might forget the number, but because the number was the one thing on the ', causeway, ' that had never changed.'),
    p('Her brother had laughed at her for it once. “You’d count the stars if they’d hold still,” ', tomas, ' said, the summer before he went across the water. She had told him the stars were not her job.'),
  ]);
  scene(act1.id, 'Oil And Ledger', 'done', '402 A.F. · 2nd Tide', [
    p('The ledger said eleven barrels. The storehouse held nine. Ines wrote the true number in the margin, small, the way her mother had taught her, and closed the book before she could think about what it meant.'),
    p('Somewhere across the strait the furnaces of ', ossery, ' were burning, and somebody was buying oil that should have been hers.'),
  ]);
  scene(act1.id, 'The Ferryman’s Price', 'done', '402 A.F. · 4th Tide', [
    p(wren, ' would not take her coin. He never had. “A story,” he said, holding the oar across his knees. “Something true, and something you haven’t told anyone.”'),
    p('She told him about the drawer in the lamp house, and the letter in it, and how long it had been there. He rowed her across without another word.'),
  ], { placeId: ossery.id });

  const act2 = createPart(book.id, { title: 'Ossery Glass', ...sample });
  scene(act2.id, 'Low Tide', 'done', '402 A.F. · 9th Tide', [
    p('The tide went out the way it always did, all at once, as if someone had pulled a plug at the bottom of the world.'),
    p('Ines walked the causeway at dusk with the oil can knocking against her hip, and for the first time in a year she did not count the lamps.'),
  ]);
  scene(act2.id, 'The Glassworks Gate', 'done', '402 A.F. · 9th Tide', [
    p('The gate of the glassworks was warm to the touch, even in the rain. ', sefa, ' met her there with her sleeves rolled to the elbow and burn scars to the wrist.'),
    p('“You shouldn’t have come,” Sefa said. “Not tonight.” Behind her, the furnaces of the ', firing, ' roared like a held breath.'),
  ], { placeId: ossery.id });
  scene(act2.id, 'The Lamplighter’s Debt', 'draft', '402 A.F. · 9th Tide', [
    p('By the time the tide went out, ', ines, ' had counted every lamp on the causeway twice. Forty-one, the same as the night her brother left. She did not trust the number.'),
    p('Across the strait, the glassworks of ', ossery, ' were still burning, as they had since the ', firing, ', and the light made the water look like something you could walk on. Ines had seen a man try, once. She had counted the seconds before the glass let go of him.'),
    p('“You’re late with the oil,” said a voice behind her. ', corin, ' never raised it. He didn’t need to; the Magistrate’s ferry carried his words for him, from one island to the next.'),
    p('She held out the ledger instead of an answer.'),
  ], { note: 'Ines must not find Tomas’s letter yet. Save it for Scene 5, on the ferry.', ago: 14 });
  scene(act2.id, 'Forty-One Lamps', 'outline', '402 A.F. · 10th Tide', [], { note: 'Ines relights the causeway alone and finds one lamp burning Cold Glass instead of oil.' });
  scene(act2.id, 'The Magistrate’s Ferry', 'idea', '402 A.F. · 10th Tide', [], { note: 'Hale offers Ines her place in the Tidewardens back. Old Wren is at the oar. The letter comes out.', placeId: ossery.id });

  const act3 = createPart(book.id, { title: 'The Second Firing', ...sample });
  scene(act3.id, 'What The Letter Said', 'idea', '', [], { note: 'Open with the letter itself, in Tomas’s voice.' });

  // ── The timeline ──
  const line = (name: string) => createStoryline(w, { name, ...sample });
  const lInes = line('Ines');
  const lTomas = line('Tomas');
  const lGlass = line('The Glassworks');
  const lTide = line('The Tidewardens');
  const event = (storylineId: string, year: number, title: string, summary: string, links: Entry[], when = '') =>
    createEvent(w, storylineId, { year, title, summary, when, links: links.map((e) => e.id), ...sample });
  event(lTide.id, 385, 'Charter renewed', 'The Tidewardens’ charter is renewed for another forty years.', []);
  event(lInes.id, 386, 'Joins the Tidewardens', 'Ines takes the oath at eighteen.', [ines]);
  event(lTomas.id, 390, 'Apprenticed at Ossery', 'Tomas goes across the water to learn glass under Sefa.', [tomas, sefa, ossery]);
  event(lGlass.id, 390, 'The Second Firing begins', 'Every furnace in Ossery is relit at once.', [ossery, firing]);
  event(lGlass.id, 394, 'First Cold Glass made', 'Glass that holds light without heat.', [coldGlass, ossery]);
  event(lTide.id, 397, 'Corin Hale takes command', 'The Magistrate takes the Tidewardens under his own command.', [corin]);
  event(lInes.id, 397, 'Leaves the order', 'Ines walks out of the Tidewardens the same tide Hale walks in.', [ines, corin]);
  event(lInes.id, 399, 'Takes the Causeway lamps', 'The north causeway gets a new lamplighter.', [ines, causeway]);
  event(lGlass.id, 401, 'Two furnaces fail', 'For one night, the strait goes dark.', [ossery], '9th Tide');
  event(lTomas.id, 401, 'Disappears', 'He crosses from Ossery on the night two furnaces fail and never reaches the causeway. Forty-one lamps were lit that night. Ines counted forty.', [tomas, ines, causeway], '9th Tide');
  event(lInes.id, 402, 'Book 1 begins', 'The Lamplighter’s Debt opens.', [ines], '1st Tide');

  // ── A week of writing, so the meter has a shape ──
  [820, 1410, 0, 1050, 1260, 2030].forEach((words, i) => {
    const day = addDays(today(), i - 6);
    if (words) logWords(words, day);
    const record = useVault.getState().vault.days[day];
    if (record) useVault.getState().patch('days', day, { sample: true });
  });

  seedProduction();
  seedCampaign();
  openWorld(w);
}
