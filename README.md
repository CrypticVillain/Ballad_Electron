# Ballad

Write your stories and build the worlds they happen in, plan a video or a film like a business, run a Tabletop campaign, and play it at the table: four sections in one calm app, sharing one editor and one world bible. Ballad is the third app in the suite after [Harmony](https://github.com/CrypticVillain/Harmony_Electron) and [Overture](https://github.com/CrypticVillain/Overture_Electron), and shares their look: the same four styles (Display, the dot-matrix one, is the default), tokens, components and status bar. It replaces [Campfire](https://campfirewriting.com).

Everything is saved **on this computer** in a local vault. There is no server yet; accounts and sync will come the way they come to Overture.

Design mock-ups and icon studies: https://claude.ai/artifact/RgC8s6xeSbDscrKxtfUJML (the icon is concept 19, "Meter Ember": a B with a three-bar level meter for its ember).

## Sections

The Ballad mark at the top of the rail switches between them (a small badge on it shows which is open). Each account remembers its section, and the world it had open in each.

| Section | Its worlds are | Rail |
|---|---|---|
| **Writing** | Worlds | World Home · Manuscript · Characters · Places · Lore · Timeline |
| **Filmmaking** | Productions (a YouTube video or short, a short film, a feature, an ad…) | Production Home · Script · Shots · Schedule · Budget · Cast · Crew · Locations |
| **Play** | Tabletop's campaigns (the one open there) | Play Home · Scenes · Dice (and Play's own window, for the session: the table, Music, the Library) |
| **Tabletop** | Campaigns, your characters | GM: Campaign Home · Sessions · Encounters · Maps · Bestiary · Library · Party · NPCs · Places · Lore · Timeline · Player: Character · Inventory · Spells · Journal · Maps · Library (and, once your character is in a campaign, Party · NPCs · Places · Lore) · Dice in both |

They share one model (`lib/model.ts`; the words come from `lib/sections.ts`): a production's script and a campaign's session log are Books edited in the same manuscript editor, its cast and NPCs are the world bible's characters.

### Filmmaking

- **Production Home**: the faceplate (name, logline, format, genre), the **stage** pipeline (Idea → Pre-Production → Production → Post-Production → Released), the script's length against a target runtime (pages, read-aloud and on-screen minutes), the shoot (shots done, the next shoot day), the money (costs, income, net, estimated and actual), the **release** (publish date, title, description, tags) and a deliverables checklist.
- **Script**: the manuscript editor with **screenplay elements** (Scene Heading, Action, Character, Dialogue, Parenthetical, Transition) laid out as on the page in a mono face. Tab / Shift+Tab step through elements; Enter at the end of one starts the usual next (Character → Dialogue → Action). @ names cast, crew or a location. The scene panel shows the scene's length and its shots.
- **Shots**: each script scene's shot list: size, movement, lens, what we see, seconds, planned / shot / cut, with totals.
- **Schedule**: shoot days with date, call time, location, the scenes covered (and their pages and length), notes; the scenes not scheduled yet.
- **Budget**: costs and income by category, estimate and actual, the difference per line, totals and net, and costs by category.
- **Cast, Crew, Locations**: the world bible's sheets, with a production's spec rows (day rate, contact, permit…).

### Play

