import { useNavigate } from '@tanstack/react-router';
import { ArchiveIcon, CastleIcon, CopyIcon, ClapperboardIcon, FolderIcon, GlobeIcon, LayersIcon, Share2Icon, PencilIcon, PenLineIcon, PlusIcon, ShieldIcon, Trash2Icon, UserPlusIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { BalladMark } from '@/components/shared/BalladMark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { openSection, openWorld, pickCharacter } from '@/lib/actions';
import { useBooks, useCharacter, useLive, useMyCharacters, useSection, useWorld } from '@/lib/hooks';
import { byOrder, SECTIONS, type TabletopRole, type Section } from '@/lib/model';
import { SECTION_INFO } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { accountName, useAccounts, useCurrentAccount } from '@/stores/accounts';
import { currentAccountId, usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { archiveCharacter, CharactersDialog, deleteCharacter, useCharacterGroups } from '@/screens/tabletop/Characters';
import { ROLES, switchRole } from './RoleToggle';
import { useMenuFocus } from './useMenuFocus';
import { Portrait } from '@/components/shared/Portrait';
import { useAreas } from './layouts';

export const SECTION_ICON: Record<Section, LucideIcon> = { writing: PenLineIcon, film: ClapperboardIcon, tabletop: CastleIcon };

/** A world in the menu's radio group: its account and its id (worlds are only unique within an account's vault). */
const key = (accountId: string, worldId: string) => `${accountId}/${worldId}`;

/**
 * WorldMenu — the Ballad mark at the top of the rail (Overture's workspace
 * menu): the section you're in (Writing, Filmmaking, Tabletop) to switch, which of
 * its worlds is open (productions, campaigns), every signed-in account's
 * worlds in this section to switch to (picking another account's opens that
 * account, which reloads), and New / Edit / Delete (and in Tabletop, Copy). Switching opens Home.
 * In Tabletop, a second click on its tile switches between the GM's view and a
 * player's; a strip of light along the tile's foot shows which you're in
 * (orange: GM, green: Player). In Player view the menu is about your
 * characters (campaign or not) instead of campaigns.
 */
export function WorldMenu() {
  const navigate = useNavigate();
  const section = useSection();
  const info = SECTION_INFO[section];
  const world = useWorld();
  const books = useBooks();
  const current = useCurrentAccount();
  const { accounts, worlds: saved, activeId } = useAccounts();
  const mine = useLive('worlds');
  const ui = useUi.getState();
  const focus = useMenuFocus();
  const role = usePreferences((s) => s.tabletopRoles[currentAccountId()] ?? 'gm');
  const player = section === 'tabletop' && role === 'player';
  const characters = useMyCharacters();
  const { groups: characterGroups } = useCharacterGroups(characters);
  const [managing, setManaging] = useState(false);
  const character = useCharacter();
  const areas = useAreas();
  const campaigns = mine.filter((w) => w.section === 'tabletop');
  const signedIn = accounts.filter((a) => a.signedIn);
  const several = signedIn.length > 1;

  /** Each signed-in account's worlds in this section: the open account's live from the vault, the others' as last saved. */
  const groups = signedIn.map((account) => ({
    account,
    worlds:
      account.id === activeId
        ? mine
            .filter((w) => w.section === section)
            .sort(byOrder)
            .map((w) => ({ id: w.id, name: w.name }))
        : (saved.find((s) => s.accountId === account.id)?.worlds.filter((w) => w.section === section) ?? []),
  }));

  const pick = (value: string) => {
    const [accountId, worldId] = value.split('/') as [string, string];
    if (accountId === activeId) {
      // Home first: a screen of the old world would otherwise redirect within it as the world changes.
      void navigate({ to: '/' }).then(() => openWorld(worldId));
    } else {
      void useAccounts.getState().openWorldOf(accountId, worldId);
    }
  };

  const switchSection = (next: Section) => {
    if (next === section) return;
    useUi.getState().setFocus(false);
    void navigate({ to: '/' }).then(() => openSection(next));
  };

  const detail =
    section === 'film'
      ? [world?.film?.format, world?.genre].filter(Boolean).join(' · ')
      : section === 'tabletop'
        ? (player ? ['Player View', world ? world.name : 'No Campaign'] : ['GM View', world?.tabletop?.ruleset]).filter(Boolean).join(' · ')
        : [world?.genre, world?.era, `${books.length} ${books.length === 1 ? 'Book' : 'Books'}`].filter(Boolean).join(' · ');
  const SectionIcon = SECTION_ICON[section];

  return (
    <>
    <DropdownMenu onOpenChange={(open) => open && void useAccounts.getState().refreshWorlds()}>
      <DropdownMenuTrigger
        aria-label={player ? `${info.label} · Character: ${character?.name || 'None'}` : `${info.label} · ${info.container}: ${world?.name ?? 'None'}`}
        className="relative shrink-0 rounded-[var(--tile-radius)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        {...focus.trigger}
      >
        <BalladMark className="size-11" />
        {/* Which section is open, as a badge on the mark. */}
        <span aria-hidden className="absolute -right-1.5 -bottom-1.5 flex size-[22px] items-center justify-center rounded-full border-2 border-rail bg-foreground text-background">
          <SectionIcon className="size-3" strokeWidth={2.25} />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={14} className="max-h-[calc(100vh-32px)] w-76 overflow-y-auto" {...focus.content}>
        <DropdownMenuLabel className="label py-1 text-muted-foreground">Section</DropdownMenuLabel>
        <div role="group" aria-label="Section" className="grid grid-cols-3 gap-1 px-1 pb-1">
          {SECTIONS.map((s) => {
            const Icon = SECTION_ICON[s];
            // Tabletop: once you're in it, clicking it again switches between the GM's view and a player's.
            const flips = s === 'tabletop' && section === 'tabletop';
            const other = role === 'player' ? 'gm' : 'player';
            return (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  if (!flips) return switchSection(s);
                  e.preventDefault();
                  switchRole(other, navigate);
                }}
                aria-current={s === section ? 'true' : undefined}
                aria-label={s === 'tabletop' ? `${SECTION_INFO[s].label} · ${roleLabel(role)} View${flips ? `. Click to switch to ${roleLabel(other)} View` : ''}` : undefined}
                title={flips ? `Click again for ${roleLabel(other)} View` : undefined}
                className={cn('relative flex-col gap-1.5 rounded-lg border border-transparent py-2.5 text-[12.5px]', s === section && 'border-primary bg-primary/10 font-semibold')}
              >
                <Icon className="size-[18px]" />
                {SECTION_INFO[s].label}
                {s === 'tabletop' && <RoleStrip role={role} lit={section === 'tabletop'} />}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="truncate font-display text-base leading-tight font-black tracking-wide uppercase">
            {player ? character?.name || (character ? 'Unnamed Character' : 'No Character') : world?.name || `No ${info.container}`}
          </span>
          <span className="label truncate">
            {player ? detail : world ? detail || info.container : 'Make one to start'}
            {several && ` · ${accountName(current)}`}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {player ? (
          <>
            <DropdownMenuRadioGroup
              value={character?.id ?? ''}
              onValueChange={(id) => {
                void navigate({ to: '/' }).then(() => pickCharacter(id));
              }}
            >
              {characterGroups.map((group) => (
                <DropdownMenuGroup key={group.name}>
                  <DropdownMenuLabel className="label truncate py-1 text-muted-foreground">{group.name}</DropdownMenuLabel>
                  {group.characters.map((pc) => (
                    <DropdownMenuRadioItem key={pc.id} value={pc.id}>
                      {pc.image ? <Portrait image={pc.image} name={pc.name} className="size-5 rounded-full" /> : <ShieldIcon />}
                      <span className="min-w-0 flex-1 truncate">{pc.name || 'Unnamed Character'}</span>
                      <span className="max-w-24 truncate font-mono text-[10px] text-muted-foreground">
                        {pc.className ? `${pc.className} ${pc.level}` : (campaigns.find((w) => w.id === pc.worldId)?.name ?? '')}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuRadioGroup>
            {!characters.length && <DropdownMenuItem disabled>No characters yet</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void navigate({ to: '/create' });
              }}
            >
              <PlusIcon /> New Character
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setManaging(true)}>
              <UsersIcon /> Manage Characters…
            </DropdownMenuItem>
            {character && (
              <>
                <DropdownMenuItem onSelect={() => archiveCharacter(character)}>
                  <ArchiveIcon /> Archive {character.name || 'This Character'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => deleteCharacter(character)}>
                  <Trash2Icon /> Delete {character.name || 'This Character'}…
                </DropdownMenuItem>
              </>
            )}
          </>
        ) : (
          <>
        <DropdownMenuRadioGroup value={world && current ? key(current.id, world.id) : ''} onValueChange={pick}>
          {groups.map(({ account, worlds }, index) => (
            <DropdownMenuGroup key={account.id}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="label truncate py-1 text-muted-foreground">{several ? account.email || accountName(account) : `Switch ${info.container}`}</DropdownMenuLabel>
              {worlds.map((w) => (
                <DropdownMenuRadioItem key={w.id} value={key(account.id, w.id)}>
                  <GlobeIcon />
                  <span className="min-w-0 flex-1 truncate">{w.name || `Untitled ${info.container}`}</span>
                </DropdownMenuRadioItem>
              ))}
              {!worlds.length && <DropdownMenuItem disabled>No {info.containers.toLowerCase()} yet</DropdownMenuItem>}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ui.openWorldDialog({ kind: 'create' })}>
          <PlusIcon /> New {info.container}…
        </DropdownMenuItem>
        {world && (
          <>
            <DropdownMenuItem onSelect={() => ui.openWorldDialog({ kind: 'edit', id: world.id })}>
              <PencilIcon /> Edit {info.container}…
            </DropdownMenuItem>
            {section === 'tabletop' && (
              <DropdownMenuItem onSelect={() => ui.openWorldDialog({ kind: 'copy', id: world.id })}>
                <CopyIcon /> Copy Campaign…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => ui.openWorldDialog({ kind: 'delete', id: world.id })}>
              <Trash2Icon /> Delete {info.container}…
            </DropdownMenuItem>
          </>
        )}
          </>
        )}
        {areas.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => ui.setManage('spaces')}>
              <LayersIcon /> Manage Spaces…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ui.setManage('folders')}>
              <FolderIcon /> Manage Folders…
            </DropdownMenuItem>
            {section === 'tabletop' && !player && world && (
              <DropdownMenuItem onSelect={() => ui.setSharedTracker(true)}>
                <Share2Icon /> Shared With Players…
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ui.openAccount({ kind: 'add' })}>
          <UserPlusIcon /> Add Another Account…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {managing && <CharactersDialog onClose={() => setManaging(false)} />}
    </>
  );
}

const roleLabel = (role: TabletopRole) => ROLES.find((r) => r.role === role)!.label;

/** Two segments along the Tabletop tile's foot: GM on the left (orange), Player on the right (green), the one you're in lit. */
function RoleStrip({ role, lit }: { role: TabletopRole; lit: boolean }) {
  return (
    <span aria-hidden className={cn('absolute bottom-[5px] left-1/2 flex -translate-x-1/2 gap-[3px]', !lit && 'opacity-50')}>
      {ROLES.map(({ role: r }) => (
        <span key={r} className={cn('h-[3px] w-3.5 rounded-full transition-colors', r !== role ? 'bg-muted-foreground/25' : r === 'player' ? 'bg-online shadow-[0_0_6px_var(--online)]' : 'bg-primary shadow-[0_0_6px_var(--primary)]')} />
      ))}
    </span>
  );
}
