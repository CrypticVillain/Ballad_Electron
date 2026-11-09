import { natural, initiative, modifier, roll, signed, type Roll } from '@/lib/tabletop';
import { breakdown } from '@/components/tabletop/rolling';
import { useVault } from '@/stores/vault';
import type { TokenView } from '@/tabletop/battlemap/tokens/resolve';
import { stamp } from '../common';
import { updatePlayScene } from '../scenes/actions';
import type { World } from '@/lib/model';
import type { PlayScene } from '../scenes/model';
import { ordered, PING_MS, stepTurn, withoutTokens } from './logic';
import type { BoardTemplate, TableEntry, TurnOrder } from './model';

/**
 * Play → the table's actions: the log (say something, whisper, a roll, what
 * the table is told), pings, templates, and a scene's initiative.
 */

const store = () => useVault.getState();

/** Who's writing, at the table: their account and the name it goes by. */
export type Speaker = { worldId: string; accountId: string; who: string };

function log(speaker: Speaker, entry: Omit<TableEntry, keyof ReturnType<typeof stamp> | 'worldId' | 'accountId' | 'who'>): TableEntry {
  const made: TableEntry = { ...stamp(), ...speaker, ...entry };
  store().put('tableLog', made);
  return made;
}

/** Something said at the table, to everyone or (`to`) as a whisper. */
export const say = (speaker: Speaker, text: string, to?: string[]) => log(speaker, { kind: 'chat', text, ...(to ? { to } : {}) });

/** A roll, for the log (`to`: the GM's hidden roll, or a whispered one). */
export const logRoll = (speaker: Speaker, result: Roll, to?: string[]) =>
  log(speaker, { kind: 'roll', text: result.label ?? '', roll: { expression: result.expression, total: result.total, detail: breakdown(result), natural: natural(result) }, ...(to ? { to } : {}) });

/** A card from a sheet (rolled or just shown), to everyone or (`to`) as a whisper. */
export const postCard = (speaker: Speaker, card: TableEntry['card'], to?: string[]) => log(speaker, { kind: 'card', text: card?.title ?? '', card, ...(to ? { to } : {}) });

/** "/em": something done, said as the speaker ("Brin draws his blade."). */
export const emote = (speaker: Speaker, text: string) => log(speaker, { kind: 'emote', text });

/** What the table is told (combat starts, a round begins). */
export const announce = (speaker: Speaker, text: string) => log(speaker, { kind: 'system', text });

/** A ping on the board: everyone sees it for a moment; then it goes (purged, not kept). */
export function ping(speaker: Speaker, sceneId: string, x: number, y: number) {
  const made = log(speaker, { kind: 'ping', text: '', ping: { sceneId, x, y } });
  setTimeout(() => store().purge('tableLog', made.id), PING_MS + 500);
}

// ── Templates ──

export function addTemplate(input: Omit<BoardTemplate, keyof ReturnType<typeof stamp>>): BoardTemplate {
  const made: BoardTemplate = { ...stamp(), ...input };
  store().put('templates', made);
  return made;
}

export const removeTemplates = (ids: string[]) => {
  for (const id of ids) store().remove('templates', id);
  return () => {
    for (const id of ids) store().restore('templates', id);
  };
};

// ── Initiative ──

/** A token's initiative bonus: a party member's sheet's, a creature's DEX, anyone else none. */
function bonusOf(view: TokenView): number {
  const v = store().vault;
  const ref = view.token.refId;
  if (view.token.kind === 'pc' && ref && v.pcs[ref]) return initiative(v.pcs[ref]!);
  if (view.token.kind === 'monster' && ref && v.monsters[ref]) return modifier(v.monsters[ref]!.abilities.dex);
  return 0;
}

/** Rolls initiative for tokens: d20 + their bonus, each. */
function rollFor(views: TokenView[]): TurnOrder['entries'] {
  return views.map((v) => {
    const b = bonusOf(v);
    return { tokenId: v.token.id, initiative: roll(`d20${b ? signed(b) : ''}`)?.total ?? 10 };
  });
}

const said = (views: TokenView[], entries: TurnOrder['entries']) =>
  ordered({ round: 1, turn: 0, entries })
    .map((e) => `${views.find((v) => v.token.id === e.tokenId)?.name ?? 'Someone'} ${e.initiative ?? '–'}`)
    .join(' · ');

/** Starts a fight on a scene: everyone in it rolls initiative (the hidden too, for the GM), round 1. */
export function startCombat(scene: PlayScene, views: TokenView[], speaker: Speaker) {
  const entries = rollFor(views);
  updatePlayScene(scene.id, { combat: { round: 1, turn: 0, entries } });
  const shown = views.filter((v) => !v.token.hidden);
  announce(speaker, `Combat starts. ${said(shown, entries.filter((e) => shown.some((v) => v.token.id === e.tokenId)))}`);
}

/** Adds tokens to the fight, rolling their initiative. */
export function joinCombat(scene: PlayScene, views: TokenView[]) {
  const order = scene.combat;
  if (!order) return;
  const fresh = views.filter((v) => !order.entries.some((e) => e.tokenId === v.token.id));
  if (fresh.length) updatePlayScene(scene.id, { combat: { ...order, entries: [...order.entries, ...rollFor(fresh)] } });
}

export const setCombat = (scene: PlayScene, combat: TurnOrder | null) => updatePlayScene(scene.id, { combat });

/** A character's initiative, rolled: in a fight on the scene the table sees (their token in it), into the turn order. */
export function putInitiative(world: World, pcId: string, total: number) {
  const v = store().vault;
  const scene = v.playScenes[world.tabletop?.live?.sceneId ?? ''];
  const token = Object.values(v.tokens).find((t) => !t.deletedAt && t.sceneId === scene?.id && t.refId === pcId);
  if (!scene?.combat || !token) return;
  const has = scene.combat.entries.some((e) => e.tokenId === token.id);
  setCombat(scene, { ...scene.combat, entries: has ? scene.combat.entries.map((e) => (e.tokenId === token.id ? { ...e, initiative: total } : e)) : [...scene.combat.entries, { tokenId: token.id, initiative: total }] });
}

export const leaveCombat = (scene: PlayScene, ids: string[]) => scene.combat && setCombat(scene, withoutTokens(scene.combat, ids));

/** A player ends their turn (their token's up): the next one's turn, and the table's told. */
export function endTurn(scene: PlayScene, name: string, speaker: Speaker) {
  if (!scene.combat) return;
  setCombat(scene, stepTurn(scene.combat, 1));
  announce(speaker, `${name} ends their turn.`);
}

export function endCombat(scene: PlayScene, speaker: Speaker) {
  setCombat(scene, null);
  announce(speaker, 'Combat ends.');
}
