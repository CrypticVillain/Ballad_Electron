import { useNavigate } from '@tanstack/react-router';
import { CastleIcon, CrownIcon, DicesIcon, ExternalLinkIcon, MailIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { SwordShieldIcon } from '@/components/shared/icons';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { openSection, setRole } from '@/lib/actions';
import { useLive } from '@/lib/hooks';
import type { PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { bringCharacter } from '@/tabletop/members/actions';
import { PlayersDialog } from '@/tabletop/members/Players';
import { campaignName, refreshCampaigns, useCampaigns, type Campaign } from '@/tabletop/members/campaigns';
import { setUpDemoGame } from '../demo';
import type { TableCampaign, TableInvite } from '../../../../shared/ipc';

/**
 * Play → Home (/ in Play): the campaigns you can play, to open Play for. Play
 * itself opens in a window of its own (play/window), one at a time, when you
 * pick a campaign here. Yours (you run them: you're their GM; Players invites
 * your players), and the ones another account runs that you've joined. A GM's
 * invites wait here for you to answer: join, bringing a character of your own
 * (your sheet stays yours; the party has it too), or decline. Set Up A Demo
 * Game makes a campaign ready to play (play/demo.ts), with test players.
 */
export function PlayHome() {
  const [campaigns, setCampaigns] = useState<TableCampaign[] | null>(null);
  const [invites, setInvites] = useState<TableInvite[]>([]);
  const [making, setMaking] = useState(false);
  const [players, setPlayers] = useState<string | null>(null);
  const worlds = useVault((s) => s.vault.worlds);
  const refresh = useCallback(() => {
    void window.api.table.campaigns().then(setCampaigns);
    void window.api.table.invites().then(setInvites);
    // The campaign chips on your characters' sheets list the ones you've joined.
    refreshCampaigns();
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  const demo = async () => {
    setMaking(true);
    try {
      await setUpDemoGame();
      refresh();
      toast('Demo Game Ready', {
        description: 'Your campaign, “Demo: The Goblin Road”, is under You Run: open Play from it. Riley, Morgan, Casey and Jamie made their characters and joined; Quinn has your invite to answer. Switch accounts (your avatar) to sit at the table as one of them.',
        duration: 14000,
      });
    } catch (e) {
      toast.error('The demo game couldn’t be set up', { description: String(e) });
    } finally {
      setMaking(false);
    }
  };
  const demoButton = (
    <Button variant="outline" disabled={making} onClick={() => void demo()}>
      <DicesIcon /> {making ? 'Setting Up…' : 'Set Up A Demo Game'}
    </Button>
  );
  const mine = campaigns?.filter((c) => c.owner) ?? [];
  const joined = campaigns?.filter((c) => !c.owner) ?? [];
  const open = (c: TableCampaign) => void window.api.table.open(c.ownerId, c.worldId);
  const playersOf = players ? worlds[players] : undefined;

  return (
    <>
      <Sidebar title="Play">
        <p className="px-1.5 text-[12.5px] text-muted-foreground">Pick a campaign to play: the session opens in its own window, one at a time (the table, its music, the dice). Set your scenes up in Scenes.</p>
        <button type="button" onClick={() => openSection('tabletop')} className="flex items-center gap-2 px-1.5 text-left text-[12.5px] text-muted-foreground hover:text-foreground">
          <CastleIcon className="size-3.5" /> Make and edit campaigns in Tabletop
        </button>
        <div className="mt-2 flex flex-col gap-1.5 px-1.5">
          {demoButton}
          <p className="text-[12px] text-muted-foreground">A campaign ready to play, to try the table: you’re its GM; four test players made their level 5 characters and joined, and a fifth has your invite. Goblins and two scenes.</p>
        </div>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <TopBar crumbs={['Play']} />
        {campaigns && !campaigns.length && !invites.length ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty
              title="Nothing To Play Yet"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => openSection('tabletop')}>Make A Campaign In Tabletop</Button>
                  {demoButton}
                </div>
              }
            >
              Play runs Tabletop’s campaigns at the table: yours, and the ones a GM invited you to.
            </Empty>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-8 py-8">
            {invites.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="label flex items-center gap-2">
                  <MailIcon className="size-3.5" /> Invitations · {invites.length}
                </h2>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                  {invites.map((invite) => (
                    <InviteCard key={`${invite.ownerId}/${invite.worldId}`} invite={invite} onAnswered={refresh} />
                  ))}
                </ul>
              </section>
            )}
            <CampaignList title="You Run" icon={CrownIcon} campaigns={mine} onOpen={open} onPlayers={(c) => setPlayers(c.worldId)} empty="No campaigns of your own yet: make one in Tabletop." />
            <CampaignList title="You’re A Player In" icon={UsersIcon} campaigns={joined} onOpen={open} empty="None yet: a GM invites you (by your email), and the invite shows here." />
          </div>
        )}
      </main>
      {playersOf && <PlayersDialog world={playersOf} onClose={() => setPlayers(null)} />}
    </>
  );
}

