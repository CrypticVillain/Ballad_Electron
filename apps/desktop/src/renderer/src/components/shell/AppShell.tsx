import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ConfirmHost } from '@/components/shared/Confirm';
import { useHistoryTracking } from '@/components/shared/HistoryArrows';
import { DiceOverlay } from '@/components/tabletop/DiceOverlay';
import { DockedDiceTray } from '@/components/tabletop/DiceTray';
import { Dialogs } from '@/components/shared/Dialogs';
import { ThemeSync } from '@/components/shared/ThemeSync';
import { Toaster } from '@/components/ui/sonner';
import { activeCharacter, activeWorld, createNote, createScene, scenesInOrder } from '@/lib/actions';
import { seesBook } from '@/lib/tabletop';
import { useSection, useWorld } from '@/lib/hooks';
import { byOrder, live } from '@/lib/model';
import { currentRole, currentSection, usePreferences } from '@/stores/preferences';
import { usePlayUi } from '@/play/scenes/ui';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';
import { modulesFor } from './modules';
import { Rail } from './Rail';
import { switchRole } from './RoleToggle';
import { StatusBar } from './StatusBar';

/**
 * AppShell — the frame around every screen: module rail on the left, the
 * screen (each brings its own sidebar), the status bar along the bottom, and
 * the app-wide shortcuts and dialogs, and (Tabletop) the dice tray when it's
 * pinned. Focus mode (the manuscript alone) hides the rail and the status bar.
 */
export function AppShell() {
  useShortcuts();
  const focus = useUi((s) => s.focus);
  const world = useWorld();
  // The dice tray, pinned: docked beside the screen (Tabletop and Play).
  const dice = useUi((s) => s.dice);
  const pinned = usePreferences((s) => s.dicePinned);
  const section = useSection();
  const docked = dice && pinned && !focus && (section === 'tabletop' || section === 'play');
  // Back and forward (the top bars' arrows, Alt+← / Alt+→).
  useHistoryTracking();
  // "The Glass Archipelago · Ballad" in the title bar and taskbar.
  useEffect(() => {
    document.title = world?.name ? `${world.name} · Ballad` : 'Ballad';
  }, [world?.name]);
  return (
    <div className="flex h-full flex-col bg-rail text-foreground">
      <ThemeSync />
      <div className="flex min-h-0 flex-1">
        {!focus && <Rail />}
        <div className="flex min-w-0 flex-1">
          <Outlet />
        </div>
        {docked && <DockedDiceTray />}
      </div>
      {!focus && <StatusBar />}
      <Dialogs />
      <DiceOverlay />
      <Toaster position="bottom-right" offset={40} />
      <ConfirmHost />
    </div>
  );
}

/**
 *   Ctrl+K search · Ctrl+N new scene (or session) · Ctrl+, settings · Shift+/ help (components/dialogs/HelpDialog lists them all)
 *   Alt+1…9 the open section's modules · Ctrl+D dice (Tabletop)
 *   Ctrl+Shift+F focus mode (Esc leaves it)
 */
function useShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const ui = useUi.getState();
      if (mod && key === 'k') {
        event.preventDefault();
        ui.setSearch(true);
      } else if (mod && key === 'n' && currentSection() === 'play') {
        // Play: a new scene, set up in Scenes.
        event.preventDefault();
        usePlayUi.getState().setCreating(true);
        if (!window.location.hash.startsWith('#/scenes')) void navigate({ to: '/scenes' });
      } else if (mod && key === 'n') {
        event.preventDefault();
        const sceneId = newSceneHere();
        if (sceneId) void navigate({ to: '/manuscript/$sceneId', params: { sceneId } });
      } else if (mod && key === ',') {
        event.preventDefault();
        ui.setSettings(true);
      } else if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !mod && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        ui.setHelp(!ui.help);
      } else if (mod && event.shiftKey && key === 'f') {
        event.preventDefault();
        ui.setFocus(!ui.focus);
      } else if (event.key === 'Escape' && ui.focus) {
        ui.setFocus(false);
      } else if (mod && event.shiftKey && key === 'd' && currentSection() === 'tabletop') {
        event.preventDefault();
        switchRole(currentRole() === 'player' ? 'gm' : 'player', navigate);
      } else if (mod && key === 'd' && (currentSection() === 'tabletop' || currentSection() === 'play')) {
        event.preventDefault();
        ui.setDice(!ui.dice);
      } else if (event.altKey && /^[1-9]$/.test(event.key)) {
        const module = modulesFor(currentSection(), currentRole(), Boolean(activeWorld()))[Number(event.key) - 1];
        if (module) {
          event.preventDefault();
          void navigate({ to: module.to });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

/** Whether a key went to something you type into (Shift+/ is a question mark there, not Help). */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/** Ctrl+N: a new scene at the end of the act you're in (or of the open world's first book). */
function newSceneHere(): string | null {
  const vault = useVault.getState().vault;
  const match = /^#\/manuscript\/([^/?]+)/.exec(window.location.hash);
  const current = match ? vault.scenes[match[1]!] : undefined;
  if (current && !current.deletedAt) return current.kind === 'note' ? createNote(current.bookId, { category: current.category }).id : createScene(current.bookId, current.partId).id;
  const world = activeWorld();
  const role = currentSection() === 'tabletop' ? currentRole() : null;
  // Player view: the journal of the character you're playing (campaign or not).
  const character = role === 'player' ? activeCharacter() : undefined;
  const book =
    role === 'player'
      ? live(vault.books).filter((b) => b.audience === 'player' && b.characterId === character?.id).sort(byOrder)[0]
      : world && live(vault.books).filter((b) => b.worldId === world.id && (!role || seesBook(b, role))).sort(byOrder)[0];
  if (!book) return null;
  const last = scenesInOrder(book.id).at(-1);
  const partId = last?.partId ?? live(vault.parts).filter((p) => p.bookId === book.id).sort(byOrder).at(-1)?.id;
  return partId ? createScene(book.id, partId).id : null;
}
