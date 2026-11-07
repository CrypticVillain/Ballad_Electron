import { SelectField } from '@/components/shared/SelectField';
import type { TokenView } from './tokens/resolve';
import { useBoardUi } from './ui';

/**
 * Tabletop → Battle maps: what's picked, at the top of the side panel, as a
 * dropdown: the map itself (its settings) or any token (its panel). Picking
 * here picks on the board, and picking on the board shows here; several
 * picked shows as "3 Tokens Picked". Only tokens you can pick are listed (a
 * player: their own).
 */

const KIND = { pc: 'Party', monster: 'Creature', npc: 'NPC', other: 'Token' } as const;
const MANY = '__many';

export function SelectionPicker({ views, mapLabel }: { views: TokenView[]; mapLabel: string }) {
  const selected = useBoardUi((s) => s.selected);
  const setSelected = useBoardUi((s) => s.setSelected);
  const picked = selected.filter((id) => views.some((v) => v.token.id === id));
  const value = picked.length === 0 ? '' : picked.length === 1 ? picked[0]! : MANY;
  const sorted = [...views].sort((a, b) => a.name.localeCompare(b.name));
  const options = [
    { value: '', label: mapLabel },
    ...(picked.length > 1 ? [{ value: MANY, label: `${picked.length} Tokens Picked` }] : []),
    ...sorted.map((v) => ({ value: v.token.id, label: `${v.name || 'Unnamed'} · ${KIND[v.token.kind]}${v.token.hidden ? ' · Hidden' : ''}` })),
  ];
  return (
    <div className="border-b px-4 py-3">
      <SelectField label="What’s picked" value={value} options={options} onChange={(id) => id !== MANY && setSelected(id ? [id] : [])} />
    </div>
  );
}
