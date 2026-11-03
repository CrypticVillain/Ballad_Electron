# Ballad

Write your stories and build the worlds they happen in: a manuscript editor and a world bible (characters, places, lore, a timeline) in one calm app. Ballad is the third app in the suite after [Harmony](https://github.com/CrypticVillain/Harmony_Electron) and [Overture](https://github.com/CrypticVillain/Overture_Electron), and shares their look: the same four styles (Display, the dot-matrix one, is the default), tokens, components and status bar. It replaces [Campfire](https://campfirewriting.com).

Everything is saved **on this computer** in a local vault. There is no server yet; accounts and sync will come the way they come to Overture.

Design mock-ups and icon studies: https://claude.ai/artifact/RgC8s6xeSbDscrKxtfUJML (the icon is concept 19, "Meter Ember": a B with a three-bar level meter for its ember).

## What works today

- **Worlds**: each world has its own books, world bible and timeline. World Home shows the world's faceplate (name, genre, its "now" and a summary, all editable in place), the scene to pick up, this week's words as dot columns (with your streak and goal days), the world bible's counts and the books. Switch worlds or make a new one from the sidebar.
- **Manuscript**: books split into acts (or parts, books or chapters: the book card at the bottom of the binder picks the word), acts into scenes. The binder shows each scene's status light (done, drafting, planned) and word count; right-click an act or scene to rename, reorder, move, change status or delete it (with Undo). The scene editor (BlockNote) has a book serif for prose; type **@** to name a character or place and **#** for lore, or make a new one on the spot. The scene panel holds status, POV, place, when, the word goal as a dot meter, everyone and everything in the scene, and a note. **Focus mode** (Ctrl+Shift+F) leaves only the prose.
- **World bible**: characters, places and lore as spec sheets (Harmony's profile card): a faceplate with a code ("CHR-001") and initials, editable spec rows, notes, relationships (both ways), every scene it appears in (as POV, setting or mention) and its timeline events. Grouped in the sidebar (Main Cast, Supporting, Minor…), with pinning.
- **Timeline**: one lane per storyline, events laid out by year in the world's own calendar, stacked when they'd overlap, with an orange line at the world's "now". Pick an event to edit its year, storyline, summary and who or what it involves. Hide lanes, recolor or rename storylines (double-click).
- **Writing log**: words you add to any scene count toward today (cutting doesn't take them back); the status bar shows today against your daily goal.
- **Search** (Ctrl+K) across scenes (title, prose, note), the world bible, events and other worlds, plus commands.
- **Settings** (Ctrl+,): style and light / dark / system, the **App Icon** (dark, light, or matching the Windows taskbar / macOS), the manuscript font and daily goal, and Data: the vault's folder, Export Everything As JSON, Export Manuscript As Markdown, Remove Starter Content.
- **First run** seeds a sample world, The Glass Archipelago (a book in progress, its cast, places, lore and timeline), all removable from Settings → Data.

Shortcuts: Ctrl+K search · Ctrl+N new scene · Ctrl+Shift+F focus (Esc leaves) · Ctrl+, settings · Alt+1…6 modules · @ and # in a scene.

## Tech stack

The suite's stack, as in Overture:

| | |
|---|---|
| Desktop | Electron 44 · electron-vite · React 19 · TypeScript |
| Routing | TanStack Router (declared in code, hash history) |
| UI | shadcn/ui (Radix), copied from Overture · Tailwind CSS v4 · lucide icons · sonner toasts · fonts bundled via @fontsource (Doto, Inter Tight, Geist Mono, Literata for prose, …) |
| Editor | BlockNote (shadcn flavor: its menus are shadcn components on the suite's tokens) |
| State | zustand stores: `vault` (all data), `preferences`, `ui` |
| Storage | One local vault: a JSON file, written atomically with a backup |
| Tests | node:test (`npm test`) |

## Getting started

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

The first run may print "Downloading Electron binary…" once.

- `npm run dev:second -w @ballad/desktop` opens a second copy with its own vault (`--profile=second`).
- `npm run typecheck`, `npm run lint`, `npm test`
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
  src/main/                 Electron main: window, IPC, the vault file (vault.ts), Windows app ID (identity.ts), app icon (appIcon.ts)
  src/preload/              window.api: the typed bridge (contract: src/shared/ipc.ts)
  src/renderer/src/
    router.tsx              the screens and their URLs
    lib/model.ts            every record's shape (World, Book, Part, Scene, Entry, Relationship, Storyline, TimelineEvent, DayLog)
    lib/actions.ts          creating and changing records
    lib/text.ts             a scene's text, word count and mentions (tests beside it)
    lib/export.ts           a world's books as Markdown
    lib/seed.ts             first-run starter content (The Glass Archipelago)
    lib/migrate.ts          brings an older vault up to date
    stores/                 vault, preferences, ui
    components/editor/      the manuscript editor (BlockNote) and its @ / # mentions
    components/dialogs/     search, settings, new world
    components/shell/       rail, sidebar parts, status bar
    screens/                home, manuscript (binder, scene panel), bible (entry sheet), timeline
    styles/globals.css      the suite's tokens (copied from Overture) + Ballad's additions
```

## Copy

- **American English** everywhere: in the app, the docs and code comments (color, favorite, center, gray, customize, behavior).
- **Title Case** for UI labels (buttons, menus, tabs, headings); sentences stay in sentence case.

## The local vault

`%APPDATA%\Ballad\vault\vault.json` on Windows (Settings → Data shows it). The renderer holds it in the `vault` store and saves it 400 ms after a change; closing the window flushes any pending save. Every record has `createdAt`, `updatedAt` and a soft `deletedAt`, so a sync server can merge by record later. Bump `VAULT_VERSION` and add a step to `migrate()` in `lib/migrate.ts` when a shape changes.

## Next

Campfire has more modules than this first pass. In rough order:

- [ ] **Maps**: upload a map image, drop pins linked to places, scenes and events.
- [ ] **Relationship web**: the relationships as a graph (Overture's Second Brain view, for characters).
- [ ] **Trash**: deleted scenes and entries (today: Undo on the toast only).
- [ ] **Drag to reorder** in the binder (today: right-click → Move Up / Down / To).
- [ ] **Corkboard / outline view** of a book: scene cards with their notes, by act.
- [ ] **More world-bible kinds**: species, cultures, religions, magic systems, items, languages (Campfire's modules), as entry kinds with their own spec rows.
- [ ] **Timeline eras** and a story-days timeline per book.
- [ ] **Export** to .docx and EPUB; import from Campfire, Scrivener and Markdown.
- [ ] **Workspaces and accounts**, as Overture now has, then sync.
- [ ] Unit tests for the screens' logic, and end-to-end tests (Overture's Playwright setup).
