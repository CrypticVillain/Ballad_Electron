import { Link, useNavigate } from '@tanstack/react-router';
import { BookOpenIcon, DicesIcon, EyeOffIcon, MapPinIcon, ScrollTextIcon, ShieldIcon, SkullIcon, SwordsIcon, UsersIcon, WaypointsIcon, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Label, Led } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { createPc, updateTabletop } from '@/lib/actions';
import { daysBetween, longDate, today } from '@/lib/dates';
import { passivePerception } from '@/lib/tabletop';
import { useBooks, useLive, useWorldRecords } from '@/lib/hooks';
import type { PlayerCharacter, World } from '@/lib/model';
import { tabletopDefaults } from '@/lib/sections';
import { Faceplate, PlateInput, WorldsSidebar } from '@/screens/home/HomeScreen';
import { useUi } from '@/stores/ui';
import { HpBar, useParty } from './PartyScreen';
import { Portrait } from '@/components/shared/Portrait';

/**
 * Campaign Home (/, Tabletop, GM view) — the table at a glance, everything open:
 * the party's numbers (HP, AC, passive perception, conditions), the next
 * session and its prep, the encounters, and the whole world: NPCs, places,
 * lore, creatures, the timeline, and how many secrets the players haven't
 * seen. (Player view's home is their character sheet: PlayerSheet.)
 */
