import { Link } from '@tanstack/react-router';
import { DicesIcon, WandSparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { FAMILIES, GENRES, generateNames, seeded } from './generator';
import { useNameGenre } from './useNames';

/**
 * The wand beside a name (a character's, an NPC's, a place's, a new Tabletop
 * character's): a few names in your genre to pick from, more on a click, and
 * the genre to change. The full generator is Names on the rail.
 */
export function NameSuggest({ kind, onPick, className }: { kind: 'person' | 'place'; onPick: (name: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [genre, setGenre] = useNameGenre();
  const gender = usePreferences((s) => s.nameGender);
  const [seed, setSeed] = useState(() => Date.now());
  const names = useMemo(() => (open ? generateNames(genre, kind, 8, seeded(seed), kind === 'person' ? gender : 'any') : []), [open, genre, kind, gender, seed]);
  const options = FAMILIES.flatMap((family) =>
    GENRES.filter((g) => g.family === family.id).map((g, i) => ({ value: g.id, label: g.label, divider: i === 0 && family.id !== FAMILIES[0]!.id })),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label={kind === 'place' ? 'Suggest a place name' : 'Suggest a name'}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={kind === 'place' ? 'Suggest a place name' : 'Suggest a name'} className={cn('shrink-0 text-muted-foreground hover:text-foreground', className)}>
            <WandSparklesIcon />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="start" className="flex w-80 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <SelectField label="Genre" variant="chip" value={genre.id} onChange={setGenre} options={options} className="min-w-0 flex-1" />
          <Hint label="More names">
            <Button variant="outline" size="icon-sm" aria-label="More names" onClick={() => setSeed((s) => s + 1 + Math.floor(Math.random() * 1e6))}>
              <DicesIcon />
            </Button>
          </Hint>
        </div>
        <div role="listbox" aria-label="Suggested names" className="flex flex-col">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onPick(name);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              {name}
            </button>
          ))}
        </div>
        <Link to="/names" onClick={() => setOpen(false)} className="border-t px-2 pt-2 text-[12px] text-muted-foreground hover:text-foreground">
          More in Names: places, taverns, groups, saved names →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
