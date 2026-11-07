import { SearchIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Kbd, Label, PillTabs } from '@/components/shared/bits';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUi } from '@/stores/ui';

/**
 * Help (Shift+/, Help in the status bar, or Keyboard Shortcuts in the account
 * menu): a cheat sheet of every keyboard shortcut and gesture in Ballad, one
 * tab per part of the app, then All; the box at the top searches All.
 *
 * Keep it in step when adding a shortcut (components/shell/AppShell.tsx and
 * HistoryArrows.tsx), an editor key (components/editor/ManuscriptEditor.tsx)
 * or a gesture.
 */

/** A row: keys (each string one keycap), or typed text / a gesture, and what it does. */
type Row = { keys?: string[]; type?: string; does: string };
/** `tab` is the section's short name on its tab. */
type Section = { title: string; tab: string; rows: Row[] };

const SECTIONS: Section[] = [
  {
    title: 'Everywhere',
    tab: 'Everywhere',
    rows: [
      { keys: ['Ctrl', 'K'], does: 'Search everything in the open world' },
      { keys: ['Ctrl', 'N'], does: 'New scene (a session in Tabletop, a journal entry for a player, a scene in Play)' },
      { keys: ['Ctrl', ','], does: 'Settings' },
      { keys: ['Ctrl', 'Shift', 'F'], does: 'Focus mode: just the page (Esc leaves it)' },
      { keys: ['Shift', '/'], does: 'This Help sheet' },
      { keys: ['Esc'], does: 'Close a dialog or popup' },
      { type: 'The Ballad mark', does: 'Switch section (Writing, Filmmaking, Tabletop, Play), world or character; Manage Spaces and Folders' },
      { type: 'The Ballad mark → Create A Sequel', does: 'Writing and Filmmaking: a new world or production that follows the open one, with what you pick' },
      { type: 'Your avatar (bottom of the rail)', does: 'Accounts, Appearance, Keyboard Shortcuts, Settings' },
    ],
  },
  {
    title: 'Go To',
    tab: 'Go To',
    rows: [
      { keys: ['Alt', '1'], does: 'The rail’s first module (Alt+2… the next ones, top to bottom)' },
      { keys: ['Alt', '←'], does: 'Back (or the mouse’s back button)' },
      { keys: ['Alt', '→'], does: 'Forward (or the mouse’s forward button)' },
      { keys: ['Ctrl', 'K'], does: 'Then type a name: jump to a scene, NPC, place, creature…' },
      { type: 'The breadcrumb', does: 'Where you are; the arrows to its left go back and forward' },
    ],
  },
  {
    title: 'Writing',
    tab: 'Writing',
    rows: [
      { keys: ['/'], does: 'Insert a block: headings, lists, quotes, checklists, Handwriting' },
      { type: '/ Handwriting', does: 'A sheet to write or draw on with a pen, a finger or the mouse (not counted as words, never exported)' },
      { type: 'Add Handwriting', does: 'A sheet under a research note, or an entry’s About' },
      { type: 'The pen on a portrait or photo', does: 'Mark it up, large; the picture never changes, and the marks can be hidden' },
      { keys: ['@'], does: 'Mention a character (an NPC in Tabletop) or place, or make a new one' },
      { keys: ['#'], does: 'Mention a lore entry, or make a new one' },
      { keys: ['Ctrl', 'B'], does: 'Bold' },
      { keys: ['Ctrl', 'I'], does: 'Italic' },
      { keys: ['Ctrl', 'U'], does: 'Underline' },
      { keys: ['Ctrl', 'Z'], does: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], does: 'Redo' },
      { keys: ['Tab'], does: 'Nest a list item under the one above' },
      { keys: ['Shift', 'Tab'], does: 'Un-nest it' },
      { type: '#  ##  ###', does: 'Typed at the start of a line: a heading' },
      { type: '-  ·  1.  ·  [ ]', does: 'Typed at the start of a line: a list or checklist' },
      { type: 'Click a mention', does: 'Open that entry' },
      { type: 'Names (on the rail)', does: 'Names by genre: people, places, taverns and shops, groups; star to keep, or make one a character or place' },
      { keys: ['Space'], does: 'In Names: a dozen more' },
      { type: 'The wand beside a name', does: 'Suggest a name in your genre' },
      { type: 'Drag a scene in the binder', does: 'Reorder it, or move it to another act' },
    ],
  },
  {
    title: 'Screenplay (Filmmaking)',
    tab: 'Screenplay',
    rows: [
      { keys: ['Tab'], does: 'Next element: Scene Heading, Action, Character, Parenthetical, Dialogue, Transition' },
      { keys: ['Shift', 'Tab'], does: 'The element before' },
      { keys: ['Enter'], does: 'At an element’s end: start the element that usually follows' },
      { type: 'Enter on an empty element', does: 'Back to Action' },
      { keys: ['/'], does: 'Pick an element (or a block) by name' },
      { keys: ['@'], does: 'Mention cast or a location' },
      { type: 'Shots → Storyboard → Draw', does: 'A frame drawn with handwriting’s tools, on a blank frame or over a picture (which never changes)' },
    ],
  },
  {
    title: 'Tabletop',
    tab: 'Tabletop',
    rows: [
      { keys: ['Ctrl', 'D'], does: 'The dice tray' },
      { keys: ['Ctrl', 'Shift', 'D'], does: 'Switch GM / Player view (or the status bar, or the Ballad mark)' },
      { type: 'Click a bonus or a die', does: 'Roll it' },
      { type: 'Shift-click', does: 'Roll with advantage' },
      { type: 'Alt-click', does: 'Roll with disadvantage' },
      { type: 'Names · the wand beside a name', does: 'Names for NPCs, places, taverns and factions by genre (Elvish, Dwarvish, Norse…)' },
      { type: 'Lock icon on a sheet', does: 'Unlock every field to type into; locked, lists change through their popups' },
      { type: 'Hover an action or a condition', does: 'What it does' },
      { type: 'Share (GM) · right-click in a sidebar', does: 'Share with the players you pick; a space or folder at once' },
      { type: 'Update Shared (GM)', does: 'Send your edits since to the players who have it' },
      { type: 'Unlock To Edit (Player)', does: 'Keep a version of your own; Revert To GM’s switches back and forth' },
      { type: 'Orange dot (Player)', does: 'The GM updated it; opening it clears the dot' },
      { type: 'Encounters → Map', does: 'Prepare its battle map: the fight placed, the fog set; a Play scene made from it starts so' },
      { type: 'Encounters → Music · Library → Music', does: 'Your tracks, attached to a fight (its scene in Play gets them)' },
      { type: 'Edit Campaign → Players', does: 'The accounts in the campaign; Make Test Players makes one per party sheet' },
    ],
  },
  {
    title: 'Play',
    tab: 'Play',
    rows: [
      { type: 'The Ballad mark → Play', does: 'The Play module: set the scenes up ahead (Scenes); Play Home lists the campaigns' },
      { type: 'Open Play', does: 'The session, in its own window (one at a time): the table, its music, the dice; the GM’s Music and Library at the foot of the scenes' },
      { type: 'Show Scene (GM)', does: 'The players see the scene before it starts: no music yet (Hide Scene takes it back)' },
      { type: 'Start · Stop The Scene (GM)', does: 'What the table sees: players see the started scene, and its music starts' },
      { type: 'The eyes (GM)', does: 'Beside each scene and what’s in it (tokens, handouts, marks): lit, the players see it; dark, it’s hidden. Click, or right-click, to hide or show' },
      { type: 'Add Handout (GM)', does: 'A picture, a note, or a document from Lore under a scene, hidden until you show it; players open the shown ones' },
      { type: 'Lore → New Document (GM)', does: 'A document kept in Lore (a letter, a riddle), typed and handwritten, to bring into any scene' },
      { type: 'Handwrite (GM, a note)', does: 'Write on a note by hand, with the ink tools: part of the note, as the players see it (unlike marks)' },
      { keys: ['P'], does: 'Mark Up: draw on the scene or a handout; everyone sees the marks. Clear My Marks clears yours (the GM can clear anyone’s)' },
      { type: 'New Scene (GM)', does: 'From an encounter (its map, tokens, fog and music) or a map of its own' },
      { type: 'Music (GM, in Play’s window)', does: 'Tracks from the Library, scene by scene: each plays when the scene starts or by hand (▶)' },
      { type: 'Scratchpad (GM, in Play’s window)', does: 'Handwriting to jot on during the session, kept for next time' },
      { type: 'What’s picked (GM)', does: 'The dropdown atop the side panel: pick a token or the scene; it shows what’s picked' },
      { keys: ['Ctrl', 'D'], does: 'Dice, in Play’s window too: everyone at the table rolls' },
      { type: 'Mute · volume', does: 'For you alone: the table keeps playing' },
      { type: 'Controlled By (GM)', does: 'Who moves a token besides you; a party member’s goes to their sheet’s player' },
      { type: 'Players', does: 'Pan, zoom, turn, measure, and move only their own tokens; no hidden tokens, solid fog' },
      { keys: ['V'], does: 'Select: click a token to pick it, drag to move it (or the map)' },
      { keys: ['T'], does: 'Add Tokens: the party, the Bestiary and NPCs; drag one on, or click it' },
      { type: 'Shift-click · Shift + drag', does: 'Pick more tokens · pick with a box' },
      { type: 'Arrows', does: 'Nudge the picked tokens a square' },
      { keys: ['H'], does: 'Hide the picked tokens from the players (again: show them)' },
      { keys: ['Delete'], does: 'Take the picked tokens off the board (Undo brings them back)' },
      { keys: ['R'], does: 'Ruler: drag to measure, in squares and feet' },
      { keys: ['Space'], does: 'While measuring, drop a waypoint; otherwise hold and drag to pan with any tool' },
      { keys: ['G'], does: 'Line up the grid: drag a box over one square of the map' },
      { keys: ['F'], does: 'Fog of war: reveal or hide, with a box, a shape (click its corners; double-click closes it) or a brush (pick its width)' },
      { keys: ['Q'], does: 'Turn your view left (E: right)' },
      { type: 'Scroll', does: 'Zoom, around the pointer' },
      { keys: ['+'], does: 'Zoom in (− zooms out)' },
      { keys: ['0'], does: 'Fit the whole scene' },
      { keys: ['Esc'], does: 'Clear the ruler, back to Select' },
      { type: 'Middle-drag', does: 'Pan' },
    ],
  },
  {
    title: 'Maps',
    tab: 'Maps',
    rows: [
      { type: 'Drag the map', does: 'Pan' },
      { type: 'Scroll', does: 'Zoom toward the pointer' },
      { keys: ['+'], does: 'Zoom in' },
      { keys: ['-'], does: 'Zoom out' },
      { keys: ['0'], does: 'Fit the whole map' },
      { type: 'Add Pin, then click the map', does: 'Put a pin there' },
      { keys: ['Esc'], does: 'Stop adding a pin' },
      { type: 'Drag a pin', does: 'Move it (on a map you can change)' },
      { type: 'Mark Up', does: 'Draw on the map (your marks, kept apart: the map never changes); Hide Marks puts them away' },
    ],
  },
  {
    title: 'Sidebars, Spaces & Folders',
    tab: 'Sidebars',
    rows: [
      { type: 'Drag an item onto a space or folder', does: 'Move it there' },
      { type: 'Drag an item onto another', does: 'Put it just before that one' },
      { type: 'Drag a folder · a space', does: 'Into another space · above another space' },
      { type: 'Right-click an item', does: 'Move To, Into A New Folder (and Share, for the GM)' },
      { type: 'Right-click a space or folder', does: 'New Folder, Rename, New Space, Delete (and Share, for the GM)' },
      { type: 'Ballad mark · Manage Spaces / Folders', does: 'Every space or folder, list by list: rename, reorder, move, delete' },
    ],
  },
  {
    title: 'Library, Spells & Inventory',
    tab: 'Library',
    rows: [
      { keys: ['↑'], does: 'In a list: the one above' },
      { keys: ['↓'], does: 'In a list: the one below' },
      { keys: ['Enter'], does: 'Spells: learn it · Inventory: add one to your pack' },
      { type: 'Search box', does: 'Every word must appear; name matches come first' },
      { type: 'Click the picture', does: 'Add or change a picture (the × takes it off)' },
    ],
  },
];

