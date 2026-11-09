import { MailIcon, MailXIcon, SendIcon, UserMinusIcon, UsersIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLive, useRecord } from '@/lib/hooks';
import type { PlayerCharacter, World } from '@/lib/model';
import { accountName, useAccounts } from '@/stores/accounts';
import { cancelInvite, dismissDeclined, invitePlayer, makeTestPlayers, removePlayer, setSheetOwner } from './actions';

/**
 * A campaign's players (Edit Campaign, and Players on Play's Home): who's in
 * it and the characters they brought, who's invited and hasn't answered, and
 * inviting someone by their email (online, an email goes out; on this
 * computer, the account with that email finds it on Play's Home). The
 * accounts on this computer are there to invite in a click. Make Test
 * Players makes a local account for each player named on the GM's own
 * party sheets, each given their sheet.
 */
export function PlayersField({ worldId }: { worldId: string }) {
  const world = useRecord('worlds', worldId);
  const { accounts, activeId } = useAccounts();
  const pcs = useLive('pcs');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  if (!world) return null;
  const members = (world.tabletop?.members ?? []).map((m) => m.accountId);
  const invited = world.tabletop?.invites ?? [];
  const declined = world.tabletop?.declined ?? [];
  const characters = (id: string) => pcs.filter((p) => p.worldId === world.id && p.ownerAccountId === id).map((p) => p.name || 'Unnamed');
  const here = accounts.filter((a) => a.id !== activeId && a.email && !members.includes(a.id) && !invited.some((i) => i.email === a.email.toLowerCase()) && !declined.some((i) => i.email === a.email.toLowerCase()));
  const invite = (to: string) => {
    if (!invitePlayer(world, to)) return void toast.error('That isn’t an email');
    setEmail('');
    toast('Invite Sent', { description: `${to} can join from Play’s Home, bringing a character of theirs.` });
  };
  const make = async () => {
    setBusy(true);
    try {
      const n = await makeTestPlayers(world);
      toast(n ? 'Test Players Ready' : 'No Players Named', { description: n ? `${n} ${n === 1 ? 'account' : 'accounts'}, each with their sheet as their own character. Switch accounts (your avatar) to play as one.` : 'Put a player’s name on each party sheet (Played By) first.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border px-4 py-3">
      <span className="label flex items-center gap-1.5">
        <UsersIcon className="size-3.5" /> Players · {members.length}
      </span>
      {members.length ? (
        <ul aria-label="Players" className="flex flex-col gap-1">
          {members.map((id) => {
            const a = accounts.find((x) => x.id === id);
            const own = characters(id);
            return (
              <li key={id} className="group flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">
                  {a ? accountName(a) : 'An account not on this computer'}
                  <span className="text-muted-foreground"> · {own.length ? `Plays ${own.join(' & ')}` : 'No character yet'}</span>
                </span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Take ${a ? accountName(a) : 'them'} out of the campaign`} title="Take Out Of The Campaign" onClick={() => removePlayer(world, id)}>
                  <UserMinusIcon />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">No one yet: invite your players.</p>
      )}
      {invited.length > 0 && (
        <ul aria-label="Invited" className="flex flex-col gap-1">
          {invited.map((i) => (
            <li key={i.email} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <MailIcon className="size-3.5" />
              <span className="min-w-0 flex-1 truncate">
                {i.email} <span className="text-[11.5px]">· invited</span>
              </span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Take back the invite to ${i.email}`} title="Take Back The Invite" onClick={() => cancelInvite(world, i.email)}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {declined.length > 0 && (
        <ul aria-label="Declined" className="flex flex-col gap-1">
          {declined.map((i) => (
            <li key={i.email} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <MailXIcon className="size-3.5 text-destructive" />
              <span className="min-w-0 flex-1 truncate">
                {i.email} <span className="text-[11.5px]">· declined {new Date(i.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={() => invite(i.email)}>
                Invite Again
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Clear ${i.email}’s declined invite`} title="Clear" onClick={() => dismissDeclined(world, i.email)}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          type="email"
          aria-label="Invite by email"
          placeholder="player@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            invite(email);
          }}
          className="h-8 text-[13px]"
        />
        <Button type="button" size="sm" disabled={!email.trim()} onClick={() => invite(email)}>
          <SendIcon /> Invite
        </Button>
      </div>
      {here.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">On this computer:</span>
          {here.map((a) => (
            <Button key={a.id} type="button" variant="outline" size="xs" onClick={() => invite(a.email)}>
              Invite {accountName(a)}
            </Button>
          ))}
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">An invited player joins from Play’s Home, bringing a character of their own: their sheet stays theirs, and the party has it too. In Play they move their own tokens.</p>
      <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" disabled={busy} onClick={() => void make()}>
        {busy ? 'Making…' : 'Make Test Players For The Party'}
      </Button>
    </div>
  );
}

/** Players (Play's Home, a campaign you run): the campaign's players and its invites, in a dialog. */
export function PlayersDialog({ world, onClose }: { world: World; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Players · {world.name || 'Untitled Campaign'}</DialogTitle>
          <DialogDescription>Invite your players; each joins with a character of their own.</DialogDescription>
        </DialogHeader>
        <PlayersField worldId={world.id} />
      </DialogContent>
    </Dialog>
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
