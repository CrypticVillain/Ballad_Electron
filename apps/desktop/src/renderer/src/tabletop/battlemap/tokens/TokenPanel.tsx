import { LIGHTS } from '../geometry/vision';
import { Link } from '@tanstack/react-router';
import { ArrowUpToLineIcon, ExternalLinkIcon, HeartIcon, ImageIcon, SwordIcon, Trash2Icon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Field, FIELD } from '@/components/shared/Field';
import { pickPicture, Portrait } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { CONDITION_TEXT, CONDITIONS } from '@/lib/tabletop';
import { cn } from '@/lib/utils';
import { TOKEN_SIZES, type GridSettings, type TokenSize } from '../model';
import { useBoardUi } from '../ui';
import { bringToFront, changeHp, removeTokens, setHp, toggleCondition, updateToken } from './actions';
import type { TokenView } from './resolve';

/**
 * Tabletop → Battle maps: the picked tokens, beside the board (in place of the
 * scene's settings). One token: its name, hit points (damage and healing;
 * a party member's are their sheet's), AC, conditions, size, whether the
 * players see it, an aura, its picture, and a link to its sheet, stat block
 * or entry. Several: damage, healing, conditions and hiding for all of them.
 */

const KIND_LABEL = { pc: 'Party', monster: 'Creature', npc: 'NPC', other: 'Token' } as const;
const AURA_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ffffff'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b px-4 py-4 last:border-b-0">
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

/** An amount, then Damage or Heal: for one token or several. */
function DamageHeal({ onApply, label }: { onApply: (amount: number, how: 'damage' | 'heal') => void; label: string }) {
  const [amount, setAmount] = useState('');
  const apply = (how: 'damage' | 'heal') => {
    const n = Math.floor(Number(amount));
    if (!(n > 0)) return;
    onApply(n, how);
    setAmount('');
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        aria-label={`Damage or healing for ${label}`}
        inputMode="numeric"
        value={amount}
        placeholder="Amount"
        onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && apply('damage')}
        className={cn(FIELD, 'w-20')}
      />
      <Button variant="outline" size="sm" onClick={() => apply('damage')} aria-label={`Damage ${label}`}>
        <SwordIcon /> Damage
      </Button>
      <Button variant="outline" size="sm" onClick={() => apply('heal')} aria-label={`Heal ${label}`}>
        <HeartIcon /> Heal
      </Button>
    </div>
  );
}