function matches(row: Row, query: string): boolean {
  return `${row.keys?.join(' ') ?? ''} ${row.type ?? ''} ${row.does}`.toLowerCase().includes(query);
}

const ALL = 'All';
const TABS = [...SECTIONS.map((s) => ({ value: s.tab, label: s.tab })), { value: ALL, label: ALL, accent: true }];

export function HelpDialog() {
  const open = useUi((s) => s.help);
  const [tab, setTab] = useState(SECTIONS[0]!.tab);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      SECTIONS.filter((section) => tab === ALL || section.tab === tab)
        .map((section) => ({
          ...section,
          rows: !q || section.title.toLowerCase().includes(q) ? section.rows : section.rows.filter((row) => matches(row, q)),
        }))
        .filter((section) => section.rows.length),
    [q, tab],
  );
  const single = tab !== ALL ? sections[0] : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        useUi.getState().setHelp(o);
        if (!o) {
          setQuery('');
          setTab(SECTIONS[0]!.tab);
        }
      }}
    >
      <DialogContent className="flex h-[min(760px,calc(100vh-64px))] flex-col gap-0 overflow-hidden rounded-[22px] p-0 sm:max-w-[min(1040px,calc(100vw-48px))]">
        <header className="flex flex-wrap items-end gap-4 border-b px-7 pt-6 pb-4.5">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Cheat Sheet · <Kbd>Shift</Kbd>
              <Kbd>/</Kbd>
            </Label>
            <DialogTitle className="font-display text-[34px] leading-none font-black uppercase">Help</DialogTitle>
            <DialogDescription>Every keyboard shortcut and gesture in Ballad.</DialogDescription>
          </div>
          <label className="mr-8 flex h-9 w-[260px] items-center gap-2 rounded-full border bg-background px-3 text-muted-foreground focus-within:border-primary">
            <SearchIcon className="size-[15px]" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // Searching looks through everything: the All tab.
                if (e.target.value.trim()) setTab(ALL);
              }}
              placeholder="Filter, e.g. “dice” or “Ctrl”"
              aria-label="Filter shortcuts"
              className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </label>
        </header>
        <div className="shrink-0 overflow-x-auto px-7 pt-3 [scrollbar-width:none]">
          <div className="w-max">
            <PillTabs label="Sections" value={tab} options={TABS} onChange={setTab} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          {single ? (
            <section className="flex flex-col gap-1">
              <Label className="mb-1.5 text-link">{single.title}</Label>
              <div className="columns-1 gap-x-8 md:columns-2">
                {single.rows.map((row, index) => (
                  <div key={index} className="break-inside-avoid">
                    <HelpRow row={row} />
                  </div>
                ))}
              </div>
            </section>
          ) : sections.length ? (
            <div className="columns-1 gap-6 md:columns-2">
              {sections.map((section) => (
                <section key={section.title} className="mb-6 flex break-inside-avoid flex-col gap-1">
                  <Label className="mb-1.5 text-link">{section.title}</Label>
                  {section.rows.map((row, index) => (
                    <HelpRow key={index} row={row} />
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HelpRow({ row }: { row: Row }) {
  let what: ReactNode;
  if (row.keys) {
    what = (
      <span className="flex shrink-0 items-center gap-1">
        {row.keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="font-mono text-[10px] text-muted-foreground">+</span>}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </span>
    );
  } else {
    what = <code className="max-w-[58%] shrink-0 rounded-[5px] border bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground">{row.type}</code>;
  }
  return (
    <div className="flex items-baseline gap-2 py-1 text-[13px]">
      {what}
      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/40" />
      <span className="min-w-0 text-right text-muted-foreground">{row.does}</span>
    </div>
  );
}
