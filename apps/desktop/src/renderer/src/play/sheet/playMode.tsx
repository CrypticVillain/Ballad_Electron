import { ExternalLinkIcon, MessageSquareShareIcon, RadioIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { ToolbarButton } from '@/components/shared/Toolbar';
import { Button } from '@/components/ui/button';
import { updateRecord } from '@/lib/actions';
import type { PlayerCharacter } from '@/lib/model';
import { usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';
import { campaignName, useCampaigns } from '@/tabletop/members/campaigns';
import type { TablePlaying } from '../../../../shared/ipc';
import { cn } from '@/lib/utils';
import type { Sent, SheetOptions } from './cards';
import type { RollMode } from './rolls';

/**
 * Play Mode — a character's sheet in Tabletop, played at the table. Turned
 * on (the sheet's top bar), and with Play's window open on the character's
 * campaign (beside it, say, or on another screen), what the sheet rolls or
 * uses goes to the table's chat as Play's own sheet sends it: a card, its
 * dice rolled, what it spends coming off the sheet (a slot, a use, a potion)
 * and initiative into the turn order. Normal / Adv / Dis on the sheet's
 * plate (or Shift and Alt) rolls with advantage or disadvantage. Play not open there, the sheet rolls here,
 * in the dice tray, as it always does.
 */

/** The sheet's Play Mode, on and live: `send` puts a card on the table. Null: rolls stay here. */
export type PlayMode = { who: string; send: (sent: Sent) => void };
export const PlayModeContext = createContext<PlayMode | null>(null);
export const usePlayMode = () => useContext(PlayModeContext);

// ── Normal, advantage, disadvantage ──

/** The sheet's Normal / Adv / Dis (on its plate, in Play Mode): for the next d20 roll, then back to Normal. */
export const useRollMode = create<{ mode: RollMode }>(() => ({ mode: 'normal' }));

/**
 * How a click rolls: Shift with advantage, Alt with disadvantage, else as
 * the sheet's Normal / Adv / Dis says (Play Mode on). A d20 roll (`d20`)
 * uses Adv or Dis up: the toggle's back on Normal after it, as on Play's sheet.
 */
export function rollOptions(event?: Pick<MouseEvent, 'shiftKey' | 'altKey'>, d20 = true): SheetOptions {
  const picked = usePreferences.getState().sheetPlayMode ? useRollMode.getState().mode : 'normal';
  const mode = event?.shiftKey ? 'advantage' : event?.altKey ? 'disadvantage' : picked;
  if (d20 && picked !== 'normal') useRollMode.setState({ mode: 'normal' });
  return { mode, d20Extra: '', damageExtra: '' };
}

const MODES: { value: RollMode; label: string; hint: string }[] = [
  { value: 'normal', label: 'Normal', hint: 'Roll one d20' },
  { value: 'advantage', label: 'Adv', hint: 'Advantage: roll two d20s, keep the higher (the next roll)' },
  { value: 'disadvantage', label: 'Dis', hint: 'Disadvantage: roll two d20s, keep the lower (the next roll)' },
];

/** On the sheet's plate, in Play Mode: Normal / Adv / Dis for the next roll (Shift and Alt still work). */
export function RollModeToggle({ pc }: { pc: PlayerCharacter }) {
  const on = usePreferences((s) => s.sheetPlayMode) && Boolean(pc.worldId);
  const mode = useRollMode((s) => s.mode);
  if (!on) return null;
  return (
    <div role="radiogroup" aria-label="Roll with" className="flex items-center gap-0.5 rounded-full bg-background/15 p-[3px]">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          title={m.hint}
          onClick={() => useRollMode.setState({ mode: m.value })}
          className={cn('rounded-full px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] uppercase transition-colors', mode === m.value ? 'bg-background text-foreground' : 'opacity-75 hover:opacity-100')}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── Which campaign Play shows ──

const usePlayingStore = create<{ playing: TablePlaying }>(() => ({ playing: null }));
let listening = false;

/** The campaign Play's window shows (null: it isn't open), kept current. */
export function usePlaying(): TablePlaying {
  useEffect(() => {
    if (listening || !window.api.table?.playing) return;
    listening = true;
    void window.api.table.playing().then((playing) => usePlayingStore.setState({ playing }));
    window.api.table.onPlaying((playing) => usePlayingStore.setState({ playing }));
  }, []);
  return usePlayingStore((s) => s.playing);
}

/** Opens Play on a character's campaign (yours, or the one you've joined). */
export async function openPlayFor(worldId: string) {
  const campaign = (await window.api.table.campaigns()).find((c) => c.worldId === worldId);
  if (campaign) await window.api.table.open(campaign.ownerId, worldId);
  else toast.error('That campaign isn’t one you can play', { description: 'Its GM may have taken you out of it.' });
}

/** A card from the sheet, on to the table in Play's window; what it spends comes off the sheet once it's there. */
async function sendToTable(pcId: string, sent: Sent) {
  const pc = useVault.getState().vault.pcs[pcId];
  if (!pc?.worldId) return;
  const there = await window.api.table.act({ worldId: pc.worldId, pcId, card: sent.card });
  if (!there) {
    const worldId = pc.worldId;
    return void toast.error('Play isn’t open on their campaign', { description: 'Open Play to roll at the table, or turn Play Mode off to roll here.', action: { label: 'Open Play', onClick: () => void openPlayFor(worldId) } });
  }
  if (sent.changes) updateRecord('pcs', pcId, sent.changes);
  const totals = sent.card.rolls.map((r) => r.total).join(' · ');
  toast(`At The Table: ${sent.card.title}${totals ? ` · ${totals}` : ''}`, { description: 'In Play’s chat.', duration: 2500 });
}

/** The sheet's Play Mode for a character: live (the context's value) when it's on and Play shows their campaign. */
export function usePlayModeFor(pc: PlayerCharacter): { on: boolean; live: boolean; value: PlayMode | null } {
  const on = usePreferences((s) => s.sheetPlayMode) && Boolean(pc.worldId);
  const playing = usePlaying();
  const live = on && playing?.worldId === pc.worldId;
  const who = pc.name || 'Character';
  const value = useMemo<PlayMode | null>(() => (live ? { who, send: (sent) => void sendToTable(pc.id, sent) } : null), [live, who, pc.id]);
  return { on, live, value };
}

/** The top bar's Play Mode toggle (a character in a campaign: there's a table to play at). */
export function PlayModeButton({ pc }: { pc: PlayerCharacter }) {
  const on = usePreferences((s) => s.sheetPlayMode);
  const can = Boolean(pc.worldId);
  return (
    <ToolbarButton
      icon={RadioIcon}
      label="Play Mode"
      hint={!can ? 'Play Mode: put them in a campaign first, to play at its table.' : on ? 'Play Mode: on. Rolls go to the table in Play (while it’s open on their campaign). Click to roll here.' : 'Play Mode: off. Click to send this sheet’s rolls, spells and items to the table in Play.'}
      pressed={on && can}
      onClick={() => (can ? usePreferences.getState().setPreference('sheetPlayMode', !on) : toast('Not In A Campaign', { description: 'Pick their campaign (the chip in the top bar) to play at its table.' }))}
    />
  );
}

/** Under the top bar, in Play Mode: where the rolls go, and Open Play when it isn't showing their campaign. */
export function PlayModeBar({ pc }: { pc: PlayerCharacter }) {
  const { on, live } = usePlayModeFor(pc);
  const campaigns = useCampaigns();
  if (!on || !pc.worldId) return null;
  const name = campaignName(campaigns, pc.worldId) || 'their campaign';
  const worldId = pc.worldId;
  return (
    <div role="status" aria-label="Play Mode" className="flex items-center gap-2.5 border-b bg-primary/8 px-5 py-1.5 text-[12.5px]">
      <RadioIcon className={live ? 'size-3.5 text-primary' : 'size-3.5 text-muted-foreground'} />
      {live ? (
        <span>
          <b>Play Mode</b> · rolls, spells and items go to <b>{name}</b>’s table in Play. Shift: advantage · Alt: disadvantage.
        </span>
      ) : (
        <>
          <span className="text-muted-foreground">
            <b className="text-foreground">Play Mode</b> · Play isn’t open on {name}: rolls stay here until it is.
          </span>
          <Button size="xs" variant="outline" onClick={() => void openPlayFor(worldId)}>
            <ExternalLinkIcon /> Open Play
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * The Library, in Play Mode with Play open: Send To The Table puts an entry
 * (a spell, an item, a creature, a rule…) in the table's chat, as a card of
 * its words. Shown only then.
 */
export function LibraryToTable({ make }: { make: () => Sent }) {
  const on = usePreferences((s) => s.sheetPlayMode);
  const playing = usePlaying();
  if (!on || !playing) return null;
  const send = async () => {
    const sent = make();
    if (!(await window.api.table.act({ worldId: playing.worldId, pcId: '', card: sent.card }))) return void toast.error('Play isn’t open', { description: 'Open Play to send it to the table.' });
    toast(`At The Table: ${sent.card.title}`, { description: 'In Play’s chat.', duration: 2500 });
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-[12.5px]">
      <RadioIcon className="size-3.5 text-primary" />
      <span className="flex-1 text-muted-foreground">Play Mode · Play is open</span>
      <Button size="sm" variant="outline" onClick={() => void send()}>
        <MessageSquareShareIcon /> Send To The Table
      </Button>
    </div>
  );
}
