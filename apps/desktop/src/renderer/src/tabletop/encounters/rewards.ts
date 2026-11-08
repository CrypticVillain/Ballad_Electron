import { crXp } from '@/lib/encounterMath';
import { COINS, type Coin, type Combatant, type Item, type Monster, type PlayerCharacter } from '@/lib/model';

/**
 * After a fight (pure): the XP its creatures are worth, shared among the
 * characters who get it, and its loot (things and coins) handed out: each
 * thing to one character, the coins split evenly (what doesn't split goes to
 * the first). The XP a character needs for each level is the SRD 5.1's
 * Character Advancement table.
 */

export type LootItem = { id: string; name: string; qty: number; notes?: string; /** Who gets it: a character's id, or null: not given yet. */ to: string | null };
export type Loot = { items: LootItem[]; coins: Partial<Record<Coin, number>> };
export type Award = { xp: number; items: Item[]; coins: Partial<Record<Coin, number>> };

/** XP to reach each level, 1–20 (SRD 5.1, Character Advancement). */
export const XP_FOR_LEVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000] as const;

/** The level XP earns. */
export const levelForXp = (xp: number) => XP_FOR_LEVEL.filter((need) => xp >= need).length;

/** XP for the next level after `level` (null at 20). */
export const xpForNext = (level: number) => (level >= 20 ? null : XP_FOR_LEVEL[Math.max(1, level)]!);

/** What the fight's creatures are worth: every creature's, or (`defeated`) only those at 0 hit points. */
export function encounterXp(combatants: Combatant[], monsters: Monster[], defeated = false): number {
  const byId = new Map(monsters.map((m) => [m.id, m]));
  return combatants.filter((c) => c.kind === 'monster' && (!defeated || c.hp <= 0)).reduce((sum, c) => sum + crXp(byId.get(c.refId ?? '')?.cr ?? ''), 0);
}

/** Coins split among `n`: each one's share, the first also getting what doesn't divide. */
export function splitCoins(coins: Partial<Record<Coin, number>>, n: number): Partial<Record<Coin, number>>[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(
      COINS.filter((c) => (coins[c] ?? 0) > 0).map((c) => {
        const total = Math.floor(coins[c]!);
        return [c, Math.floor(total / n) + (i === 0 ? total % n : 0)];
      }),
    ),
  );
}

/** Each recipient's award: an even share of the XP (rounded down), their things, their coins. */
export function awards(xp: number, loot: Loot, recipients: string[]): Map<string, Award> {
  const share = recipients.length ? Math.floor(xp / recipients.length) : 0;
  const coins = splitCoins(loot.coins, recipients.length);
  return new Map(
    recipients.map((id, i) => [
      id,
      {
        xp: share,
        items: loot.items.filter((it) => it.to === id && it.name.trim()).map((it) => ({ name: it.name.trim(), qty: Math.max(1, it.qty), ...(it.notes ? { notes: it.notes } : {}) })),
        coins: coins[i] ?? {},
      },
    ]),
  );
}

/** A sheet with an award added: XP, things into the pack (a thing already there by name gets more), coins into the purse. */
export function applyAward(pc: PlayerCharacter, award: Award): Pick<PlayerCharacter, 'xp' | 'inventory' | 'currency'> {
  const inventory = pc.inventory.map((it) => ({ ...it }));
  for (const item of award.items) {
    const same = inventory.find((it) => it.name.toLowerCase() === item.name.toLowerCase());
    if (same) same.qty += item.qty;
    else inventory.push(item);
  }
  const currency = { ...(pc.currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }) } as Record<Coin, number>;
  for (const c of COINS) currency[c] = (currency[c] ?? 0) + (award.coins[c] ?? 0);
  return { xp: (pc.xp ?? 0) + award.xp, inventory, currency };
}
