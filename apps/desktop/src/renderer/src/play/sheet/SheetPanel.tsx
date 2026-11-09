import { DicesIcon, HeartIcon, MessageSquareShareIcon, MoonIcon, SkullIcon, SunIcon, SwordIcon, XIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { PillTabs } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { updateRecord } from '@/lib/actions';
import { sameName, useItems, useSpells } from '@/lib/compendium';
import { useLive } from '@/lib/hooks';
import { ABILITY_NAME, COMBAT_ACTIONS, damage, heal, longRest, modifier, saveBonus, shortRest, signed, skillBonus, SKILLS, spellAttack, spellSaveDc } from '@/lib/tabletop';
import type { Ability, Monster, PlayerCharacter, World } from '@/lib/model';
import { cn } from '@/lib/utils';
import type { BoardAccess } from '@/tabletop/battlemap/tokens/resolve';
import { postCard, putInitiative, type Speaker } from '../table/actions';
import { usePlayUi } from '../scenes/ui';
import { attackCard, damageCard, hitCard, spellInfoCard, weaponCard, checkCard, deathSaveCard, featureCard, hitDieCard, initiativeCard, itemCard, monsterActionCard, monsterSaveCard, pcInitiative, saveCard, skillCard, spellCard, textCard, type Sent, type SheetOptions } from './cards';
import { splitDamage, type RollMode } from './rolls';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const MODES: { value: RollMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'advantage', label: 'Adv' },
  { value: 'disadvantage', label: 'Dis' },
];

/**
 * Play → the Sheet, beside the board in Play's window (as D&D Beyond's sheet
 * rolls into Roll20): your character (the GM: anyone in the party, or a
 * creature on the scene). Every check, save, skill, attack, spell, feature
 * and item rolls (or just sends its text) to the table's chat as a card;
 * what it spends comes off the sheet (a slot, a use, a potion), and
 * initiative goes into the scene's turn order. Roll with advantage or
 * disadvantage, add an extra (Bless's 1d4, Hunter's Mark's 1d6), or send
 * it to the GM only.
 */