function Conditions({ has, onToggle }: { has: (c: string) => boolean | 'some'; onToggle: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {CONDITIONS.map((c) => {
        const on = has(c);
        return (
          <button
            key={c}
            type="button"
            title={CONDITION_TEXT[c]}
            aria-pressed={on === true}
            onClick={() => onToggle(c)}
            className={cn('rounded-full border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:bg-muted', on === true && 'border-amber-500 bg-amber-400/20 text-foreground', on === 'some' && 'border-dashed border-amber-500 text-foreground')}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

const number = (value: string, fallback: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

/** Someone who can be given a token: an account in the campaign (online: a player). */
export type Person = { accountId: string; name: string };

/** Who controls a token besides the GM: its own list, else its sheet's owner; tick or untick, or go back to the sheet's owner. */
function ControlledBy({ view, people }: { view: TokenView; people: Person[] }) {
  const t = view.token;
  const fromSheet = t.kind === 'pc' && t.assignees === undefined;
  const toggle = (accountId: string, on: boolean) => updateToken(t.id, { assignees: on ? [...new Set([...view.assignees, accountId])] : view.assignees.filter((a) => a !== accountId) });
  return (
    <>
      {people.length ? (
        <ul className="flex flex-col gap-1">
          {people.map((p) => (
            <li key={p.accountId}>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <Checkbox checked={view.assignees.includes(p.accountId)} onCheckedChange={(on) => toggle(p.accountId, on === true)} aria-label={`${p.name} can move it`} />
                {p.name}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-muted-foreground">No players in this campaign yet: add them in Tabletop (Edit Campaign → Players).</p>
      )}
      {t.kind === 'pc' && (
        <p className="text-[12px] text-muted-foreground">
          {fromSheet ? 'From their sheet: whoever plays them.' : 'Set here, in place of their sheet’s player.'}{' '}
          {!fromSheet && (
            <button type="button" onClick={() => updateToken(t.id, { assignees: undefined })} className="underline hover:text-foreground">
              Back to their sheet’s
            </button>
          )}
        </p>
      )}
    </>
  );
}

export function TokenPanel({ views, grid, people = [], links = true, header }: { views: TokenView[]; grid: GridSettings; people?: Person[]; links?: boolean; header?: ReactNode }) {
  const setSelected = useBoardUi((s) => s.setSelected);
  const remove = () => {
    const undo = removeTokens(views.map((v) => v.token.id));
    setSelected([]);
    toast(views.length === 1 ? 'Token Removed' : `${views.length} Tokens Removed`, { description: views.length === 1 ? views[0]!.name : undefined, action: { label: 'Undo', onClick: undo } });
  };
  const footer = (
    <div className="mt-auto flex flex-col gap-1 px-4 py-4">
      <Button variant="ghost" size="sm" onClick={() => bringToFront(views.map((v) => v.token.id))}>
        <ArrowUpToLineIcon /> Bring To Front
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
        <Trash2Icon /> {views.length === 1 ? 'Remove From The Board' : `Remove ${views.length} Tokens`}
      </Button>
    </div>
  );

  if (views.length > 1) {
    const hidden = views.every((v) => v.token.hidden);
    return (
      <aside aria-label="Picked tokens" className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l bg-background">
        {header}
        <Section title={`${views.length} Tokens`}>
          <ul className="flex flex-wrap gap-1.5">
            {views.map((v) => (
              <li key={v.token.id} className="flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[12px]">
                <Portrait image={v.image} name={v.name} className="size-5 rounded-full text-[8px]" />
                {v.name}
              </li>
            ))}
          </ul>
          <DamageHeal label="the picked tokens" onApply={(n, how) => views.forEach((v) => changeHp(v.token, n, how))} />
        </Section>
        <Section title="Conditions">
          <Conditions
            has={(c) => (views.every((v) => v.conditions.includes(c)) ? true : views.some((v) => v.conditions.includes(c)) ? 'some' : false)}
            onToggle={(c) => {
              const all = views.every((v) => v.conditions.includes(c));
              for (const v of views) if (v.conditions.includes(c) === all) toggleCondition(v.token, c);
            }}
          />
        </Section>
        <Section title="Players">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
            Hidden from the players
            <Switch checked={hidden} onCheckedChange={(on) => views.forEach((v) => updateToken(v.token.id, { hidden: on }))} />
          </label>
        </Section>
        {footer}
      </aside>
    );
  }

  const v = views[0]!;
  const t = v.token;
  const pc = t.kind === 'pc';
  return (
    <aside aria-label="Picked token" className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l bg-background">
      {header}
      <Section title={KIND_LABEL[t.kind]}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Change the token’s picture"
            onClick={async () => {
              const image = await pickPicture();
              if (image) updateToken(t.id, { image });
            }}
            className="group relative shrink-0 rounded-full"
          >
            <Portrait image={v.image} name={v.name} className="size-12 rounded-full text-sm" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100">
              <ImageIcon className="size-4" />
            </span>
          </button>
          {pc ? (
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{v.name}</span>
          ) : (
            <Input aria-label="Token name" value={t.name} maxLength={60} onChange={(e) => updateToken(t.id, { name: e.target.value })} className={FIELD} />
          )}
        </div>
        {v.missing && <p className="text-[12px] text-muted-foreground">What it stood for was deleted; the token keeps its own name and numbers.</p>}
        {links && v.link && (
          <Link to={v.link} className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ExternalLinkIcon className="size-3.5" /> {pc ? 'Open Their Sheet' : t.kind === 'monster' ? 'Open The Stat Block' : 'Open Their Entry'}
          </Link>
        )}
      </Section>

      <Section title={pc ? 'Hit Points (Their Sheet)' : 'Hit Points'}>
        {v.hp ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Current">
                <Input aria-label="Current hit points" inputMode="numeric" value={v.hp.current} onChange={(e) => setHp(t, { ...v.hp!, current: number(e.target.value, v.hp!.current) })} className={FIELD} />
              </Field>
              <Field label="Max">
                <Input aria-label="Maximum hit points" inputMode="numeric" value={v.hp.max} onChange={(e) => setHp(t, { ...v.hp!, max: Math.max(0, number(e.target.value, v.hp!.max)) })} className={FIELD} />
              </Field>
              <Field label="Temp">
                <Input aria-label="Temporary hit points" inputMode="numeric" value={v.hp.temp} onChange={(e) => setHp(t, { ...v.hp!, temp: Math.max(0, number(e.target.value, v.hp!.temp)) })} className={FIELD} />
              </Field>
            </div>
            <DamageHeal label={v.name} onApply={(n, how) => changeHp(t, n, how)} />
            {!pc && (
              <button type="button" onClick={() => setHp(t, null)} className="self-start text-[12px] text-muted-foreground hover:text-foreground">
                Stop tracking hit points
              </button>
            )}
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setHp(t, { current: 10, max: 10, temp: 0 })}>
            Track Hit Points
          </Button>
        )}
        <Field label="Armor Class">
          {pc ? (
            <span className="font-mono text-[13px]">{v.ac ?? '–'}</span>
          ) : (
            <Input aria-label="Armor class" inputMode="numeric" value={t.ac ?? v.ac ?? ''} placeholder="–" onChange={(e) => updateToken(t.id, { ac: e.target.value === '' ? null : number(e.target.value, t.ac ?? 10) })} className={cn(FIELD, 'w-20')} />
          )}
        </Field>
      </Section>

      <Section title={pc ? 'Conditions (Their Sheet)' : 'Conditions'}>
        <Conditions has={(c) => v.conditions.includes(c)} onToggle={(c) => toggleCondition(t, c)} />
      </Section>

      <Section title="Controlled By">
        <ControlledBy view={v} people={people} />
      </Section>

      <Section title="On The Board">
        <Field label="Size">
          <SelectField<TokenSize> label="Token size" value={t.size} options={TOKEN_SIZES.map((s) => ({ value: s.value, label: `${s.label} (${s.cells < 1 ? '½' : `${s.cells}×${s.cells}`})` }))} onChange={(size) => updateToken(t.id, { size })} />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
          Hidden from the players
          <Switch checked={t.hidden} onCheckedChange={(hidden) => updateToken(t.id, { hidden })} />
        </label>
        <div className="flex items-end gap-2">
          <Field label={`Aura (${grid.unit})`} className="w-20">
            <Input aria-label="Aura radius" inputMode="numeric" value={t.aura.radius || ''} placeholder="0" onChange={(e) => updateToken(t.id, { aura: { ...t.aura, radius: Math.max(0, number(e.target.value, 0)) } })} className={FIELD} />
          </Field>
          <div className="flex gap-1 pb-1.5">
            {AURA_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Aura ${c}`} aria-pressed={t.aura.color === c} onClick={() => updateToken(t.id, { aura: { ...t.aura, color: c } })} className={cn('size-5 rounded-full border', t.aura.color === c && 'ring-2 ring-primary ring-offset-1 ring-offset-background')} style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Field label={`Darkvision (${grid.unit})`} className="w-24">
            <Input aria-label="Darkvision" inputMode="numeric" value={t.darkvision || ''} placeholder="0" onChange={(e) => updateToken(t.id, { darkvision: Math.max(0, number(e.target.value, 0)) })} className={FIELD} />
          </Field>
          <Field label="Carries" className="min-w-0 flex-1">
            <SelectField
              label="Light it carries"
              value={LIGHTS.findIndex((l) => (l.light?.bright ?? 0) === (t.light?.bright ?? 0) && (l.light?.dim ?? 0) === (t.light?.dim ?? 0))}
              options={LIGHTS.map((l, i) => ({ value: i, label: l.label }))}
              onChange={(i) => updateToken(t.id, { light: LIGHTS[i]?.light ?? null })}
            />
          </Field>
        </div>
      </Section>
      {footer}
    </aside>
  );
}
