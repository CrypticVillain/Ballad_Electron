import { toast } from 'sonner';
import type { Ability } from '@/lib/model';
import { ABILITY_NAME, modifier, saveBonus } from '@/lib/tabletop';
import { useVault } from '@/stores/vault';
import { changeHp } from '@/tabletop/battlemap/tokens/actions';
import { canMove, type BoardAccess, type TokenView } from '@/tabletop/battlemap/tokens/resolve';
import { cardRoll, d20Expression, type CardTarget, type RollCard, type SaveResult } from '../sheet/rolls';
import { announce, postCard, type Speaker } from './actions';
import { amountFor, concentrationDc, type ApplyHow } from './combat';
import type { TableEntry } from './model';
import { rulesOf } from './rules';
import { viewOf } from './targets';

/**
 * Play → what the chat's cards do at the table (Table Settings turns each
 * on): damage and healing applied to tokens, a target's save rolled, and
 * concentration kept: marked when a spell needing it is cast, put to a
 * Constitution save when its caster is hurt, ended when that save fails.
 */

const store = () => useVault.getState();

/** Changes the card on a chat entry (its targets' saves, what's been applied). */
const patchCard = (entry: TableEntry, card: Partial<RollCard>) => store().patch('tableLog', entry.id, { card: { ...store().vault.tableLog[entry.id]!.card!, ...card } });

/** Whether this viewer may put damage or healing on a token: the GM any; a player their own, or anyone if the table allows. */
export const mayApply = (access: BoardAccess, view: TokenView, worldId: string) => access.gm || rulesOf(worldId).playersApply || canMove(access, view);

/** A creature's save bonus: a party member's sheet's, a Bestiary creature's ability, anyone else none. */
function saveBonusOf(view: TokenView, ability: Ability): number {
  const v = store().vault;
  const ref = view.token.refId;
  if (view.token.kind === 'pc' && ref && v.pcs[ref]) return saveBonus(v.pcs[ref]!, ability);
  if (view.token.kind === 'monster' && ref && v.monsters[ref]) return modifier(v.monsters[ref]!.abilities[ability]);
  return 0;
}

/** Rolls a save for a creature against a DC. */
function rollSave(view: TokenView, ability: Ability, dc: number): SaveResult | null {
  const r = cardRoll(`${ABILITY_NAME[ability]} Save`, d20Expression(saveBonusOf(view, ability), 'normal'));
  return r ? { total: r.total, detail: `${r.expression} → ${r.detail}`, natural: r.natural ?? null, success: r.total >= dc } : null;
}

/** A target's save against the card's DC, rolled and kept on the card. */
export function rollTargetSave(entry: TableEntry, tokenId: string) {
  const card = entry.card;
  const view = viewOf(tokenId);
  if (!card?.save || !card.targets || !view) return;
  const result = rollSave(view, card.save.ability, card.save.dc);
  if (!result) return;
  patchCard(entry, { targets: card.targets.map((t) => (t.tokenId === tokenId ? { ...t, save: result } : t)) });
}

/**
 * Puts a roll's damage (or healing) on tokens: `how` much of it each takes.
 * Kept on the card so it's seen (and not put on twice by mistake). Damage
 * to someone concentrating asks for their save.
 */
export function applyRoll(entry: TableEntry, rollIndex: number, how: ApplyHow, tokenIds: string[], speaker: Speaker, access: BoardAccess) {
  const card = entry.card;
  const roll = card?.rolls[rollIndex];
  if (!card || !roll) return;
  const applied: NonNullable<RollCard['applied']> = [];
  for (const id of tokenIds) {
    const view = viewOf(id);
    if (!view || !mayApply(access, view, speaker.worldId)) continue;
    const target: CardTarget | undefined = card.targets?.find((t) => t.tokenId === id);
    const amount = amountFor(roll.total, how, target);
    if (!amount) continue;
    changeHp(view.token, amount, how === 'heal' ? 'heal' : 'damage');
    applied.push({ name: view.name, amount, ...(how === 'heal' ? { heal: true } : {}) });
    if (how !== 'heal') checkConcentration(concentratorOf(view), amount, speaker);
  }
  if (!applied.length) return void toast('Nothing to apply it to', { description: 'Target tokens (right-click) or pick them on the board first.' });
  patchCard(entry, { applied: [...(card.applied ?? []), ...applied] });
}

// ── Concentration ──

/** Starts concentrating on a spell just cast (a party member's sheet), ending the one before. */
export function startConcentration(pcId: string, spell: string, speaker: Speaker) {
  if (!rulesOf(speaker.worldId).concentration) return;
  const pc = store().vault.pcs[pcId];
  if (!pc || pc.deletedAt) return;
  const before = pc.concentrating;
  store().patch('pcs', pcId, { concentrating: spell });
  if (before && before !== spell) announce(speaker, `${pc.name || 'They'} stops concentrating on ${before} to cast ${spell}.`);
}

/** Ends a creature's concentration: a party member's (on their sheet), or a token's own. */
export function endConcentration(target: { pcId?: string | null; tokenId?: string | null }) {
  if (target.pcId && store().vault.pcs[target.pcId]) return store().patch('pcs', target.pcId, { concentrating: null });
  if (target.tokenId && store().vault.tokens[target.tokenId]) store().patch('tokens', target.tokenId, { concentrating: null });
}

/** Someone who may be concentrating: their name and spell, their token and (one of the party) their sheet. */
export type Concentrator = { name: string; concentrating: string | null; tokenId: string | null; pcId: string | null };

/** A token as someone who may be concentrating. */
export const concentratorOf = (view: TokenView): Concentrator => ({ name: view.name, concentrating: view.concentrating, tokenId: view.token.id, pcId: view.token.kind === 'pc' ? view.token.refId : null });

/** Damage to someone concentrating: a card in the chat asking for their Constitution save (DC 10, or half the damage). */
export function checkConcentration(who: Concentrator, damage: number, speaker: Speaker) {
  if (!who.concentrating || damage <= 0 || !rulesOf(speaker.worldId).concentration) return;
  const dc = concentrationDc(damage);
  postCard(speaker, {
    kind: 'concentration',
    title: 'Concentration',
    subtitle: `${who.name} · ${who.concentrating}`,
    rolls: [],
    facts: [{ label: 'Save', value: `DC ${dc} Constitution` }],
    check: { tokenId: who.tokenId, pcId: who.pcId, spell: who.concentrating, dc },
  });
}

/** Rolls a concentration card's save: kept on the card; a failure ends the spell. */
export function rollConcentration(entry: TableEntry, speaker: Speaker) {
  const check = entry.card?.check;
  if (!check || check.result) return;
  const view = check.tokenId ? viewOf(check.tokenId) : undefined;
  const pc = check.pcId ? store().vault.pcs[check.pcId] : undefined;
  const bonus = view ? saveBonusOf(view, 'con') : pc ? saveBonus(pc, 'con') : 0;
  const r = cardRoll('Constitution Save', d20Expression(bonus, 'normal'));
  if (!r) return;
  const result: SaveResult = { total: r.total, detail: `${r.expression} → ${r.detail}`, natural: r.natural ?? null, success: r.total >= check.dc };
  patchCard(entry, { rolls: [r], check: { ...check, result } });
  if (result.success) return;
  endConcentration(check);
  announce(speaker, `${view?.name ?? pc?.name ?? 'They'} loses concentration on ${check.spell}.`);
}
