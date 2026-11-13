import { Navigate } from '@tanstack/react-router';
import { CopyIcon, DicesIcon, SparklesIcon, StarIcon, UserPlusIcon, MapPinPlusIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Kbd, Label } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { TopBar } from '@/components/shared/TopBar';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON, Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSection } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { FAMILIES, GENRES, KINDS, generateNames, genreById, seeded, type Gender, type NameKind } from './generator';
import { copyName, isSaved, makeLabel, toggleSaved, useMakeEntry, useNameGenre, useSuggestedGenre } from './useNames';

/**
 * /names — the name generator (Writing and Tabletop). Genres down the left, by
 * family; a dozen names at a time for people, places, taverns and shops, or
 * groups, in that genre's style (names/generator). Space (or Generate) for
 * more. Copy a name, keep it (Saved, below), or make it a character, NPC or
 * place in one click.
 */
export function NamesScreen() {
  const section = useSection();
  if (section !== 'writing' && section !== 'tabletop') return <Navigate to="/" replace />;
  return (
    <>
      <NamesSidebar />
      <NamesMain />
    </>
  );
}

function NamesSidebar() {
  const [genre, setGenre] = useNameGenre();
  const suggested = useSuggestedGenre();
  return (
    <Sidebar title="Names">
      {FAMILIES.map((family) => (
        <SidebarSection key={family.id} title={family.label}>
          {GENRES.filter((g) => g.family === family.id).map((g) => (
            <button key={g.id} type="button" aria-current={g.id === genre.id ? 'true' : undefined} onClick={() => setGenre(g.id)} className={cn(SIDEBAR_ROW, g.id === genre.id && SIDEBAR_ROW_ON)}>
              <span className="min-w-0 flex-1 truncate">{g.label}</span>
              {g.id === suggested && (
                <Hint label="Fits this world’s genre" side="right">
                  <SparklesIcon className="size-3.5 shrink-0 text-primary" aria-label="Fits this world’s genre" />
                </Hint>
              )}
            </button>
          ))}
        </SidebarSection>
      ))}
    </Sidebar>
  );
}

