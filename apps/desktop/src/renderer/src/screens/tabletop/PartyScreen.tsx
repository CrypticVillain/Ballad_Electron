import { Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { ShieldIcon, UserIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Empty } from '@/components/shared/bits';
import { Sidebar, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { createPc } from '@/lib/actions';
import { useRecord, useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import type { PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { CharacterSheet } from './CharacterSheet';
import { Portrait } from '@/components/shared/Portrait';

/** The open campaign's player characters, by name. */
export function useParty(): PlayerCharacter[] {
  const pcs = useWorldRecords('pcs');
  return useMemo(() => [...pcs].sort((a, b) => a.name.localeCompare(b.name)), [pcs]);
}

/** A thin HP bar: green, then amber under half, red under a quarter. */
export function HpBar({ current, max, className }: { current: number; max: number; className?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-input', className)} aria-hidden>
      <span className={cn('block h-full rounded-full', ratio > 0.5 ? 'bg-online' : ratio > 0.25 ? 'bg-primary' : 'bg-destructive')} style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}

/** /party: opens the party's first sheet (in Player view, the first that isn't yours: yours is home). */
export function PartyIndex() {
  const world = useWorld();
  const role = useRole();
  const party = useParty();
  const navigate = useNavigate();
  const first = (role === 'player' && party.find((pc) => !pc.mine)) || party[0];
  if (first) return <Navigate to="/party/$pcId" params={{ pcId: first.id }} replace />;
  return (
    <>
      <PartySidebar />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty title="No Party Yet" action={world && <Button onClick={() => void navigate({ to: '/party/$pcId', params: { pcId: createPc(world.id).id } })}>New Character</Button>}>
          Make a character sheet for everyone at the table.
        </Empty>
      </main>
    </>
  );
}

/** /party/$pcId — one player character's sheet. In Player view, the others' (not yours) are read-only: their players keep them. */
export function PartyScreen() {
  const { pcId } = useParams({ from: '/party/$pcId' });
  const pc = useRecord('pcs', pcId);
  const world = useWorld();
  const role = useRole();
  if (!pc || pc.worldId !== world?.id) return <Navigate to="/party" replace />;
  return (
    <>
      <PartySidebar />
      <CharacterSheet key={pc.id} pc={pc} world={world} readOnly={role === 'player' && !pc.mine} />
    </>
  );
}

function PartySidebar() {
  const world = useWorld();
  const navigate = useNavigate();
  const party = useParty();
  return (
    <Sidebar title="Party" addLabel="New Character" onAdd={world ? () => void navigate({ to: '/party/$pcId', params: { pcId: createPc(world.id).id } }) : undefined}>
      <SidebarSection title={`Characters · ${party.length}`}>
        {party.map((pc) => (
          <SidebarLink
            key={pc.id}
            to={`/party/${pc.id}`}
            icon={pc.image ? undefined : pc.mine ? UserIcon : ShieldIcon}
            lead={pc.image ? <Portrait image={pc.image} name={pc.name} className="size-6 rounded-full" /> : undefined}
            label={
              <span className="flex flex-col gap-1 py-1.5">
                <span className="truncate">{pc.name || 'Unnamed Character'}</span>
                <HpBar current={pc.hp.current} max={pc.hp.max} className="h-1 w-full" />
              </span>
            }
            meta={`${pc.className.slice(0, 3).toUpperCase() || '—'} ${pc.level}`}
          />
        ))}
      </SidebarSection>
      {party.some((pc) => pc.mine) && <p className="px-2.5 text-xs text-muted-foreground">The person icon is yours (Player view: your sheet is home).</p>}
    </Sidebar>
  );
}
