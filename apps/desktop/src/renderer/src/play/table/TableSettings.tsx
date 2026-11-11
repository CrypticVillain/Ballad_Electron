import { SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { SIDEBAR_ROW } from '@/components/shell/Sidebar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { setTableRules, TABLE_RULE_INFO, tableRules } from './rules';

/**
 * Play → Table Settings: how a campaign plays, the GM's to set (play/table/
 * rules). From a campaign you run on Play's Home, or the sidebar of Scenes
 * and of Play's window. A setting under another is greyed while that one's
 * off.
 */

/** A sidebar row (Play's window, Scenes) that opens Table Settings. */
export function TableSettingsRow({ world }: { world: World }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={SIDEBAR_ROW}>
        <SlidersHorizontalIcon className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">Table Settings</span>
      </button>
      {open && <TableSettingsDialog world={world} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TableSettingsDialog({ world: initial, onClose }: { world: World; onClose: () => void }) {
  const world = useVault((s) => s.vault.worlds[initial.id]) ?? initial;
  const rules = tableRules(world);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-64px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Table Settings · {world.name || 'Untitled Campaign'}</DialogTitle>
          <DialogDescription>How this campaign plays in Play, for everyone at the table.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {TABLE_RULE_INFO.map((g) => (
            <section key={g.group} className="flex flex-col gap-2">
              <h3 className="label">{g.group}</h3>
              {g.rules.map((r) => {
                const off = r.under ? !rules[r.under] : false;
                return (
                  <label key={r.key} className={cn('flex items-start justify-between gap-4 rounded-xl border p-3', r.under && 'ml-5', off && 'opacity-50')}>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold">{r.label}</span>
                      <span className="text-[12.5px] text-muted-foreground">{r.note}</span>
                    </span>
                    <Switch checked={rules[r.key]} disabled={off} onCheckedChange={(v) => setTableRules(world, { [r.key]: v })} aria-label={r.label} />
                  </label>
                );
              })}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
