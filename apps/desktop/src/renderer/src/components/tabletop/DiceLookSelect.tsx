import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DICE_GENRES, DICE_LOOK_IDS, DICE_LOOK_INFO, type DiceLook } from '@/lib/diceLooks';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { Die } from './Die';

/**
 * DiceLookSelect — the dice style, as a dropdown (Settings → Dice, the dice
 * tray): every look grouped by genre, each with its d20 beside its name, so
 * the list can keep growing.
 */
export function DiceLookSelect({ className, compact }: { className?: string; compact?: boolean }) {
  const look = usePreferences((s) => s.diceLook);
  return (
    <Select value={look} onValueChange={(value) => usePreferences.getState().setPreference('diceLook', value as DiceLook)}>
      <SelectTrigger aria-label="Dice style" className={cn('w-full', compact ? 'h-9' : 'h-11', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[440px]" position="popper">
        {DICE_GENRES.map((genre, index) => (
          <SelectGroup key={genre}>
            {index > 0 && <SelectSeparator />}
            <SelectLabel className="label text-[9.5px] text-muted-foreground">{genre}</SelectLabel>
            {DICE_LOOK_IDS.filter((id) => DICE_LOOK_INFO[id].genre === genre).map((id) => (
              <SelectItem key={id} value={id} className="gap-2.5 py-1.5">
                <Die sides={20} value={20} look={id} size={compact ? 22 : 26} />
                <span className="truncate">{DICE_LOOK_INFO[id].name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