/** Your own characters (one of yours, `mine`), to bring to a campaign. */
function useMyCharacters(): PlayerCharacter[] {
  return useLive('pcs')
    .filter((pc) => pc.mine && !pc.archivedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The choices for bringing a character: yours, those already in a campaign
 * shown but not picked (one campaign at a time: take them out of it on their
 * sheet first), and No Character Yet.
 */
function bringOptions(characters: PlayerCharacter[], campaigns: Campaign[]) {
  return characters.map((pc) => {
    const there = pc.worldId ? campaignName(campaigns, pc.worldId) || 'another campaign' : '';
    return { value: pc.id, label: `${there ? '' : 'Bring '}${pc.name || 'Unnamed'}${there ? ` (in ${there})` : ''}`, disabled: Boolean(there) };
  });
}

/** Make A Character: Tabletop's Player view, its character creator. */
function useMakeCharacter() {
  const navigate = useNavigate();
  return () => {
    setRole('player');
    openSection('tabletop');
    void navigate({ to: '/create' });
  };
}

/** An invite to a campaign: join, bringing one of your characters (or none yet), or decline. */
function InviteCard({ invite, onAnswered }: { invite: TableInvite; onAnswered: () => void }) {
  const characters = useMyCharacters();
  const campaigns = useCampaigns();
  const make = useMakeCharacter();
  const free = characters.filter((pc) => !pc.worldId);
  const [pick, setPick] = useState<string>(() => free[0]?.id ?? '');
  const answer = async (accept: boolean) => {
    if (!(await window.api.table.answer(invite.ownerId, invite.worldId, accept))) return void toast.error('That invite isn’t there any more');
    const pc = free.find((c) => c.id === pick);
    if (accept && pc) bringCharacter(pc, invite.worldId);
    if (accept) toast('Joined', { description: `You’re a player in ${invite.name}${pc ? `, playing ${pc.name || 'your character'}` : ''}.` });
    onAnswered();
  };
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3.5" aria-label={`Invite: ${invite.name}`}>
      <div className="flex items-start gap-2">
        <MailIcon className="mt-0.5 size-4 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{invite.name}</span>
          <span className="text-[12px] text-muted-foreground">{invite.ownerName} (GM) invites you to play</span>
        </div>
      </div>
      {characters.length ? (
        <SelectField
          label="Bring a character"
          value={pick}
          onChange={setPick}
          options={[...bringOptions(characters, campaigns), { value: '', label: 'No character yet' }]}
        />
      ) : null}
      {characters.length > 0 && !free.length && (
        <p className="text-[12.5px] text-muted-foreground">
          Each of your characters is in a campaign already (one at a time: take one out on their sheet). Join now and bring one later, or{' '}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={make}>
            make one
          </button>
          .
        </p>
      )}
      {characters.length ? null : (
        <p className="text-[12.5px] text-muted-foreground">
          You have no characters yet.{' '}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={make}>
            Make one
          </button>
          , or join now and bring one later.
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void answer(true)}>
          Join
        </Button>
        <Button size="sm" variant="outline" onClick={() => void answer(false)}>
          Decline
        </Button>
      </div>
    </li>
  );
}

/** A campaign you're in without a character there yet: bring one of yours. */
function BringCharacter({ worldId }: { worldId: string }) {
  const characters = useMyCharacters();
  const campaigns = useCampaigns();
  const make = useMakeCharacter();
  const [pick, setPick] = useState('');
  if (!characters.length)
    return (
      <Button size="sm" variant="outline" onClick={make}>
        <UserPlusIcon /> Make A Character
      </Button>
    );
  return (
    <div className="flex gap-2">
      <SelectField label="Bring a character" value={pick} onChange={setPick} options={[{ value: '', label: 'Bring a character…' }, ...bringOptions(characters, campaigns)]} />
      <Button
        size="sm"
        variant="outline"
        disabled={!pick}
        onClick={() => {
          const pc = characters.find((c) => c.id === pick && !c.worldId);
          if (pc) bringCharacter(pc, worldId);
        }}
      >
        Bring
      </Button>
    </div>
  );
}

function CampaignList({ title, icon: Icon, campaigns, onOpen, onPlayers, empty }: { title: string; icon: typeof CrownIcon; campaigns: TableCampaign[]; onOpen: (c: TableCampaign) => void; onPlayers?: (c: TableCampaign) => void; empty: string }) {
  const characters = useMyCharacters();
  const worlds = useVault((s) => s.vault.worlds);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label flex items-center gap-2">
        <Icon className="size-3.5" /> {title} · {campaigns.length}
      </h2>
      {campaigns.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {campaigns.map((c) => {
            const playing = characters.filter((pc) => pc.worldId === c.worldId);
            const tabletop = c.owner ? worlds[c.worldId]?.tabletop : undefined;
            const players = tabletop?.members?.length ?? 0;
            const invited = tabletop?.invites?.length ?? 0;
            return (
              <li key={`${c.ownerId}/${c.worldId}`} className={cn('flex flex-col gap-3 rounded-xl border px-4 py-3.5')}>
                <div className="flex items-start gap-2">
                  <SwordShieldIcon className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{c.name}</span>
                    <span className="text-[12px] text-muted-foreground">
                      {c.owner
                        ? `You’re its GM · ${players} ${players === 1 ? 'player' : 'players'}${invited ? ` · ${invited} invited` : ''}`
                        : `GM: ${c.ownerName}${playing.length ? ` · You play ${playing.map((pc) => pc.name || 'Unnamed').join(' & ')}` : ''}`}
                    </span>
                  </div>
                </div>
                {!c.owner && !playing.length && <BringCharacter worldId={c.worldId} />}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => onOpen(c)} aria-label={`Open Play: ${c.name}`}>
                    <ExternalLinkIcon /> Open Play
                  </Button>
                  {onPlayers && (
                    <Button size="sm" variant="outline" onClick={() => onPlayers(c)} aria-label={`Players: ${c.name}`}>
                      <UsersIcon /> Players
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
