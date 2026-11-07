import { CastleIcon, CrownIcon, ExternalLinkIcon, UsersIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Empty } from '@/components/shared/bits';
import { SwordShieldIcon } from '@/components/shared/icons';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { openSection } from '@/lib/actions';
import { cn } from '@/lib/utils';
import type { TableCampaign } from '../../../../shared/ipc';

/**
 * Play → Home (/ in Play): the campaigns you can play, to open Play for. Play
 * itself opens in a window of its own (play/window), one at a time. Yours
 * (you run them: you're their GM), and the ones another account runs that
 * you're a member of (online: campaigns you've joined).
 */
export function PlayHome() {
  const [campaigns, setCampaigns] = useState<TableCampaign[] | null>(null);
  useEffect(() => {
    const refresh = () => void window.api.table.campaigns().then(setCampaigns);
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const mine = campaigns?.filter((c) => c.owner) ?? [];
  const joined = campaigns?.filter((c) => !c.owner) ?? [];
  const open = (c: TableCampaign) => void window.api.table.open(c.ownerId, c.worldId);

  return (
    <>
      <Sidebar title="Play">
        <p className="px-1.5 text-[12.5px] text-muted-foreground">Set your scenes up in Scenes; the session plays in its own window, one at a time: the table, its music (Music, beside the scenes), the dice.</p>
        <button type="button" onClick={() => openSection('tabletop')} className="flex items-center gap-2 px-1.5 text-left text-[12.5px] text-muted-foreground hover:text-foreground">
          <CastleIcon className="size-3.5" /> Make and edit campaigns in Tabletop
        </button>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <TopBar crumbs={['Play']} />
        {campaigns && !campaigns.length ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty title="Nothing To Play Yet" action={<Button onClick={() => openSection('tabletop')}>Make A Campaign In Tabletop</Button>}>
              Play runs Tabletop’s campaigns at the table: yours, and the ones you’re a player in.
            </Empty>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-8 py-8">
            <CampaignList title="You Run" icon={CrownIcon} campaigns={mine} onOpen={open} empty="No campaigns of your own yet: make one in Tabletop." />
            <CampaignList title="You’re A Player In" icon={UsersIcon} campaigns={joined} onOpen={open} empty="None yet: a GM adds you to their campaign (Edit Campaign → Players)." />
          </div>
        )}
      </main>
    </>
  );
}

function CampaignList({ title, icon: Icon, campaigns, onOpen, empty }: { title: string; icon: typeof CrownIcon; campaigns: TableCampaign[]; onOpen: (c: TableCampaign) => void; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label flex items-center gap-2">
        <Icon className="size-3.5" /> {title} · {campaigns.length}
      </h2>
      {campaigns.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {campaigns.map((c) => (
            <li key={`${c.ownerId}/${c.worldId}`} className={cn('flex flex-col gap-3 rounded-xl border px-4 py-3.5')}>
              <div className="flex items-start gap-2">
                <SwordShieldIcon className="mt-0.5 size-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="text-[12px] text-muted-foreground">{c.owner ? 'You’re its GM' : `GM: ${c.ownerName}`}</span>
                </div>
              </div>
              <Button size="sm" onClick={() => onOpen(c)} aria-label={`Open Play: ${c.name}`}>
                <ExternalLinkIcon /> Open Play
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