export function CampaignHome({ world }: { world: World }) {
  const navigate = useNavigate();
  const tabletop = { ...tabletopDefaults(), ...world.tabletop };
  const party = useParty();
  const books = useBooks();
  const scenes = useLive('scenes');
  const encounters = useWorldRecords('encounters');
  const monsters = useWorldRecords('monsters');
  const entries = useWorldRecords('entries');
  const events = useWorldRecords('events');

  const sessions = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [books, scenes]);
  const played = sessions.filter((s) => s.status === 'done');
  const session = sessions.find((s) => s.status !== 'done');
  const count = (kind: string) => entries.filter((e) => e.kind === kind).length;
  const shares = useWorldRecords('shares');
  const shared = new Set(shares.filter((s) => s.recipients.length).map((s) => s.sourceId));
  const unshared = entries.filter((e) => !shared.has(e.id)).length;

  return (
    <>
      <WorldsSidebar />
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Campaigns', world.name || 'Untitled Campaign']}>
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => useUi.getState().setDice(true)}>
            <DicesIcon /> Dice
          </Button>
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex w-full max-w-[1120px] flex-col gap-5 px-7 pt-6 pb-10">
            <Faceplate
              world={world}
              lit={Boolean(tabletop.nextSession && tabletop.nextSession >= today())}
              left={<PlateInput label="Rules" value={tabletop.ruleset} placeholder="5E" onChange={(ruleset) => updateTabletop(world.id, { ruleset })} width="w-24" />}
              right={
                <>
                  Next Session ·
                  <DateField label="Next session" variant="bare" value={tabletop.nextSession || null} placeholder="NOT SET" onChange={(d) => updateTabletop(world.id, { nextSession: d ?? '' })} className="text-[10px] tracking-[0.18em] text-background uppercase" />
                </>
              }
            />

            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <Label>The Party</Label>
                <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => void navigate({ to: '/party/$pcId', params: { pcId: createPc(world.id).id } })}>
                  + New Character
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {party.map((pc) => (
                  <PcCard key={pc.id} pc={pc} />
                ))}
                {!party.length && <p className="col-span-4 text-sm text-muted-foreground">No characters yet. Make a sheet for everyone at the table.</p>}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <Card title="Next Session" icon={ScrollTextIcon} to={session ? `/manuscript/${session.id}` : '/manuscript'}>
                {session ? (
                  <>
                    <span className="text-[17px] font-semibold">{session.title || 'Untitled Session'}</span>
                    {tabletop.nextSession && (
                      <span className="font-mono text-[11px] text-link">
                        {longDate(tabletop.nextSession)}
                        {tabletop.nextSession >= today() && ` · In ${daysBetween(today(), tabletop.nextSession)} Days`}
                      </span>
                    )}
                    <p className="line-clamp-4 text-[13.5px] leading-relaxed text-foreground/85" data-selectable>
                      {session.note || 'No prep notes yet.'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Every session’s been played. Add the next in Sessions.</p>
                )}
                <span className="mt-auto font-mono text-[11px] text-muted-foreground">
                  {played.length} Played · {sessions.length - played.length} Planned
                </span>
              </Card>

              <Card title="Encounters" icon={SwordsIcon} to="/encounters">
                {encounters.length ? (
                  <ul className="flex flex-col">
                    {encounters.map((e) => (
                      <li key={e.id} className="border-t border-border/60 first:border-t-0">
                        <Link to="/encounters/$encounterId" params={{ encounterId: e.id }} className="flex items-center gap-2.5 py-1.5 text-[13.5px] hover:underline">
                          <Led tone={e.round > 0 ? 'accent' : 'off'} />
                          <span className="flex-1 truncate">{e.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{e.round > 0 ? `Round ${e.round}` : `${e.combatants.length} Combatants`}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No encounters yet.</p>
                )}
              </Card>
            </div>

            <section className="grid grid-cols-3 gap-3">
              <Tile to="/bible/character" icon={UsersIcon} count={count('character')} label="NPCs" />
              <Tile to="/bible/place" icon={MapPinIcon} count={count('place')} label="Places" />
              <Tile to="/bible/lore" icon={BookOpenIcon} count={count('lore')} label="Lore" />
              <Tile to="/bestiary" icon={SkullIcon} count={monsters.length} label="Creatures" />
              <Tile to="/timeline" icon={WaypointsIcon} count={events.length} label="Timeline Events" />
              <Tile to="/bible/character" icon={EyeOffIcon} count={unshared} label="Not Shared Yet" />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function PcCard({ pc }: { pc: PlayerCharacter }) {
  return (
    <Link to="/party/$pcId" params={{ pcId: pc.id }} className="flex flex-col gap-2 rounded-2xl border px-4 py-3 hover:border-foreground/30">
      <span className="flex items-center gap-2">
        {pc.image ? <Portrait image={pc.image} name={pc.name} className="size-7 rounded-full" /> : <ShieldIcon className="size-4 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate font-semibold">{pc.name || 'Unnamed Character'}</span>
        <span className="font-mono text-[11px] text-muted-foreground">Lv {pc.level}</span>
      </span>
      <span className="truncate text-[12.5px] text-muted-foreground">
        {pc.species} {pc.className}
        {pc.player && ` · ${pc.player}`}
      </span>
      <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          <b className="text-[15px] text-foreground">{pc.hp.current}</b>/{pc.hp.max} HP
        </span>
        <span>AC {pc.ac}</span>
        <span>PP {passivePerception(pc)}</span>
      </span>
      <HpBar current={pc.hp.current} max={pc.hp.max} />
      {pc.conditions.length > 0 && <span className="truncate font-mono text-[10.5px] text-link uppercase">{pc.conditions.join(' · ')}</span>}
    </Link>
  );
}

function Card({ title, icon: Icon, to, children }: { title: string; icon: LucideIcon; to: string; children: ReactNode }) {
  return (
    <section className="flex min-h-[180px] flex-col gap-2 rounded-2xl border px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Label>{title}</Label>
        <Link to={to} aria-label={`Open ${title}`} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Icon className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Tile({ to, icon: Icon, count, label }: { to: string; icon: LucideIcon; count: number; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border px-4 py-3 hover:border-foreground/30">
      <span className="flex size-[34px] items-center justify-center rounded-lg border bg-muted">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="flex-1 font-semibold">{label}</span>
      <span className="font-display text-[26px] leading-none font-black">{count}</span>
    </Link>
  );
}