Play runs Tabletop's campaigns at the table, as an online table would, on this computer for now. The **Play module** (in the main window) is where the GM sets up: **Scenes** (the same board, tools and panels as the session, on your own). The session happens in **Play's own window** (Open Play, or a campaign on Play Home; one window at a time, opening another closes the first), with nothing of the rest of the app but the dice and, for the GM, **Music** (the Library's tracks, added and attached scene by scene) and the **Library**, at the foot of the Scenes sidebar, each in the board's place until a scene is picked: online, opening it is where the table connects. It takes the main window's theme and style. Play Home lists what you can play: the campaigns you run, and the ones you're a player in.

- **Online, simulated**: a campaign lives in its owner's vault; its **owner is the GM**, and the accounts it lists are its **players** (Edit Campaign → Players; **Make Test Players For The Party** makes a local account per party sheet). The main process stands in for the server (`main/table.ts`): Play loads the campaign from the owner and sends its changes back record by record. Switch accounts (your avatar) to sit at the table as a player.
- **The GM** runs it all: the scenes (new, arranged in spaces and folders, changed, deleted), **Start** (the scene the table sees; its music starts), the board with every tool, the music, and who controls each token.
- **Players** see the started scene, pan, zoom, turn (Q / E) and measure, move only the tokens assigned to them (a party member's goes to whoever owns their sheet, unless the GM sets it), and mute or turn down the music for themselves. Hidden tokens aren't there for them, and fog of war is solid.
- **Scenes**: from an **encounter** prepared in Tabletop (its map, tokens as placed, fog and music come along) or a map of its own: your picture (kept at full size), a campaign map, a Library map (Dyson Logos, credit kept), or a blank grid. Squares or hexes, lined up with the map's own (G); a ruler (R) with waypoints and the 5e diagonal rules.
- **Fog of war** (F): reveal or hide with a box, a shape or a **brush** (1, 2, 4 or 6 squares wide: paint it away or back on); Reveal All, Cover All. The GM sees through it, dimmed.
- **What's picked**: a dropdown at the top of the side panel lists the scene and every token; pick from it or on the board, and it shows what's picked (the scene's settings when nothing is).
- **Tokens**: the party, Bestiary creatures, NPCs and whole encounters from the Add Tokens tray (T), dragged on or clicked onto the nearest free square; snapped, dragged with the distance shown, nudged, picked with a box. HP bars, conditions, auras, hidden (H). A party member's HP and conditions are their sheet's.
- **Music**: tracks from the Library attached to a scene (or to an encounter, which passes them on), each set to play when the scene starts or by hand; in the session, ▶ plays one for the table.
- **Dice** (Ctrl+D, or Dice in the header): everyone at the table rolls in Play's window, with the same tray, styles, pinning and throw as the main window.

### Tabletop

The game's mechanics (ability modifiers, proficiency, the eighteen skills, conditions), its **spells and items**, and its **species, classes and their features level by level** come from the SRD 5.1 (see [Credits](#credits)); no official creatures ship with the app.

- **Game Master / Player**: two separate ways of using Tabletop, and the choice is yours (per account), not a campaign's: no campaign is needed to play. Switch with a second click on the Tabletop tile in the app menu (a strip of light along its foot: orange for GM, green for Player), in the account menu, by clicking the view in the status bar, on Campaign Home, or with Ctrl+Shift+D (a screen the other view doesn't have goes Home).
  - **GM** runs campaigns, everything open: Campaign Home shows the party's HP, AC, passive perception and conditions, the next session and its prep notes, the encounters, and counts of NPCs, places, lore, creatures, timeline events and what isn't shared yet; the rail has Sessions (the session log), Encounters, **Maps**, Bestiary, Party (every sheet on one page), the world bible and the Timeline.
  - **Player** plays **your characters**, like an online character-sheet app: make as many as you like, each in a campaign or in none (the sheet's Campaign chip puts them in one; the app menu lists them to switch). Home is the character's sheet: who they are, the six abilities, proficiency, speed and hit points across the top; initiative, AC, saves, senses and proficiencies down the left; the skills; and a tabbed panel (Actions, Spells, Inventory, Features & Traits, Notes). The rail jumps to the **Library** (every spell, item, creature and rule, the full Spells and Inventory pages below included), the character's **Journal** (kept with them, campaign or not, apart from the GM's log) and **Maps**; once they're in a campaign, its Party (the others' sheets, read-only), NPCs, Places and Lore, only what the GM has shared. No Encounters, Bestiary or Timeline.
- **Sessions** and the **Journal**: the manuscript editor as the GM's session log or a player's journal, arcs of numbered sessions (Planned → Prepped → Played; a journal's entries are Planned or Played). Beside each session, a panel of small tiles (name above value, nothing stretched across the column): its status as one switch, the day it was played (a date picker), its place and length; who and what came up (from @ mentions, or added from the panel); the GM's **encounters** for it (open one in the tracker, or start a new one); a checklist (the GM's **Secrets & Clues** to tick off as the party learns them, a player's **Leads & To-Dos**); and notes that grow as you write.
- **Notes**: both books also hold notes apart from the sessions (a Sessions / Notes switch at the top of the sidebar): a quest, a clue, a person, a place, loot, lore or a to-do, each with its own icon and checklist (a quest's Objectives, a person's To Ask Them). Filter them by words or category, pin the ones that matter to the top, right-click to recategorize or delete; in the text, / makes checklists and headings and @ names an NPC or place. Ctrl+N in a note starts another.
- **Library → Music** (GM): your own tracks, copied beside the vault, arranged in spaces and folders, played, credited, deleted; encounters and Play's scenes attach them.
- **Library** (GM and Player): every piece of open-licensed material the app carries. **3,541 monsters** (471 of them NPCs) from the SRD 5.1 and 5.2, Kobold Press's Tome of Beasts 1–3 and Creature Codex, the Black Flag SRD and Level Up's Monstrous Menagerie; **1,955 spells**, **2,604 items**, **91 feats**, **58 backgrounds**, **50 species**, **158 classes and subclasses**, **104 rules and conditions**; filter by book, challenge rating and type. Copy a creature to the Bestiary (GM), or add a feat, background, trait or class feature to your character's Features & Traits. **Maps**: Dyson Logos's 690 free commercial maps, 24 of them in the app and the rest downloaded from his site when you add one to your Maps. **Adventures & Settings** says what's open (Tal'Dorei's open content) and what isn't. **Sources & Licenses** lists every source: who made it, its license, what selling the app asks of it, and how much it overlaps the app's own data and the other books.
- **Spells** and **Inventory** (Player, opened from the Library or a sheet entry): full pages listing **every spell and item** in the SRD 5.1 and the Library (filter by book), plus your own homebrew. Search (every word must appear in the name or text, name matches first; ↑↓ to move, Enter to add), filter spells by level, school and class; items by category, type (Martial Melee, Heavy armor, Potion…), weapon properties and damage type, rarity, attunement, cost and weight, sorted by name, cost, weight or rarity; and read the whole entry: casting time, range, components, duration, classes and At Higher Levels; or cost, weight, damage and properties, AC. Add a spell to your character (and mark it prepared) or an item to their pack (and change how many, equip it, attune it) in one click; show just your character's (with anything on their sheet that isn't in the compendium, ready to write up). **Edit** any entry (Save or Cancel; an SRD one keeps your version, and Reset brings the SRD's text back), **hide** SRD entries you don't use (Hidden brings them back), and make or **delete** your own. The sheet's own Spells and Inventory tabs are unchanged.
- **The sheet is locked** while you play: its lists (attacks, spells, inventory, features) change through dialogs (Add opens on Find In The Library, with Custom beside it; each row's Edit opens the same form), and the rest is played rather than typed: hit points, coins, slots, uses, conditions, rolls. The **lock** in the top bar opens every field for typing in place. Removing anything from a sheet asks first.
- **Sharing** (Tabletop): players see only what the GM **shares** with them, NPCs, places, lore and maps, person by person. **Share** on a page (or right-click in the sidebar) opens a popup: tick who in the campaign gets it. Right-click a space or folder to **Share Space…** / **Share Folder…**: every item in it is shared on its own; the space and folder go along only if **Share the organizational structure** is ticked, and then only as where it starts out in each player's sidebar (they can rearrange theirs freely; nobody else's changes). Players get a copy as it was then: the GM's later edits reach them only with **Update Shared** (on the page, right-click, or the tracker), and the sidebar marks what's changed since. Shared things are read-only for players until they **Unlock To Edit**: that makes a version of their own, and the button becomes **Revert To GM's**, a toggle between the GM's original and their last saved version (the GM's copy is never changed). **Shared With Players…** in the app menu lists everything shared, filterable by person and kind, to update, change who has it, or stop sharing (with Undo). Campaigns from before sharing share what players could already see (everything not marked GM Only, and the campaign maps) with the whole party.
- **Spaces and folders** (NPCs, Places, Lore, Maps, and a Writing world's characters): each sidebar is arranged in **spaces** (to start, the old groups: Allies, Villains, Townsfolk; Campaign Maps; Your Maps) holding **folders**, and both hold items. Drag an item onto a space or folder, or onto another item to put it just before it; drag a folder into another space; drag a space above another. Right-click for Move To, New Folder, Rename and Delete (what's inside is kept: a folder's items stay in its space, a deleted space's folders and items go to the next one), and New Space sits at the bottom. An NPC's page shows where it's kept (Kept In) and can move it. A player arranges what's shared with them (and their own maps) for themselves, saved on their character: it isn't tied to the GM's arrangement. **Manage Spaces** and **Manage Folders** in the app menu (the Ballad mark) open the same arrangements as a dialog, one tab per list (NPCs, Places, Maps, Lore): make, rename, reorder (drag or the arrows), move a folder to another space, and delete.
- **Your characters**: delete or archive the one you're playing from the app menu or the sheet's character chip; **Manage Characters** groups them by campaign or by your own folders, moves them between campaigns and folders, and keeps the **archive** (out of every menu, kept whole, brought back any time).
- **Character creator** (Player: New Character, from the sheet's character chip or the app menu): a walkthrough from a name to a finished sheet. Name, campaign and starting level; **species** (the SRD's nine, their subraces and bonus picks, or your own); **class** (the twelve, with their saves, skill picks and features to the starting level, or your own); **background** (Acolyte, a dozen more by their two skills, or your own); **ability scores** by standard array, point buy (27 points), rolling 4d6 drop the lowest, or by hand, with the species' bonuses added and a suggestion for the class; **equipment** from the class's options; **spells** for a caster (as many cantrips and spells as the class gets); then a review. The sheet takes shape in a preview beside every step: hit points, Armor Class from the armor picked, attacks from the weapons, skills, features. **Skip, Fill In The Sheet** at any step makes the character from what's picked so far.
- **Level up** (the + by the level): hit points (roll the hit die or take the average, plus CON), the subclass when the class gets one, the level's new features with their text (untick any), an ability score improvement (+2, +1 and +1, or a feat) at 4, 8, 12, 16 and 19, the new spell slots and spells to learn; then a review, with Undo. Features that grow (Rage's uses, Sneak Attack's dice, Bardic Inspiration's die) are brought up to the new level. A class that isn't the SRD's gets the same steps to fill in by hand. **Just Change The Number** skips it all.
- **Features & Traits**: one card each, grouped by where it's from: what it does (folded until you open it), how it's used (action, bonus action, reaction), its **uses as boxes to tick** like spell slots (back on a short or long rest; Long Rest and Short Rest restore them) and its **roll** (Second Wind's 1d10 + level spends a use as it rolls). Filter by limited use, actions or passive; add, edit or remove any; More Notes keeps free text. The creator and leveling up fill them in, uses and dice included.
- **Actions In Combat**: every action, bonus action, reaction and free thing in a round (Attack, Dash, Dodge, Grapple, Two-Weapon Fighting, Opportunity Attack…) as small buttons; click one for what it does. The character's own active features (Second Wind, Bardic Inspiration) are among them, tinted, with their uses and roll in the same pop-up.
- **Party**: character sheets: species, class, background, level; AC, initiative, speed, proficiency, passive perception; hit points with damage / heal (temporary HP first) and death saves; the six abilities, saving throws and skills (none / proficient / expertise); attacks with to-hit and damage rolls; a casting ability (spell save DC and spell attack), spell slots (click to spend) and spells; **Long Rest** (HP, slots and death saves back, with Undo); **inventory** (equipped and backpack, quantity, weight, notes, attunement up to three, coins in five kinds and their worth in gold, weight carried against Strength × 15); proficiencies, conditions, features, notes; inspiration. **Click any bonus to roll it**: Shift for advantage, Alt for disadvantage.
- **Encounters**: **Fight** (below), **Map** (prepare its battle map on the shared board: the fight placed, the fog set) and **Music** (tracks from the Library). A scene made from it in Play starts from its map, tokens, fog and music. Fight: add the party and creatures, roll initiative (DEX and the sheet's bonus), start combat, step through turns and rounds, apply damage, healing and conditions. A character's HP is their sheet's, so damage in the tracker shows on the sheet.
- **Bestiary**: stat blocks you write (or copy from your own books): AC, HP and hit dice (roll them), speed, abilities, CR, traits, actions; add one to an encounter.
- **Maps**: add any image (a map you drew, a handout, a screenshot; it's copied beside your vault) and pin it: places, the party, dangers, notes, each with a note of its own. Drag to pan, scroll to zoom, drag pins to move them. A campaign's maps are the GM's and its players see them, but not the pins kept **GM Only**; a player can copy one to their own maps to pin their notes on it.
- **Dice** (Ctrl+D): any die and count, a modifier, advantage / disadvantage, or any expression (`2d6+1d4+3`, `4d6kh3`), with a history that sheets roll into too. Every roll is **thrown onto a see-through 3D table** over the window (three.js, physics by cannon-es): real polyhedral dice with weight and shadows tumble in from the left, knock into each other and the window's edges, and land however they land, numbers upside down and all; the faces are numbered so the one on top reads what was rolled (a d4 at its top corner, a d100 as a tens and a units d10). Advantage's dropped die goes pale and the total comes up beneath. **Dice styles**, picked from a dropdown in the tray or Settings → Dice (grouped by genre, so the list can grow): Ballad's own **Dot Matrix**, dark (the default: matte black, white numerals lit like a display) or light (bright white, black 5×7 dot numerals), both with a ring of orange dots set evenly corner to corner inside every edge, Classic Ivory, Obsidian & Gold, Dragon's Ruby, Frost Sapphire, Jade Marble, Arcane Nebula, Oak & Ember, Dwarven Steel, Grave Bone, Neon Grid, Phosphor Terminal and Mirror Chrome. Every die has rounded edges that catch the light. In Settings → Dice, where the throw can be turned off (reduced motion shows the dice where they landed). **Pin** the tray (the pin by its close button) and it docks at the window's right edge instead of popping out over the screen: it stays open while you click through sheets and screens, and next time you open the app; unpin to pop it out again.

## What works today

- **Worlds**: each world has its own books, world bible and timeline. The Ballad mark at the top of the rail is the **world menu**: the open world, every signed-in account's worlds to switch to (another account's world opens that account), and New / Edit / Delete World. **Create A Sequel** (there too, and for a Filmmaking production) makes a new world that follows the open one, with as much of it as you pick, section by section and thing by thing: the **Sequel** preset carries the world (characters, places, lore, the timeline, research, maps, the calendar) and starts a new book ("Book Two"); a production's sequel carries its cast, crew, locations, gear (unpacked) and budget (estimates only) and starts over with a new script. Links between what comes along are kept (a scene's point of view and mentions, relationships, map pins, arcs' beats, a shoot day's scenes and call sheet); a mention of something left behind becomes its name. World Home shows the world's faceplate (name, genre, its "now" and a summary, all editable in place), the scene to pick up, this week's words as dot columns (with your streak and goal days), the world bible's counts and the books; its sidebar switches worlds too.
- **Accounts**: several signed in at once (kept on this computer until real sign-in), each with its own vault and so its own worlds. The account menu (above Settings) has Account Settings, switching, Add Another Account (starting with the sample world or one empty world), Appearance, Settings and Sign Out. Each account remembers which of its worlds was open.
- **Manuscript**: books split into acts (or parts, books or chapters: the book card at the bottom of the binder picks the word), acts into scenes. The binder shows each scene's status light (done, drafting, planned) and word count; right-click an act or scene to rename, reorder, move, change status or delete it (with Undo). The scene editor (BlockNote) has a book serif for prose; type **@** to name a character or place and **#** for lore, or make a new one on the spot. The scene panel holds status, POV, place, when, the word goal as a dot meter, everyone and everything in the scene, and a note. **Focus mode** (Ctrl+Shift+F) leaves only the prose.
- **World bible**: characters, places and lore as spec sheets (Harmony's profile card): a faceplate with a code ("CHR-001") and initials, editable spec rows, notes, relationships (both ways), every scene it appears in (as POV, setting or mention) and its timeline events. Grouped in the sidebar (Main Cast, Supporting, Minor…), with pinning.
- **Timeline**: one lane per storyline, events laid out by year in the world's own calendar, stacked when they'd overlap, with an orange line at the world's "now". Pick an event to edit its year, storyline, summary and who or what it involves. Hide lanes, recolor or rename storylines (double-click).
- **Writing log**: words you add to any scene count toward today (cutting doesn't take them back); the status bar shows today against your daily goal.
- **Search** (Ctrl+K) across scenes (title, prose, note), the world bible, events and other worlds, plus commands.
- **Names** (Writing and Tabletop, last on the rail): a name generator by genre: Fantasy (High, Low & Medieval, Dark, Fey), Fantasy Peoples (Elvish, Dwarvish, Halfling, Orcish, Draconic, Infernal & Tiefling), Historical (Norse, Celtic, Greco-Roman, Victorian & Gothic, Wild West, Pirates), Modern (Contemporary, Noir & Crime), Science Fiction (Space Opera, Cyberpunk, Post-Apocalyptic) and Cosmic Horror. A dozen names at a time for people (any, feminine or masculine), places, taverns and shops, or groups; Space for more. Copy one, star it to keep it (Saved), or make it a character, NPC or place in one click. It starts on the genre the world's own genre suggests (a Writing world's "Low Fantasy" opens Low Fantasy & Medieval). The wand beside a character's, NPC's or place's name, and in the Tabletop character creator, suggests names in your genre.
- **Help** (Shift+/, Help at the far right of the status bar, or Keyboard Shortcuts in the account menu): a cheat sheet of every shortcut and gesture, by part of the app, with a filter. The status bar's shortcut reminders can be hidden in Settings → Appearance.
- **Settings** (Ctrl+,): style and light / dark / system, the **Clock** (12-hour or 24-hour, for sessions, the calendar, call times and time pickers; to start, the computer's own), the **App Icon** (dark, light, or matching the Windows taskbar / macOS), the manuscript font and daily goal, and Data: the vault's folder, Export Everything As JSON, Export Manuscript As Markdown, Remove Starter Content.
- **First run** seeds one sample in each section: The Glass Archipelago (Writing: a book in progress, its cast, places, lore and timeline), How Glass Is Made (Filmmaking: a YouTube documentary's script, shots, shoot days and budget) and The Sunken Lantern (Tabletop: three sessions, a party of four with Kael as your character and his journal, a map of the coast, three creatures and an encounter; plus Wren, a character of yours in no campaign), all removable from Settings → Data. A vault from before a section existed can open that section's sample from its empty Home.

Shortcuts: Ctrl+K search · Ctrl+N new scene (session) · Ctrl+Shift+F focus (Esc leaves) · Ctrl+, settings · Ctrl+D dice, Ctrl+Shift+D GM / Player (Tabletop) · Alt+1…9 the section's modules · @ and # in a scene · Tab in a script.

## Tech stack

The suite's stack, as in Overture:

| | |
|---|---|
| Desktop | Electron 44 · electron-vite · React 19 · TypeScript |
| Routing | TanStack Router (declared in code, hash history) |
| UI | shadcn/ui (Radix), copied from Overture · Tailwind CSS v4 · lucide icons · sonner toasts · fonts bundled via @fontsource (Doto, Inter Tight, Geist Mono, Literata for prose, …) |
| Editor | BlockNote (shadcn flavor: its menus are shadcn components on the suite's tokens) |
| State | zustand stores: `vault` (all data), `accounts`, `preferences`, `ui` |
| Storage | One local vault per account: a JSON file in its folder, written atomically with a backup |
| Tests | node:test: unit tests (`npm test`) and end-to-end tests that drive the built app with Playwright (`npm run test:e2e`) |

## Getting started

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

The first run may print "Downloading Electron binary…" once.

- `npm run dev:second -w @ballad/desktop` opens a second copy with its own vault (`--profile=second`).
- `npm run lint`
- **Testing, fastest first:**
  - `npm run typecheck` and `npm test` (unit tests): seconds. Run them after every change; the typecheck covers the end-to-end tests too.
  - `npm run test:e2e:changed`: builds, then runs only the end-to-end files that cover what you've changed since the last commit (`-- --list` just says which, and why; `-- --since origin/main` compares with another ref). A change to the vault, the model, the main process or the test launcher runs everything; docs and unit tests run nothing. The map from code to test files is AREAS in `scripts/e2e.mjs`.
  - `npm run test:e2e -- tabletop sharing`: the files whose names contain those words.
  - `npm run test:e2e`: every file, about 20 seconds after the build. Run it before committing.
  - End-to-end files run six at a time (`--workers <n>` or `BALLAD_E2E_WORKERS`; `--no-build` reuses the last build), each launching the built app under its own profile (`--profile=e2e-<pid>`: its own data folder and the first run's sample worlds, wiped before and after; your vault isn't touched; `BALLAD_E2E_PROFILE` changes the `e2e` part). The test windows open on your fourth monitor (`BALLAD_E2E_DISPLAY`: a number, 1 being the main one and then left to right, or part of a monitor's name like `ASUS`; `0` for where the app puts it). `t.saved()` waits until the app has nothing left to write (`window.__balladIdle`: the vault's debounce and the manuscript editor's typing pause), not for a fixed time.
- `npm run dist` builds the installer: apps/desktop/release/<version>/Ballad_Setup.exe (Windows; Ballad.dmg / Ballad.AppImage on macOS / Linux). The Windows installer is Overture's, in Ballad's words: the Display style, and a **theme** and **app icon** choice. Silent installs: `/S /THEME=system|light|dark /ICON=dark|light|system`. It isn't code-signed yet.
  - **Temporary:** the publisher name (`author` in apps/desktop/package.json) is a placeholder, "Ballad Labs". Change it before publishing.
  - **npm rebuild is off** (`npmRebuild: false` in electron-builder.yml): there are no native dependencies. Turn it back on if one is ever added.
  - `electronVersion` in electron-builder.yml must match node_modules/electron.
- `npm run icon -w apps/desktop` re-renders the app icons (from build/icon.svg and build/icon-light.svg) and the installer's artwork.

## Where things are

```
apps/desktop/
  build/icon.svg            the app icon ("Meter Ember"); icon-light.svg its light version, icons/ their .ico files
  build/installer.nsh       the installer's Welcome and Appearance pages
  e2e/                      end-to-end tests, a file per area (app.ts launches the built app; scripts/e2e.mjs runs them)
  src/main/                 Electron main: window, IPC, Play's table (table.ts: the stand-in for a server, and Play's window), accounts (accounts.ts), the open account's vault file (vault.ts), map images beside it and the ballad-media:// scheme (media.ts), Windows app ID (identity.ts), app icon (appIcon.ts)
  src/preload/              window.api: the typed bridge (contract: src/shared/ipc.ts)
  src/renderer/src/
    router.tsx              the screens and their URLs
    lib/model.ts            every record's shape (World, Book, Part, Scene, Entry, Relationship, Storyline, TimelineEvent, DayLog; Shot, ShootDay, BudgetLine; PlayerCharacter, Monster, Encounter)
    lib/sections.ts         the four sections and what each calls things (kinds, statuses, defaults); worldSection: Play opens Tabletop's campaigns
    lib/film.ts             script length, shot and budget totals (tests in tabletop.test.ts)
    lib/tabletop.ts         ability modifiers, proficiency, skills, saves, HP, long rest, spellcasting, inventory weight and coins, which books each view sees, the dice roller (tests beside it)
    lib/dice3d.ts           the dice as solids: corners, faces, which lands on top, the numbering (tests beside it)
    lib/actions.ts          creating and changing records
    lib/text.ts             a scene's text, word count and mentions (tests beside it)
    lib/export.ts           a world's books as Markdown
    lib/seed.ts             first-run starter content (The Glass Archipelago; seedSections.ts: the production and the campaign)
    lib/migrate.ts          brings an older vault up to date (tests beside it)
    stores/                 vault, accounts, preferences, ui
    components/editor/      the manuscript editor (BlockNote): @ / # mentions, screenplay elements
    components/tabletop/    the dice tray and its style dropdown, Die (a 3D picture), the 3D throw (dice3d/: looks, rounded meshes, the physics table; lib/dice3d.ts: the solids; lib/diceLooks.ts: the styles' names), click-to-roll
    components/dialogs/     search, settings, worlds (new / edit / delete), accounts (add / settings / sign out)
    components/shell/       rail (its modules per section and view) with the world and account menus, the GM / Player switch, sidebar parts, status bar
    screens/                home, manuscript (binder, scene panel), bible (entry sheet), timeline,
                            film (production home, shots, schedule, budget), tabletop (campaign home, the player's sheet, party sheets, encounters, bestiary, the spell and item compendium), maps
    sequel/                 Create A Sequel (Writing and Filmmaking): what's carried over (pure, with tests), the dialog
    play/                   Play (its own section): home/ (Play Home: the campaigns to play), setup/ (the module's Scenes page), window/ (Play's own window: the session, its music, the dice, the GM's Music and Library), scenes/ (scenes: the shared workspace, actions, panel, New Scene)
    tabletop/               Tabletop's modules in their own folders: battlemap/ (the shared board: grid, tokens, fog, geometry, with tests), encounters/ (an encounter's map and music), music/ (the Library's music), members/ (players, test accounts), copy/ (Copy Campaign)
    styles/globals.css      the suite's tokens (copied from Overture) + Ballad's additions
```

## Copy

- **American English** everywhere: in the app, the docs and code comments (color, favorite, center, gray, customize, behavior).
- **Title Case** for UI labels (buttons, menus, tabs, headings); sentences stay in sentence case.

## The local vault

`%APPDATA%\Ballad\vault\vault.json` on Windows (Settings → Data shows it). The renderer holds it in the `vault` store and saves it 400 ms after a change; closing the window flushes any pending save. Every record has `createdAt`, `updatedAt` and a soft `deletedAt`, so a sync server can merge by record later. Bump `VAULT_VERSION` and add a step to `migrate()` in `lib/migrate.ts` when a shape changes.

## Credits

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

The Library (`apps/desktop/src/renderer/src/lib/library`) was converted by `apps/desktop/scripts/library-convert.mjs` from [Open5e](https://github.com/open5e/open5e-api) (Modified MIT for its code; each book keeps its license: the SRD 5.2, Black Flag SRD, Level Up and Spells That Don't Suck under CC-BY-4.0, Kobold Press's and Green Ronin's books under the OGL 1.0a). The OGL 1.0a's full text and every book's Section 15 notice are in `lib/library/LICENSE.md`, and in the app under Library → Sources & Licenses. Cartography by Dyson Logos (`scripts/dyson-maps.mjs` reads his catalog; `src/renderer/public/library/maps` holds 24 of his maps), under his free commercial map license.

The spell, item, species and class data (`apps/desktop/src/renderer/src/lib/compendium/srd-*.json`) was converted by `apps/desktop/scripts/srd-convert.mjs` and `srd-classes.mjs` from [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (MIT; its license is kept in `lib/compendium/LICENSE.md`).

## Next

Campfire has more modules than this first pass. In rough order:

- [ ] **Filmmaking**: a storyboard (a frame per shot), call sheets to export, a script PDF in industry format, YouTube chapters from the script's sequences.
- [ ] **Tabletop**: a real-time shared table (the GM and players on their own computers), maps with fog of war, the spell and item compendium in GM view too, leveling help, XP and loot per encounter.

- [ ] **Maps**: upload a map image, drop pins linked to places, scenes and events.
- [ ] **Relationship web**: the relationships as a graph (Overture's Second Brain view, for characters).
- [ ] **Trash**: deleted scenes and entries (today: Undo on the toast only).
- [ ] **Drag to reorder** in the binder (today: right-click → Move Up / Down / To).
- [ ] **Corkboard / outline view** of a book: scene cards with their notes, by act.
- [ ] **More world-bible kinds**: species, cultures, religions, magic systems, items, languages (Campfire's modules), as entry kinds with their own spec rows.
- [ ] **Timeline eras** and a story-days timeline per book.
- [ ] **Export** to .docx and EPUB; import from Campfire, Scrivener and Markdown.
- [ ] **Shared worlds**: Overture's shared-folder workspaces (OneDrive, Dropbox), for co-writing, then real sign-in and sync.
- [ ] **Reordering** worlds and accounts by dragging, as in Overture's menus.
- [ ] Unit tests for the screens' logic.