export function SheetPanel({ world, access, speaker, onClose }: { world: World; access: BoardAccess; speaker: Speaker; onClose: () => void }) {
  const pcs = useLive('pcs');
  const monsters = useLive('monsters');
  const tokens = useLive('tokens');
  const liveId = world.tabletop?.live?.sceneId ?? null;
  const party = pcs.filter((p) => p.worldId === world.id && !p.archivedAt && (access.gm || p.ownerAccountId === access.accountId));
  // The GM's creatures: those on the scene the table sees.
  const creatures = access.gm
    ? [...new Set(tokens.filter((t) => t.sceneId === liveId && t.kind === 'monster' && t.refId).map((t) => t.refId!))].map((id) => monsters.find((m) => m.id === id)).filter((m): m is Monster => Boolean(m))
    : [];
  const [pick, setPick] = useState<string | null>(null);
  const who = pick ?? party[0]?.id ?? (creatures[0] ? `m:${creatures[0].id}` : null);
  const pc = party.find((p) => p.id === who);
  const monster = who?.startsWith('m:') ? creatures.find((m) => `m:${m.id}` === who) : undefined;
  const [options, setOptions] = useState<SheetOptions>({ mode: 'normal', d20Extra: '', damageExtra: '' });
  const [secret, setSecret] = useState(false);
  const [extras, setExtras] = useState(false);

  /** Sends a card to the chat (the GM only, if asked) and puts what it spent on the sheet. */
  const send = ({ card, changes }: Sent) => {
    if (pc && changes) updateRecord('pcs', pc.id, changes);
    postCard(speaker, card, secret ? [] : undefined);
    // What's sent shows in the chat.
    usePlayUi.getState().setLog(true);
    // Advantage and disadvantage are for one roll.
    if (options.mode !== 'normal') setOptions((o) => ({ ...o, mode: 'normal' }));
  };

  const choices = [...party.map((p) => ({ value: p.id as string | null, label: p.name || 'Unnamed Character' })), ...creatures.map((m) => ({ value: `m:${m.id}` as string | null, label: `${m.name} (creature)` }))];
  return (
    <aside aria-label="Sheet" className="flex w-[340px] shrink-0 flex-col border-l bg-sidebar">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="font-display text-lg font-black tracking-wide uppercase">Sheet</span>
        <span className="flex-1" />
        <Button variant="ghost" size="icon-sm" aria-label="Close the sheet" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      {choices.length === 0 ? (
        <p className="p-4 text-[13px] text-muted-foreground">{access.gm ? 'No one in the party yet.' : 'You don’t play a character in this campaign yet.'}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 border-b px-3 py-2">
            {choices.length > 1 && <SelectField label="Whose sheet" value={who} onChange={setPick} options={choices} className="h-8 text-[13px]" />}
            <div className="flex flex-wrap items-center gap-2">
              <PillTabs label="Roll with" value={options.mode} options={MODES} onChange={(mode) => setOptions((o) => ({ ...o, mode }))} />
              <label className="flex items-center gap-1.5 text-[12px]" title="Only the GM (and you) see what you send">
                <Checkbox checked={secret} onCheckedChange={(v) => setSecret(v === true)} aria-label="To the GM only" /> GM Only
              </label>
              <button type="button" onClick={() => setExtras(!extras)} aria-expanded={extras} className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground">
                {extras ? 'Hide Extras' : 'Extras'}
                {(options.d20Extra || options.damageExtra) && ' •'}
              </button>
            </div>
            {extras && (
              <div className="grid grid-cols-2 gap-2">
                <Extra label="Add to d20 rolls" placeholder="1d4 (Bless)" value={options.d20Extra} onChange={(d20Extra) => setOptions((o) => ({ ...o, d20Extra }))} />
                <Extra label="Add to damage" placeholder="1d6 (Hunter’s Mark)" value={options.damageExtra} onChange={(damageExtra) => setOptions((o) => ({ ...o, damageExtra }))} />
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {pc ? <PcSheet pc={pc} world={world} options={options} send={send} /> : monster ? <MonsterSheet m={monster} options={options} send={send} /> : null}
          </div>
        </>
      )}
    </aside>
  );
}

function Extra({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
      {label}
      <input aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-7 rounded-md border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-ring" />
    </label>
  );
}

type Tab = 'checks' | 'actions' | 'spells' | 'features' | 'items';

function PcSheet({ pc, world, options, send }: { pc: PlayerCharacter; world: World; options: SheetOptions; send: (s: Sent) => void }) {
  const [tab, setTab] = useState<Tab>('actions');
  const spells = useSpells();
  const items = useItems();
  const [amount, setAmount] = useState('');
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  const spellInfo = (name: string) => spells.find((s) => !s.hidden && sameName(s.name, name));
  const itemInfo = (name: string) => items.find((i) => !i.hidden && sameName(i.name, name));
  const n = Number.parseInt(amount, 10);

  /** Initiative: rolled, and (in a fight on the scene the table sees) put in the turn order. */
  const rollInitiative = () => {
    const sent = initiativeCard(pc.name, pcInitiative(pc), options);
    send(sent);
    putInitiative(world, pc.id, sent.card.rolls[0]!.total);
  };

  const dc = spellSaveDc(pc);
  const atk = spellAttack(pc);
  const byLevel = useMemo(() => {
    const groups = new Map<number, PlayerCharacter['spells']>();
    for (const s of [...pc.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))) groups.set(s.level, [...(groups.get(s.level) ?? []), s]);
    return [...groups];
  }, [pc.spells]);
  const actionFeatures = (pc.traits ?? []).filter((f) => f.action && f.action !== 'passive');

  return (
    <div className="flex flex-col">
      <section aria-label="Who" className="flex flex-col gap-2 border-b px-3 py-3">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-xl font-black uppercase">{pc.name || 'Unnamed'}</span>
          <span className="truncate text-[12px] text-muted-foreground">
            {[pc.species, pc.className].filter(Boolean).join(' ')} {pc.level}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <span>
            <span className="text-muted-foreground">AC</span> <b>{pc.ac}</b>
          </span>
          <span aria-label="Hit points">
            <span className="text-muted-foreground">HP</span> <b>{pc.hp.current}</b>/{pc.hp.max}
            {pc.hp.temp > 0 && <span className="text-muted-foreground"> +{pc.hp.temp}</span>}
          </span>
          <span>
            <span className="text-muted-foreground">Speed</span> {pc.speed}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input aria-label="Hit points to lose or gain" inputMode="numeric" value={amount} placeholder="HP" onChange={(e) => setAmount(e.target.value)} className="h-7 w-14 rounded-md border bg-background px-2 text-[12.5px] outline-none focus:border-ring" />
          <Button variant="outline" size="xs" disabled={!(n > 0)} onClick={() => (set({ hp: damage(pc.hp, n) }), setAmount(''))}>
            <SwordIcon /> Damage
          </Button>
          <Button variant="outline" size="xs" disabled={!(n > 0)} onClick={() => (set({ hp: heal(pc.hp, n), ...(pc.hp.current === 0 ? { deathSaves: { successes: 0, failures: 0 } } : {}) }), setAmount(''))}>
            <HeartIcon /> Heal
          </Button>
          <span className="flex-1" />
          <Button size="xs" aria-label="Roll initiative" onClick={rollInitiative}>
            <DicesIcon /> Init {signed(pcInitiative(pc))}
          </Button>
        </div>
        {pc.hp.current === 0 && (
          <div className="flex items-center gap-2 text-[12px]">
            <Button variant="outline" size="xs" onClick={() => send(deathSaveCard(pc))}>
              <SkullIcon /> Death Save
            </Button>
            <span className="text-muted-foreground">
              {pc.deathSaves.successes} ✓ · {pc.deathSaves.failures} ✗
            </span>
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Sheet" className="flex border-b px-1">
        {(['actions', 'spells', 'checks', 'features', 'items'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('flex-1 border-b-2 border-transparent py-1.5 text-[12px] text-muted-foreground capitalize hover:text-foreground', tab === t && 'border-primary font-semibold text-foreground')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'checks' && (
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-2 gap-1.5">
            {ABILITIES.map((a) => (
              <div key={a} className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1.5">
                <span className="w-10 font-mono text-[11px] uppercase">{a}</span>
                <RollButton label={`${ABILITY_NAME[a]} check`} text={signed(modifier(pc.abilities[a]))} onClick={() => send(checkCard(pc.name, a, pc.abilities[a], options))} />
                <RollButton label={`${ABILITY_NAME[a]} save`} text={`Save ${signed(saveBonus(pc, a))}`} onClick={() => send(saveCard(pc, a, options))} strong={pc.saves.includes(a)} />
              </div>
            ))}
          </div>
          <ul aria-label="Skills" className="flex flex-col">
            {SKILLS.map((s) => (
              <li key={s.name}>
                <button type="button" aria-label={`${s.name} check`} onClick={() => send(skillCard(pc, s.name, options))} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-muted">
                  <span className={cn('size-1.5 rounded-full', pc.expertise.includes(s.name) ? 'bg-primary' : pc.skills.includes(s.name) ? 'bg-foreground' : 'border border-muted-foreground')} />
                  <span className="flex-1">{s.name}</span>
                  <span className="font-mono text-[10.5px] text-muted-foreground uppercase">{s.ability}</span>
                  <span className="w-8 text-right font-mono text-[12.5px]">{signed(skillBonus(pc, s.name))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'actions' && (
        <div className="flex flex-col gap-3 p-3">
          <Group title="Attacks">
            {pc.attacks.length ? (
              pc.attacks.map((a, i) => (
                <Row key={i} name={a.name || 'Attack'} meta={`${a.bonus ? `${signed(a.bonus)} to hit · ` : ''}${a.damage}`}>
                  <RollButton label={`Attack with ${a.name || 'it'}`} title="Roll to hit, then damage (a natural 20 doubles the damage dice)" text="Attack" strong onClick={() => send(attackCard(pc.name, a, options, undefined, spellInfo(a.name)?.text))} />
                  <RollButton label={`Roll ${a.name || 'it'} to hit`} title={`Roll to hit only (${signed(a.bonus)})`} text="Hit" onClick={() => send(hitCard(pc.name, a, options))} />
                  <RollButton label={`Roll ${a.name || 'it'} damage`} title={`Roll damage only (${a.damage})`} text="Dmg" disabled={!splitDamage(a.damage).dice} onClick={() => send(damageCard(pc.name, a, options))} />
                  <SendButton label={`Send ${a.name || 'it'} to the chat`} onClick={() => send(weaponCard(pc.name, a, itemInfo(a.name)))} />
                </Row>
              ))
            ) : (
              <Empty>No attacks on the sheet.</Empty>
            )}
          </Group>
          {actionFeatures.length > 0 && (
            <Group title="Features You Use">
              {actionFeatures.map((f) => (
                <FeatureRow key={f.id} pc={pc} f={f} options={options} send={send} />
              ))}
            </Group>
          )}
          <Group title="In Combat">
            <div className="flex flex-wrap gap-1">
              {COMBAT_ACTIONS.map((a) => (
                <button key={a.name} type="button" title={`Send ${a.name}’s rules to the chat`} onClick={() => send(textCard(a.name, `${pc.name} · ${{ action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', free: 'Free' }[a.kind]}`, a.text, 'action'))} className="rounded-full border bg-background px-2 py-0.5 text-[11.5px] hover:bg-muted">
                  {a.name}
                </button>
              ))}
            </div>
          </Group>
          <Group title="Rest">
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="xs" onClick={() => send(hitDieCard(pc))}>
                <HeartIcon /> Spend A Hit Die (d{pc.hitDie ?? 8})
              </Button>
              <Button variant="outline" size="xs" onClick={() => send({ ...textCard('Short Rest', pc.name, 'Uses that come back on a short rest are back.'), changes: shortRest(pc) })}>
                <SunIcon /> Short Rest
              </Button>
              <Button variant="outline" size="xs" onClick={() => send({ ...textCard('Long Rest', pc.name, 'Hit points, spell slots and every use are back.'), changes: longRest(pc) })}>
                <MoonIcon /> Long Rest
              </Button>
            </div>
          </Group>
        </div>
      )}

      {tab === 'spells' && (
        <div className="flex flex-col gap-3 p-3">
          {pc.spellcasting ? (
            <p className="text-[12.5px]">
              <span className="text-muted-foreground">Save DC</span> <b>{dc}</b> · <span className="text-muted-foreground">Spell attack</span> <b>{atk !== null ? signed(atk) : '–'}</b> · <span className="font-mono text-[11px] uppercase">{pc.spellcasting}</span>
            </p>
          ) : null}
          {pc.slots.some(([max]) => max > 0) && (
            <div aria-label="Spell slots" className="flex flex-wrap gap-x-3 gap-y-1">
              {pc.slots.map(([max, used], i) =>
                max > 0 ? (
                  <span key={i} className="font-mono text-[11px]">
                    {i + 1}: {max - used}/{max}
                  </span>
                ) : null,
              )}
            </div>
          )}
          {byLevel.length ? (
            byLevel.map(([level, list]) => (
              <Group key={level} title={level === 0 ? 'Cantrips' : `Level ${level}`}>
                {list.map((s) => (
                  <SpellRow key={s.name} pc={pc} spell={s} info={spellInfo(s.name)} options={options} send={send} />
                ))}
              </Group>
            ))
          ) : (
            <Empty>No spells on the sheet.</Empty>
          )}
        </div>
      )}

      {tab === 'features' && (
        <div className="flex flex-col gap-1.5 p-3">
          {(pc.traits ?? []).length ? (pc.traits ?? []).map((f) => <FeatureRow key={f.id} pc={pc} f={f} options={options} send={send} />) : <Empty>No features on the sheet.</Empty>}
          {pc.features && (
            <Row name="More Notes" meta="">
              <SendButton label="Send More Notes to the chat" onClick={() => send(textCard('Features & Traits', pc.name, pc.features))} />
            </Row>
          )}
        </div>
      )}

      {tab === 'items' && (
        <div className="flex flex-col gap-1.5 p-3">
          {pc.inventory.length ? (
            pc.inventory.map((item, i) => {
              const info = itemInfo(item.name);
              const usable = info && /regains?\s+\d+d\d+/i.test(info.text);
              return (
                <Row key={`${item.name}-${i}`} name={`${item.name}${item.qty > 1 ? ` ×${item.qty}` : ''}`} meta={info?.stats || info?.type || ''}>
                  {usable && <RollButton label={`Use ${item.name}`} text="Use" onClick={() => send(itemCard(pc, item, info, true))} />}
                  <SendButton label={`Send ${item.name} to the chat`} onClick={() => send(itemCard(pc, item, info, false))} />
                </Row>
              );
            })
          ) : (
            <Empty>Nothing carried.</Empty>
          )}
        </div>
      )}
    </div>
  );
}

function SpellRow({ pc, spell, info, options, send }: { pc: PlayerCharacter; spell: PlayerCharacter['spells'][number]; info: ReturnType<ReturnType<typeof useSpells>['find']>; options: SheetOptions; send: (s: Sent) => void }) {
  const level = info?.level ?? spell.level;
  // The slots it can be cast with: its own level and up, with one left.
  const slots = level === 0 ? [] : pc.slots.map(([max, used], i) => ({ level: i + 1, left: max - used })).filter((s) => s.level >= level && s.left > 0);
  const [slot, setSlot] = useState<number | null>(null);
  const at = slot ?? slots[0]?.level ?? level;
  return (
    <Row name={spell.name} meta={[info?.castingTime, info?.range, spell.prepared ? 'Prepared' : ''].filter(Boolean).join(' · ')}>
      {level > 0 && slots.length > 1 && (
        <select aria-label={`Slot for ${spell.name}`} value={at} onChange={(e) => setSlot(Number(e.target.value))} className="h-6 rounded border bg-background px-1 font-mono text-[11px]">
          {slots.map((s) => (
            <option key={s.level} value={s.level}>
              L{s.level}
            </option>
          ))}
        </select>
      )}
      <RollButton label={`Cast ${spell.name}`} text={level === 0 ? 'Cast' : slots.length ? `Cast L${at}` : 'No Slots'} disabled={level > 0 && !slots.length} onClick={() => send(spellCard(pc, spell.name, info, level === 0 ? 0 : at, options))} />
      <SendButton label={`Send ${spell.name} to the chat`} onClick={() => send(spellInfoCard(pc, spell.name, info))} />
    </Row>
  );
}

function FeatureRow({ pc, f, options, send }: { pc: PlayerCharacter; f: NonNullable<PlayerCharacter['traits']>[number]; options: SheetOptions; send: (s: Sent) => void }) {
  const left = f.uses ? f.uses.max - f.uses.used : null;
  return (
    <Row name={f.name || 'Feature'} meta={[f.source, left !== null ? `${left}/${f.uses!.max} uses` : '', f.roll].filter(Boolean).join(' · ')}>
      {(f.roll || f.uses) && <RollButton label={`Use ${f.name}`} text={f.roll ? 'Roll' : 'Use'} disabled={left !== null && left <= 0} onClick={() => send(featureCard(pc, f, true, options))} />}
      <SendButton label={`Send ${f.name} to the chat`} onClick={() => send(featureCard(pc, f, false, options))} />
    </Row>
  );
}

function MonsterSheet({ m, options, send }: { m: Monster; options: SheetOptions; send: (s: Sent) => void }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col">
        <span className="font-display text-xl font-black uppercase">{m.name}</span>
        <span className="text-[12px] text-muted-foreground">
          {m.kind} · AC {m.ac} · HP {m.hp} · CR {m.cr}
        </span>
      </div>
      <Group title="Checks And Saves">
        <div className="grid grid-cols-2 gap-1.5">
          {ABILITIES.map((a) => (
            <div key={a} className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1.5">
              <span className="w-10 font-mono text-[11px] uppercase">{a}</span>
              <RollButton label={`${m.name} ${ABILITY_NAME[a]} check`} text={signed(modifier(m.abilities[a]))} onClick={() => send(checkCard(m.name, a, m.abilities[a], options))} />
              <RollButton label={`${m.name} ${ABILITY_NAME[a]} save`} text="Save" onClick={() => send(monsterSaveCard(m, a, options))} />
            </div>
          ))}
        </div>
      </Group>
      <Group title="Actions">
        {m.actions.length ? (
          m.actions.map((a, i) => (
            <Row key={i} name={a.name} meta="">
              <RollButton label={`${m.name}: ${a.name}`} text="Roll" onClick={() => send(monsterActionCard(m, a, options))} />
              <SendButton label={`Send ${a.name} to the chat`} onClick={() => send(textCard(a.name, m.name, a.text, 'action'))} />
            </Row>
          ))
        ) : (
          <Empty>No actions.</Empty>
        )}
      </Group>
      {m.traits && (
        <Group title="Traits">
          <Row name="Traits" meta="">
            <SendButton label={`Send ${m.name}’s traits to the chat`} onClick={() => send(textCard('Traits', m.name, m.traits))} />
          </Row>
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <span className="font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">{title}</span>
      {children}
    </section>
  );
}

function Row({ name, meta, children }: { name: string; meta: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium">{name}</span>
        {meta && <span className="truncate text-[11px] text-muted-foreground">{meta}</span>}
      </span>
      {children}
    </div>
  );
}

function RollButton({ label, title, text, onClick, disabled, strong }: { label: string; title?: string; text: string; onClick: () => void; disabled?: boolean; strong?: boolean }) {
  return (
    <button type="button" aria-label={label} title={title ?? label} disabled={disabled} onClick={onClick} className={cn('h-6 shrink-0 rounded-md border px-1.5 font-mono text-[11px] hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-current', strong && 'border-foreground font-bold')}>
      {text}
    </button>
  );
}

function SendButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
      <MessageSquareShareIcon className="size-3.5" />
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-muted-foreground">{children}</p>;
}
