import { UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useRecord } from '@/lib/hooks';
import type { PlayerCharacter, World } from '@/lib/model';
import { accountName, useAccounts } from '@/stores/accounts';
import { makeTestPlayers, setMembers, setSheetOwner } from './actions';

/**
 * Tabletop → Players: the campaign's players (Edit Campaign), from the
 * accounts on this computer (online: the ones that joined). Make Test
 * Players makes a local account for each player named on the party's sheets,
 * so you can switch accounts and see the table as each of them.
 */
export function PlayersField({ worldId }: { worldId: string }) {
  const world = useRecord('worlds', worldId);
  const { accounts, activeId } = useAccounts();
  const [busy, setBusy] = useState(false);
  if (!world) return null;
  const members = new Set((world.tabletop?.members ?? []).map((m) => m.accountId));
  const others = accounts.filter((a) => a.id !== activeId);
  const toggle = (id: string, on: boolean) => setMembers(world, on ? [...members, id] : [...members].filter((m) => m !== id));
  const make = async () => {
    setBusy(true);
    try {
      const n = await makeTestPlayers(world);
      toast(n ? 'Test Players Ready' : 'No Players Named', { description: n ? `${n} ${n === 1 ? 'account' : 'accounts'}, each with their sheet. Switch accounts (your avatar) to play as one.` : 'Put a player’s name on each party sheet (Played By) first.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border px-4 py-3">
      <span className="label flex items-center gap-1.5">
        <UsersIcon className="size-3.5" /> Players
      </span>
      {others.length ? (
        <ul className="flex flex-col gap-1">
          {others.map((a) => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <Checkbox checked={members.has(a.id)} onCheckedChange={(on) => toggle(a.id, on === true)} aria-label={`${accountName(a)} is in the campaign`} />
                {accountName(a)}
                {a.email && <span className="font-mono text-[10.5px] text-muted-foreground">{a.email}</span>}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">No other accounts on this computer yet.</p>
      )}
      <p className="text-[12px] text-muted-foreground">In Play, players see the scene you start and move the tokens that are theirs. Online they’ll join from their own computers; for now each is a local account.</p>
      <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => void make()}>
        {busy ? 'Making…' : 'Make Test Players For The Party'}
      </Button>
    </div>
  );
}

/** Which account plays a party sheet (the GM's party sheet): its tokens in Play are theirs to move. */
export function SheetOwnerSelect({ pc, world }: { pc: PlayerCharacter; world: World }) {
  const { accounts } = useAccounts();
  const members = (world.tabletop?.members ?? []).map((m) => m.accountId);
  const ids = [...new Set([...members, ...(pc.ownerAccountId ? [pc.ownerAccountId] : [])])];
  const options = [
    { value: '', label: 'Played by: no one (you)' },
    ...ids.map((id) => {
      const a = accounts.find((x) => x.id === id);
      return { value: id, label: `Played by: ${a ? accountName(a) : 'an account not here'}` };
    }),
  ];
  return <SelectField label="Account that plays them" variant="chip" align="end" value={pc.ownerAccountId ?? ''} options={options} onChange={(id) => setSheetOwner(pc.id, id || undefined)} />;
}
