import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Kbd, KeyHint, Led } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import { today } from '@/lib/dates';
import { scriptLength } from '@/lib/film';
import { useBooks, useCharacter, useLive, useRecord, useRole, useSection, useSectionInfo, useWorld, useWorldRecords } from '@/lib/hooks';
import { formatWords } from '@/lib/text';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';
import { switchRole } from './RoleToggle';

/**
 * StatusBar — the thin bar along the bottom (Harmony's, for a writing app):
 *
 *   World · The Glass Archipelago ── the open world (production)
 *   41,208 Words ────────────────── its books, all together (a script: pages and runtime)
 *   Today +1,146 / 1,000 ────────── words written today, against the daily goal (lit once it's met)
 *   ● Saved · Local Vault ───────── the vault file's save state
 *   keyboard hints
 *
 * Tabletop leads with the view and keeps the rest in its order:
 *
 *   ● Player View ─ ● Saved · Local Vault ─ Kael Thorn ─ The Sunken Lantern · 3 Journal Entries ─ Today +…
 *   (the GM's: ● GM View ─ ● Saved · Local Vault ─ The Sunken Lantern · 2 Sessions Played ─ Today +…)
 *
 * The word counts, and a campaign's entries or sessions, can each be hidden (Settings → Writing).
 */
export function StatusBar() {
  const world = useWorld();
  const playScenes = useWorldRecords('playScenes');
  const section = useSection();
  const info = useSectionInfo();
  const books = useBooks();
  const scenes = useLive('scenes');
  const day = useRecord('days', today());
  const goal = usePreferences((s) => s.dailyGoal);
  const showWords = usePreferences((s) => s.statusWords);
  const showEntries = usePreferences((s) => s.statusEntries);
  const showShortcuts = usePreferences((s) => s.statusShortcuts);
  const saveState = useVault((s) => s.saveState);
  const navigate = useNavigate();
  const player = useRole() === 'player';
  const character = useCharacter();

  const mine = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId));
  }, [books, scenes]);
  const words = mine.reduce((sum, s) => sum + s.words, 0);
  const written = day?.words ?? 0;
  const length = scriptLength(words);

  const vault = (
    <span role="status" className="flex items-center gap-1.5">
      <Led tone={saveState === 'error' ? 'accent' : saveState === 'saving' ? 'muted' : 'online'} />
      {saveState === 'error' ? 'Save Failed · Retrying On Next Change' : saveState === 'saving' ? 'Saving…' : 'Saved · Local Vault'}
    </span>
  );
  const todayWords = showWords && (
    <span className="flex items-center gap-1.5 tabular-nums">
      {goal > 0 && <Led tone={written >= goal ? 'accent' : 'off'} />}
      Today +{formatWords(written)}
      {goal > 0 && ` / ${formatWords(goal)}`}
    </span>
  );
  const count = player ? `${mine.length} Journal ${mine.length === 1 ? 'Entry' : 'Entries'}` : `${mine.filter((s) => s.status === 'done').length} Sessions Played`;

  return (
    <footer className="rail-ink flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-rail-border/60 bg-rail px-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
      {section === 'tabletop' ? (
        <>
          <button
            type="button"
            title={`Switch to ${player ? 'GM' : 'Player'} View (Ctrl+Shift+D)`}
            onClick={() => switchRole(player ? 'gm' : 'player', navigate)}
            className="-mx-1 flex shrink-0 items-center gap-1.5 rounded px-1 uppercase transition-colors hover:bg-rail-item hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Led tone={player ? 'online' : 'accent'} />
            {player ? 'Player View' : 'GM View'}
          </button>
          {vault}
          {player && <span className="truncate">{character ? character.name || 'Unnamed Character' : 'No Character'}</span>}
          <span className="truncate">
            {world ? world.name || 'Untitled Campaign' : 'No Campaign'}
            {showEntries && (player || world) && ` · ${count}`}
          </span>
          {todayWords}
        </>
      ) : section === 'play' ? (
        <>
          <span className="flex shrink-0 items-center gap-1.5 uppercase">
            <Led tone="accent" />
            Play
          </span>
          {vault}
          <span className="truncate">
            {world ? world.name || 'Untitled Campaign' : 'No Campaign'}
            {world && ` · ${playScenes.length === 1 ? '1 Scene' : `${playScenes.length} Scenes`}`}
          </span>
        </>
      ) : (
        <>
          <span className="truncate">{`${info.container} · ${world?.name ?? 'None'}`}</span>
          {section === 'film' ? (
            <span className="tabular-nums">
              {length.pages.toFixed(1)} Pages · ≈ {Math.round(length.screenMinutes)} Min On Screen
            </span>
          ) : (
            showWords && <span className="tabular-nums">{formatWords(words)} Words</span>
          )}
          {todayWords}
          {vault}
        </>
      )}
      <span className="ml-auto" />
      {showShortcuts && (
        <span className="hidden items-center gap-4 lg:flex">
          <KeyHint keys={['Ctrl', 'K']} label="Search" />
          <KeyHint keys={['Ctrl', 'N']} label={section === 'play' ? 'New Scene' : `New ${info.scene}`} />
          {(section === 'tabletop' || section === 'play') && <KeyHint keys={['Ctrl', 'D']} label="Dice" />}
          {section !== 'play' && <KeyHint keys={['@']} label={section === 'film' ? 'Cast / Location' : section === 'tabletop' ? 'NPC / Place' : 'Character / Place'} />}
          {section !== 'film' && section !== 'play' && <KeyHint keys={['#']} label="Lore" />}
        </span>
      )}
      {/* Always here, furthest right (its keys go with the other hints). */}
      <Hint label="Every shortcut (Shift+/)" side="top">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => useUi.getState().setHelp(true)}
          className="-mr-1 h-auto shrink-0 gap-1.5 rounded px-1 py-0 font-mono text-[11px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
        >
          {showShortcuts && (
            <span className="flex items-center gap-0.5">
              <Kbd>Shift</Kbd>
              <Kbd>/</Kbd>
            </span>
          )}
          Help
        </Button>
      </Hint>
    </footer>
  );
}
