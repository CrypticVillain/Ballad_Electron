import { tabletopDefaults } from '@/lib/sections';
import type { World } from '@/lib/model';
import { useVault } from '@/stores/vault';

/**
 * Play → the table's settings: the GM's choices for how a campaign plays,
 * kept on the campaign (world.tabletop.table), so everyone at the table
 * plays by them. Table Settings (play/table/TableSettings) changes them,
 * from Play's Home or Play's window.
 */
export type TableRules = {
  /** A roll's damage or healing can be put on tokens from the chat (Apply). */
  applyFromChat: boolean;
  /** Players can apply damage to anyone (off: only to the tokens they control). */
  playersApply: boolean;
  /** Tokens can be targeted (right-click): an attack says hit or miss against each one's AC, a save its DC. */
  targeting: boolean;
  /** Players see whether their attacks hit (off: only the GM does, so creatures' AC stays hidden). */
  playersSeeHits: boolean;
  /** A concentration spell marks its caster; damage to them asks for a Constitution save. */
  concentration: boolean;
  /** Players see creatures' health bars over their tokens. */
  creatureHpBars: boolean;
  /** Death saves go to the GM only. */
  secretDeathSaves: boolean;
  /** Players can send each other private messages (off: only to the GM). */
  playerWhispers: boolean;
};

export const DEFAULT_TABLE_RULES: TableRules = {
  applyFromChat: true,
  playersApply: false,
  targeting: true,
  playersSeeHits: true,
  concentration: true,
  creatureHpBars: true,
  secretDeathSaves: false,
  playerWhispers: true,
};

/** A campaign's table settings, each as chosen or its default. */
export const tableRules = (world: Pick<World, 'tabletop'> | undefined | null): TableRules => ({ ...DEFAULT_TABLE_RULES, ...world?.tabletop?.table });

/** The table settings of a campaign in this window's vault (read outside React). */
export const rulesOf = (worldId: string): TableRules => tableRules(useVault.getState().vault.worlds[worldId]);

/** A campaign's table settings, kept current. */
export const useTableRules = (worldId: string | null | undefined): TableRules => tableRules(useVault((s) => (worldId ? s.vault.worlds[worldId] : undefined)));

/** Changes some of a campaign's table settings (the GM's). */
export function setTableRules(world: World, changes: Partial<TableRules>) {
  const now = useVault.getState().vault.worlds[world.id] ?? world;
  useVault.getState().patch('worlds', world.id, { tabletop: { ...tabletopDefaults(), ...now.tabletop, table: { ...now.tabletop?.table, ...changes } } });
}

/** What each setting is, for Table Settings: in its group, with a line on what it does. */
export const TABLE_RULE_INFO: { group: string; rules: { key: keyof TableRules; label: string; note: string; under?: keyof TableRules }[] }[] = [
  {
    group: 'Rolls In The Chat',
    rules: [
      { key: 'applyFromChat', label: 'Apply Damage From The Chat', note: 'Each damage or healing roll has Apply: full, half or double to its targets or the picked tokens (half on a save that succeeds).' },
      { key: 'playersApply', label: 'Players Apply Damage To Anyone', note: 'Off: a player applies damage and healing only to the tokens they control; the GM, to anyone.', under: 'applyFromChat' },
      { key: 'secretDeathSaves', label: 'Death Saves To The GM Only', note: 'A death save goes to the GM alone: the table doesn’t see how close it was.' },
    ],
  },
  {
    group: 'Targets',
    rules: [
      { key: 'targeting', label: 'Targets And Hit Or Miss', note: 'Right-click a token to target it. An attack then says hit or miss against each target’s AC; a spell’s save lists its targets, with Roll Save beside each.' },
      { key: 'playersSeeHits', label: 'Players See Hit Or Miss', note: 'Off: the players see who they targeted, the GM whether it hit (creatures’ AC stays hidden).', under: 'targeting' },
    ],
  },
  {
    group: 'Conditions',
    rules: [{ key: 'concentration', label: 'Track Concentration', note: 'Casting a concentration spell marks the caster (on their token and sheet), and ends the last one. Damage to them asks for a Constitution save; failing it ends the spell.' }],
  },
  {
    group: 'The Players',
    rules: [
      { key: 'creatureHpBars', label: 'Players See Creatures’ Health', note: 'The health bar over a creature’s token. Off: only the GM sees how hurt creatures are.' },
      { key: 'playerWhispers', label: 'Players Message Each Other', note: 'Private messages between players. Off: a player’s private messages go to the GM only.' },
    ],
  },
];
