import { GiftIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { updateRecord } from '@/lib/actions';
import { relativeTime } from '@/lib/dates';
import { useWorldRecords } from '@/lib/hooks';
import { COINS, newId, now, type Coin, type Encounter } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { applyAward, awards, encounterXp, type Loot, type LootItem } from './rewards';

const EMPTY: Loot = { items: [], coins: {} };
const COIN_LABEL: Record<Coin, string> = { cp: 'CP', sp: 'SP', ep: 'EP', gp: 'GP', pp: 'PP' };

/**
 * An encounter's rewards, under the fight: the XP its creatures are worth
 * (all of them, or only the defeated) shared among the characters ticked,
 * and its loot: things, each for one of them, and coins split evenly. Give
 * Rewards puts it all on their sheets (Undo takes it back).
 */
export function Rewards({ encounter }: { encounter: Encounter }) {
  const pcs = useWorldRecords('pcs');
  const monsters = useWorldRecords('monsters');
  const [defeated, setDefeated] = useState(false);
  const loot = encounter.loot ?? EMPTY;
  const party = encounter.combatants.filter((c) => c.kind === 'pc' && c.refId).map((c) => pcs.find((p) => p.id === c.refId)).filter((p) => p !== undefined);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const to = (chosen ?? party.map((p) => p.id)).filter((id) => party.some((p) => p.id === id));
  const xp = encounterXp(encounter.combatants, monsters, defeated);
  const setLoot = (changes: Partial<Loot>) => updateRecord('encounters', encounter.id, { loot: { ...loot, ...changes } });
  const setItem = (id: string, changes: Partial<LootItem>) => setLoot({ items: loot.items.map((it) => (it.id === id ? { ...it, ...changes } : it)) });
  const nameOf = (id: string) => party.find((p) => p.id === id)?.name || 'Character';

  const give = () => {
    const given = awards(xp, loot, to);
    const before = new Map(to.map((id) => [id, useVault.getState().vault.pcs[id]!]));
    for (const [id, award] of given) {
      const pc = before.get(id);
      if (pc) updateRecord('pcs', id, applyAward(pc, award));
    }
    const prior = encounter.awarded ?? null;
    updateRecord('encounters', encounter.id, { awarded: { at: now(), to, xp } });
    const share = to.length ? Math.floor(xp / to.length) : 0;
    toast('Rewards Given', {
      description: `${to.map(nameOf).join(', ')}${share ? ` · ${share.toLocaleString('en-US')} XP each` : ''}`,
      action: {
        label: 'Undo',
        onClick: () => {
          for (const [id, pc] of before) updateRecord('pcs', id, { xp: pc.xp, inventory: pc.inventory, currency: pc.currency });
          updateRecord('encounters', encounter.id, { awarded: prior });
        },
      },
    });
  };

  return (
    <section aria-label="Rewards" className="flex flex-col gap-4 rounded-2xl border px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label>Rewards</Label>
        {encounter.awarded && (
          <span className="font-mono text-[11px] text-muted-foreground">
            Given {relativeTime(encounter.awarded.at)} to {encounter.awarded.to.map(nameOf).join(', ')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-baseline gap-1.5">
          <b className="font-display text-2xl font-black">{xp.toLocaleString('en-US')}</b>
          <span className="font-mono text-[11px] text-muted-foreground">XP{to.length > 1 ? ` · ${Math.floor(xp / to.length).toLocaleString('en-US')} each` : ''}</span>
        </span>
        <label className="flex items-center gap-2 text-[13px]">
          <Checkbox checked={defeated} onCheckedChange={(v) => setDefeated(v === true)} /> Only creatures at 0 HP
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted-foreground">Who gets it</span>
        {party.length ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {party.map((pc) => (
              <label key={pc.id} className="flex items-center gap-2 text-[13px]">
                <Checkbox checked={to.includes(pc.id)} onCheckedChange={(v) => setChosen(v === true ? [...to, pc.id] : to.filter((id) => id !== pc.id))} aria-label={`Give rewards to ${pc.name}`} />
                {pc.name || 'Character'}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Add the party to the fight to give them its rewards.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted-foreground">Loot</span>
        {loot.items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <input aria-label="Loot" value={it.name} placeholder="A silver key" onChange={(e) => setItem(it.id, { name: e.target.value })} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-ring" />
            <input aria-label={`How many ${it.name || 'of it'}`} inputMode="numeric" value={it.qty} onChange={(e) => setItem(it.id, { qty: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })} className="h-8 w-14 rounded-md border bg-background text-center font-mono text-[13px] outline-none focus:border-ring" />
            <SelectField
              label={`Who gets ${it.name || 'it'}`}
              value={it.to}
              onChange={(id) => setItem(it.id, { to: id })}
              options={[{ value: null as string | null, label: 'Nobody Yet' }, ...party.map((p) => ({ value: p.id as string | null, label: p.name || 'Character' }))]}
              className="h-8 w-44 text-[13px]"
            />
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${it.name || 'loot'}`} onClick={() => setLoot({ items: loot.items.filter((x) => x.id !== it.id) })}>
              <XIcon />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="self-start" onClick={() => setLoot({ items: [...loot.items, { id: newId(), name: '', qty: 1, to: party[0]?.id ?? null }] })}>
          <PlusIcon /> Add Loot
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[12px] text-muted-foreground">Coins, split evenly</span>
        {COINS.map((c) => (
          <label key={c} className="flex items-center gap-1">
            <input
              aria-label={`${COIN_LABEL[c]} found`}
              inputMode="numeric"
              value={loot.coins[c] || ''}
              placeholder="0"
              onChange={(e) => setLoot({ coins: { ...loot.coins, [c]: Math.max(0, Number.parseInt(e.target.value, 10) || 0) } })}
              className="h-8 w-16 rounded-md border bg-background text-center font-mono text-[13px] outline-none focus:border-ring"
            />
            <span className="font-mono text-[11px] text-muted-foreground">{COIN_LABEL[c]}</span>
          </label>
        ))}
      </div>

      <Button className="self-start" disabled={!to.length || (!xp && !loot.items.some((it) => it.to && it.name.trim()) && !COINS.some((c) => (loot.coins[c] ?? 0) > 0))} onClick={give}>
        <GiftIcon /> {encounter.awarded ? 'Give Rewards Again' : 'Give Rewards'}
      </Button>
    </section>
  );
}
