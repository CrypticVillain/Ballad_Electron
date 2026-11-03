import { useMemo } from 'react';
import { KeyHint, Led } from '@/components/shared/bits';
import { today } from '@/lib/dates';
import { useBooks, useLive, useRecord, useWorld } from '@/lib/hooks';
import { formatWords } from '@/lib/text';
import { usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';

/**
 * StatusBar — the thin bar along the bottom (Harmony's, for a writing app):
 *
 *   World · The Glass Archipelago ── the open world
 *   41,208 Words ────────────────── its books, all together
 *   Today +1,146 / 1,000 ────────── words written today, against the daily goal (lit once it's met)
 *   ● Saved · Local Vault ───────── the vault file's save state
 *   keyboard hints
 */
export function StatusBar() {
  const world = useWorld();
  const books = useBooks();
  const scenes = useLive('scenes');
  const day = useRecord('days', today());
  const goal = usePreferences((s) => s.dailyGoal);
  const saveState = useVault((s) => s.saveState);

  const words = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId)).reduce((sum, s) => sum + s.words, 0);
  }, [books, scenes]);
  const written = day?.words ?? 0;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-rail-border/60 bg-rail px-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
      <span className="truncate">World · {world?.name ?? 'None'}</span>
      <span className="tabular-nums">{formatWords(words)} Words</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        {goal > 0 && <Led tone={written >= goal ? 'accent' : 'off'} />}
        Today +{formatWords(written)}
        {goal > 0 && ` / ${formatWords(goal)}`}
      </span>
      <span role="status" className="flex items-center gap-1.5">
        <Led tone={saveState === 'error' ? 'accent' : saveState === 'saving' ? 'muted' : 'online'} />
        {saveState === 'error' ? 'Save Failed · Retrying On Next Change' : saveState === 'saving' ? 'Saving…' : 'Saved · Local Vault'}
      </span>
      <span className="ml-auto" />
      <span className="hidden items-center gap-4 lg:flex">
        <KeyHint keys={['Ctrl', 'K']} label="Search" />
        <KeyHint keys={['Ctrl', 'N']} label="New Scene" />
        <KeyHint keys={['@']} label="Character / Place" />
        <KeyHint keys={['#']} label="Lore" />
      </span>
    </footer>
  );
}