function NamesMain() {
  const section = useSection();
  const [genre] = useNameGenre();
  const kind = usePreferences((s) => s.nameKind);
  const gender = usePreferences((s) => s.nameGender);
  const saved = usePreferences((s) => s.savedNames);
  const [seed, setSeed] = useState(() => Date.now());
  const names = useMemo(() => generateNames(genre, kind, 12, seeded(seed), gender), [genre, kind, gender, seed]);
  const make = useMakeEntry();
  const [showAll, setShowAll] = useState(false);
  const again = () => setSeed((s) => s + 1 + Math.floor(Math.random() * 1e6));
  const set = usePreferences.getState().setPreference;

  // Space or Enter: more names (not while typing, nor with a dialog or menu open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="menu"], [role="dialog"], [role="listbox"]')) return;
      e.preventDefault();
      setSeed((s) => s + 1 + Math.floor(Math.random() * 1e6));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const kept = showAll ? saved : saved.filter((n) => n.genre === genre.id);
  const canMake = (k: NameKind) => make && (k === 'person' || k === 'place');

  return (
    <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Names', genre.label]}>
        <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={again}>
          <DicesIcon /> Generate
        </Button>
      </TopBar>
      <div className="@container min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-7 pt-6 pb-12">
          <header className="flex flex-col gap-2">
            <Label className="text-link">{FAMILIES.find((f) => f.id === genre.family)?.label}</Label>
            <h1 className="font-display text-[40px] leading-none font-black uppercase">{genre.label}</h1>
            <p className="max-w-[70ch] text-[14.5px] text-muted-foreground">{genre.blurb}</p>
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(k) => k && set('nameKind', k as NameKind)} aria-label="What to name">
              {KINDS.map((k) => (
                <ToggleGroupItem key={k.id} value={k.id} className="h-8 flex-none px-3.5 font-mono text-[11px] tracking-[0.08em] uppercase data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {k.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {kind === 'person' && (
              <ToggleGroup type="single" variant="outline" value={gender} onValueChange={(g) => g && set('nameGender', g as Gender)} aria-label="Whose names">
                {(['any', 'feminine', 'masculine'] as const).map((g) => (
                  <ToggleGroupItem key={g} value={g} className="h-8 flex-none px-3 font-mono text-[11px] tracking-[0.08em] uppercase data-[state=on]:border-foreground/40 data-[state=on]:bg-muted">
                    {g === 'any' ? 'Any' : g === 'feminine' ? 'Feminine' : 'Masculine'}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Kbd>Space</Kbd> for more
            </span>
          </div>

          <section aria-label="Names" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2 @3xl:grid-cols-3">
            {names.map((name) => {
              const on = isSaved(saved, name);
              return (
                <div key={name} className="group/name flex min-h-[64px] items-center gap-2 rounded-xl border bg-card px-4 py-3">
                  <span className="min-w-0 flex-1 text-[16px] leading-snug font-semibold break-words">{name}</span>
                  <span className="flex shrink-0 items-center opacity-60 transition-opacity group-hover/name:opacity-100 focus-within:opacity-100">
                    <Hint label="Copy">
                      <Button variant="ghost" size="icon-xs" aria-label={`Copy ${name}`} onClick={() => copyName(name)}>
                        <CopyIcon />
                      </Button>
                    </Hint>
                    {canMake(kind) && (
                      <Hint label={makeLabel(kind, section)}>
                        <Button variant="ghost" size="icon-xs" aria-label={`${makeLabel(kind, section)}: ${name}`} onClick={() => make!(name, kind)}>
                          {kind === 'place' ? <MapPinPlusIcon /> : <UserPlusIcon />}
                        </Button>
                      </Hint>
                    )}
                    <Hint label={on ? 'Saved: click to let it go' : 'Save it'}>
                      <Button variant="ghost" size="icon-xs" aria-label={on ? `Unsave ${name}` : `Save ${name}`} aria-pressed={on} onClick={() => toggleSaved(name, genre.id, kind)} className={cn(on && 'text-primary')}>
                        <StarIcon className={cn(on && 'fill-current')} />
                      </Button>
                    </Hint>
                  </span>
                </div>
              );
            })}
          </section>
          <Button variant="outline" className="self-center rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={again}>
            <DicesIcon /> More {KINDS.find((k) => k.id === kind)?.label}
          </Button>

          <section className="flex flex-col gap-3 border-t pt-5">
            <div className="flex items-center gap-3">
              <Label>Saved · {kept.length}</Label>
              <span className="flex-1" />
              <ToggleGroup type="single" variant="outline" value={showAll ? 'all' : 'genre'} onValueChange={(v) => v && setShowAll(v === 'all')} aria-label="Which saved names">
                <ToggleGroupItem value="genre" className="h-7 flex-none px-2.5 font-mono text-[10.5px] tracking-[0.08em] uppercase data-[state=on]:bg-muted">
                  {genre.label}
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="h-7 flex-none px-2.5 font-mono text-[10.5px] tracking-[0.08em] uppercase data-[state=on]:bg-muted">
                  Every Genre · {saved.length}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {kept.length ? (
              <div className="flex flex-wrap gap-2">
                {kept.map((n) => (
                  <span key={`${n.genre}:${n.name}`} className="group/saved flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-[13.5px]">
                    <span className="font-medium">{n.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      · {KINDS.find((k) => k.id === n.kind)?.one}
                      {showAll && ` · ${genreById(n.genre).label}`}
                    </span>
                    <Button variant="ghost" size="icon-xs" aria-label={`Copy ${n.name}`} onClick={() => copyName(n.name)} className="size-6">
                      <CopyIcon />
                    </Button>
                    {canMake(n.kind) && (
                      <Button variant="ghost" size="icon-xs" aria-label={`${makeLabel(n.kind, section)}: ${n.name}`} onClick={() => make!(n.name, n.kind)} className="size-6">
                        {n.kind === 'place' ? <MapPinPlusIcon /> : <UserPlusIcon />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-xs" aria-label={`Unsave ${n.name}`} onClick={() => toggleSaved(n.name, n.genre, n.kind)} className="size-6 text-muted-foreground hover:text-destructive">
                      <XIcon />
                    </Button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">Star a name to keep it here{showAll ? '' : ' (this genre’s; Every Genre shows them all)'}.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
