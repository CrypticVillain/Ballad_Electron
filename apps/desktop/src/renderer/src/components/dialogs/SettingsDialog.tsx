import { DownloadIcon, FileTextIcon, FolderOpenIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DiceLookSelect } from '@/components/tabletop/DiceLookSelect';
import { Die } from '@/components/tabletop/Die';
import { rollAndShow } from '@/components/tabletop/rolling';
import { Label } from '@/components/shared/bits';
import { AppIconArt, BalladMark } from '@/components/shared/BalladMark';
import { SelectField } from '@/components/shared/SelectField';
import { AppearancePanel } from '@/components/themes/AppearancePanel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label as UiLabel } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { activeWorld, removeSampleContent } from '@/lib/actions';
import { today, type Clock } from '@/lib/dates';
import { exportMarkdown } from '@/lib/export';
import { COLLECTIONS } from '@/lib/model';
import { formatWords } from '@/lib/text';
import { cn } from '@/lib/utils';
import { DICE_LOOK_INFO } from '@/lib/diceLooks';
import { DELETE_AREA_INFO, DELETE_AREAS, lookOf, usePreferences, type DeleteArea } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';
import type { AppIconChoice } from '../../../../shared/ipc';

type Tab = 'appearance' | 'writing' | 'dice' | 'deleting' | 'data';

/** Settings (Ctrl+,): Appearance (the suite's, as in Harmony and Overture), Writing, Dice (Tabletop), Deleting (where it asks first), Data (the local vault). */
export function SettingsDialog() {
  const open = useUi((s) => s.settings);
  const [tab, setTab] = useState<Tab>('appearance');
  return (
    <Dialog open={open} onOpenChange={(o) => useUi.getState().setSettings(o)}>
      {/* Focus starts on the dialog, not the first tab, so it opens without a focus ring. */}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[min(620px,calc(100vh-64px))] gap-0 overflow-hidden p-0 sm:max-w-[820px]">
        {/* shadcn's Tabs, vertical: the sections down the left, arrow keys move between them. */}
        <Tabs orientation="vertical" value={tab} onValueChange={(t) => setTab(t as Tab)} className="min-w-0 flex-1 flex-row gap-0">
          <nav className="flex w-[200px] shrink-0 flex-col border-r bg-sidebar p-3">
            <DialogTitle className="px-2.5 pt-1.5 pb-3 font-display text-xl font-black uppercase">Settings</DialogTitle>
            <DialogDescription className="sr-only">Appearance, writing and data</DialogDescription>
            <TabsList aria-label="Settings sections" className="w-full gap-0.5 bg-transparent p-0 group-data-[orientation=vertical]/tabs:h-auto">
              {(
                [
                  ['appearance', 'Appearance'],
                  ['writing', 'Writing'],
                  ['dice', 'Dice'],
                  ['deleting', 'Deleting'],
                  ['data', 'Data'],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="h-[34px] flex-none rounded-md border-0 px-2.5 text-[13.5px] font-normal text-sidebar-foreground shadow-none hover:bg-sidebar-accent data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground data-[state=active]:shadow-none group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none dark:text-sidebar-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-sidebar-accent dark:data-[state=active]:text-sidebar-accent-foreground"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="mt-auto flex items-center gap-2.5 px-2.5 pt-3">
              <BalladMark className="size-7" />
              <span className="font-mono text-[10.5px] text-muted-foreground">Ballad {window.api.config.version}</span>
            </div>
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            <TabsContent value="appearance">
              <Appearance />
            </TabsContent>
            <TabsContent value="writing">
              <Writing />
            </TabsContent>
            <TabsContent value="dice">
              <DiceSettings />
            </TabsContent>
            <TabsContent value="deleting">
              <DeletingSettings />
            </TabsContent>
            <TabsContent value="data">
              <Data />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Appearance: the suite's look (style, theme, text font, effects: the shared
 * panel, the same in every Monospace app and the setup) with Apply to all,
 * then Ballad's own: the clock, shortcuts, handwriting and the app icon.
 */
function Appearance() {
  const prefs = usePreferences();
  const [applied, setApplied] = useState(false);
  const applyAll = () => {
    window.api.app.applyToAll(lookOf(prefs)).then(
      () => {
        setApplied(true);
        toast.success('Applied to all Monospace apps');
      },
      () => toast.error('Couldn’t apply it to the other apps. Ballad keeps it.'),
    );
  };
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Label>Look</Label>
        <AppearancePanel
          value={lookOf(prefs)}
          onChange={(patch) => {
            setApplied(false);
            prefs.setLook(patch);
          }}
          onApplyAll={applyAll}
          applyAllNote={applied ? 'Applied. Harmony, Overture and Libretto have this look now, open or not.' : undefined}
        />
      </section>
      <section className="flex flex-col gap-3">
        <Label>Clock</Label>
        <ToggleGroup type="single" variant="outline" value={prefs.clock} onValueChange={(clock) => clock && prefs.setPreference('clock', clock as Clock)} aria-label="Clock">
          {(['12', '24'] as const).map((clock) => (
            <ToggleGroupItem
              key={clock}
              value={clock}
              className="h-8 flex-none px-3.5 font-mono text-[11px] tracking-[0.08em] uppercase data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {clock === '12' ? '12-Hour · 7:00 PM' : '24-Hour · 19:00'}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">How times show everywhere: sessions and the calendar, call times, and when you pick one.</p>
      </section>
      <section className="flex flex-col gap-3">
        <Label>Keyboard Shortcuts</Label>
        <div className="flex flex-col divide-y rounded-xl border">
          <label className="flex items-center justify-between gap-4 p-4">
            <span className="flex flex-col gap-1">
              <span className="font-semibold">Shortcuts In The Status Bar</span>
              <span className="text-sm text-muted-foreground">The reminders at its right: Ctrl K Search, Ctrl N New, Ctrl D Dice, @ and #. The shortcuts work either way, and Help (Shift+/) lists them all.</span>
            </span>
            <Switch checked={prefs.statusShortcuts} onCheckedChange={(v) => prefs.setPreference('statusShortcuts', v)} aria-label="Show keyboard shortcuts in the status bar" />
          </label>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <Label>Handwriting</Label>
        <div className="flex flex-col divide-y rounded-xl border">
          <label className="flex items-center justify-between gap-4 p-4">
            <span className="flex flex-col gap-1">
              <span className="font-semibold">Draw With Finger</span>
              <span className="text-sm text-muted-foreground">On a touch screen, a finger writes in Handwriting and marks up Play’s board. Off, a finger scrolls, and a pen or the mouse writes. Once a pen’s been used, fingers scroll anyway.</span>
            </span>
            <Switch checked={prefs.inkFinger} onCheckedChange={(v) => prefs.setPreference('inkFinger', v)} aria-label="Draw with finger" />
          </label>
        </div>
      </section>
      <AppIcon />
    </div>
  );
}

/** The app icon: dark, light, or following the system (on Windows, the taskbar's light / dark mode). main/appIcon.ts applies it. */
function AppIcon() {
  const [choice, setChoice] = useState<AppIconChoice>(window.api.config.appIcon);
  const system = { darwin: 'macOS', win32: 'Windows' }[window.api.config.platform] ?? 'System';
  const pick = (next: AppIconChoice) => {
    setChoice(next);
    window.api.app.setAppIcon(next);
  };
  // Same order as Theme (and the installer): Match, Light, Dark.
  const options: { value: AppIconChoice; label: string }[] = [
    { value: 'system', label: `Match ${system}` },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  return (
    <section className="flex flex-col gap-3">
      <Label>App Icon</Label>
      <RadioGroup value={choice} onValueChange={(v) => pick(v as AppIconChoice)} aria-label="App icon" className="flex flex-wrap gap-3">
        {options.map((o) => (
          <UiLabel
            key={o.value}
            className={cn(
              'relative w-[116px] flex-col items-center gap-2 rounded-xl border p-3 text-[13px] leading-normal font-normal transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              choice === o.value ? 'border-primary bg-primary/5' : 'hover:border-foreground/30',
            )}
          >
            <RadioGroupItem value={o.value} aria-label={o.label} className="absolute top-2 right-2" />
            {o.value === 'system' ? (
              <span className="flex items-center">
                <AppIconArt variant="dark" className="size-10 [clip-path:inset(0_50%_0_0)]" />
                <AppIconArt variant="light" className="-ml-10 size-10 [clip-path:inset(0_0_0_50%)]" />
              </span>
            ) : (
              <AppIconArt variant={o.value} className="size-10" />
            )}
            {o.label}
          </UiLabel>
        ))}
      </RadioGroup>
      <p className="text-sm text-muted-foreground">
        {window.api.config.platform === 'win32'
          ? `Shows on the taskbar and the Start menu and Desktop shortcuts. Match Windows follows the taskbar's light or dark mode. A pinned taskbar icon can take until Ballad restarts to change.`
          : window.api.config.platform === 'darwin'
            ? 'Shows in the Dock and the window. Match macOS follows light or dark mode.'
            : 'Shows on the window.'}
      </p>
    </section>
  );
}

const DAILY_GOALS = [0, 250, 500, 750, 1000, 1500, 2000, 3000];

function Writing() {
  const prefs = usePreferences();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Label>Manuscript Font</Label>
        <ToggleGroup type="single" variant="outline" value={prefs.manuscriptFont} onValueChange={(font) => font && prefs.setPreference('manuscriptFont', font as typeof prefs.manuscriptFont)} aria-label="Manuscript font">
          <ToggleGroupItem value="serif" className="h-9 flex-none px-4 font-[Literata,Georgia,serif] text-[14px] data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Book Serif
          </ToggleGroupItem>
          <ToggleGroupItem value="sans" className="h-9 flex-none px-4 text-[14px] data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            The Style’s Sans
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">Book Serif is Literata, made for long reading. The rest of the app keeps the style’s own fonts.</p>
      </section>
      <section className="flex flex-col gap-3">
        <Label>Daily Goal</Label>
        <SelectField
          label="Daily goal"
          className="w-40"
          value={prefs.dailyGoal}
          onChange={(goal) => prefs.setPreference('dailyGoal', goal)}
          options={DAILY_GOALS.map((g) => ({ value: g, label: g ? `${formatWords(g)} Words` : 'None' }))}
        />
        <p className="text-sm text-muted-foreground">Words you add to any scene count toward today. The status bar’s light comes on when you reach it, and World Home counts your goal days.</p>
      </section>
      <section className="flex flex-col gap-3">
        <Label>Status Bar</Label>
        <div className="flex flex-col divide-y rounded-xl border">
          <label className="flex items-center justify-between gap-4 p-4">
            <span className="flex flex-col gap-1">
              <span className="font-semibold">Word Count</span>
              <span className="text-sm text-muted-foreground">Today’s words against your daily goal, and a book’s total in Writing.</span>
            </span>
            <Switch checked={prefs.statusWords} onCheckedChange={(v) => prefs.setPreference('statusWords', v)} aria-label="Show the word count in the status bar" />
          </label>
          <label className="flex items-center justify-between gap-4 p-4">
            <span className="flex flex-col gap-1">
              <span className="font-semibold">Journal Entries & Sessions</span>
              <span className="text-sm text-muted-foreground">Tabletop: how many journal entries your character has (Player), or sessions played (GM).</span>
            </span>
            <Switch checked={prefs.statusEntries} onCheckedChange={(v) => prefs.setPreference('statusEntries', v)} aria-label="Show journal entries and sessions in the status bar" />
          </label>
        </div>
      </section>
    </div>
  );
}

/**
 * The dice's look (one of the styles', or the app's own), whether rolls
 * tumble across the screen, and at Play's table: whether Dmg joins its Hit,
 * and whether a Tabletop sheet's rolls tumble in Play's window.
 */
function DiceSettings() {
  const prefs = usePreferences();
  const info = DICE_LOOK_INFO[prefs.diceLook];
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Label>Dice Style</Label>
        <DiceLookSelect />
        <div className="flex flex-col overflow-hidden rounded-xl border">
          <span className="flex h-[132px] items-center justify-center gap-3 bg-muted/60 px-4">
            <Die sides={20} value={20} look={prefs.diceLook} size={84} />
            <Die sides={12} value={11} look={prefs.diceLook} size={64} />
            <Die sides={10} value={7} look={prefs.diceLook} size={60} />
            <Die sides={8} value={8} look={prefs.diceLook} size={58} />
            <Die sides={6} value={6} look={prefs.diceLook} size={56} />
            <Die sides={4} value={4} look={prefs.diceLook} size={58} />
          </span>
          <span className="flex flex-col gap-0.5 px-4 py-3">
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{info.name}</span>
              <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase">{info.genre}</span>
            </span>
            <span className="text-xs text-muted-foreground">{info.note}</span>
          </span>
        </div>
      </section>
      <section className="flex items-center justify-between gap-4 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Roll Across The Screen</span>
          <span className="text-sm text-muted-foreground">Every roll tumbles across the screen and lands on its result. Off: the result shows as a pop-up. With your system’s reduced motion on, the dice just appear.</span>
        </div>
        <Switch checked={prefs.diceAnimation} onCheckedChange={(v) => prefs.setPreference('diceAnimation', v)} aria-label="Roll across the screen" />
      </section>
      <section className="flex flex-col gap-3">
        <Label>At Play’s Table</Label>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Link Hit And Dmg</span>
            <span className="text-sm text-muted-foreground">
              An attack’s Dmg rolled right after its Hit joins the Hit’s card in the chat, and a natural 20 on the Hit doubles the damage dice. Off: Hit and Dmg are rolls of their own (Attack still rolls both, crits and all).
            </span>
          </div>
          <Switch checked={prefs.linkHitDamage} onCheckedChange={(v) => prefs.setPreference('linkHitDamage', v)} aria-label="Link Hit and Dmg" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Roll Tabletop’s Dice In Play</span>
            <span className="text-sm text-muted-foreground">
              In Play Mode, what a Tabletop sheet rolls at the table (an attack, a spell, a check) tumbles across Play’s window too, as if it were rolled there. Needs Roll Across The Screen.
            </span>
          </div>
          <Switch checked={prefs.sheetDiceInPlay} onCheckedChange={(v) => prefs.setPreference('sheetDiceInPlay', v)} aria-label="Roll Tabletop’s dice in Play" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Open The Chat On A Roll</span>
            <span className="text-sm text-muted-foreground">
              A roll from a sheet (Play’s, or Tabletop’s in Play Mode) opens Play’s chat. Off: the chat stays as you left it, open or closed, and its button shows a dot for what’s new.
            </span>
          </div>
          <Switch checked={prefs.chatOpensOnRoll} onCheckedChange={(v) => prefs.setPreference('chatOpensOnRoll', v)} aria-label="Open the chat on a roll" />
        </div>
      </section>
      <Button variant="outline" size="sm" className="self-start" onClick={() => rollAndShow('2d20kh1+1d12+1d8+1d6+1d4+5', 'Test Roll')}>
        Roll A Test
      </Button>
    </div>
  );
}

/**
 * Deleting: where it asks first, area by area, under each section. Off, a
 * delete happens at once, still with Undo right after.
 */
function DeletingSettings() {
  const prefs = usePreferences();
  const asks = (area: DeleteArea) => prefs.confirmDeletes[area] !== false;
  const set = (area: DeleteArea, on: boolean) => prefs.setPreference('confirmDeletes', { ...prefs.confirmDeletes, [area]: on });
  const all = (on: boolean) => prefs.setPreference('confirmDeletes', on ? {} : Object.fromEntries(DELETE_AREAS.map((a) => [a, false])));
  const asking = DELETE_AREAS.filter(asks).length;
  const groups = [...new Set(DELETE_AREAS.map((a) => DELETE_AREA_INFO[a].group))];
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <Label>Ask Before Deleting</Label>
        <p className="text-sm text-muted-foreground">Ballad asks before anything is deleted. Turn that off where you’d rather it didn’t: the delete then happens at once, and Undo is still offered right after.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={asking === DELETE_AREAS.length} onClick={() => all(true)}>
            Ask Everywhere
          </Button>
          <Button variant="outline" size="sm" disabled={asking === 0} onClick={() => all(false)}>
            Ask Nowhere
          </Button>
          <span className="ml-1 font-mono text-[11px] text-muted-foreground">
            {asking} of {DELETE_AREAS.length} ask first
          </span>
        </div>
      </section>
      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <Label>{group}</Label>
          <div className="flex flex-col rounded-xl border">
            {DELETE_AREAS.filter((a) => DELETE_AREA_INFO[a].group === group).map((area) => (
              <label key={area} className="flex cursor-pointer items-center justify-between gap-4 border-t px-4 py-3 first:border-t-0 hover:bg-muted/40">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[14px] font-medium">{DELETE_AREA_INFO[area].label}</span>
                  <span className="text-xs text-muted-foreground">{DELETE_AREA_INFO[area].note}</span>
                </span>
                <Switch checked={asks(area)} onCheckedChange={(on) => set(area, on)} aria-label={`Ask before deleting: ${group}, ${DELETE_AREA_INFO[area].label}`} />
              </label>
            ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Deleting a whole world always asks: it has its own window. Hiding a Library spell or item isn’t deleting, so it never asks.</p>
    </div>
  );
}

function Data() {
  const vault = useVault((s) => s.vault);
  const count = (c: 'worlds' | 'scenes' | 'entries' | 'events') => Object.values(vault[c]).filter((r) => !r.deletedAt).length;
  const hasSamples = COLLECTIONS.some((c) => Object.values(vault[c]).some((r) => r.sample && !r.deletedAt));
  const world = activeWorld();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <Label>Local Vault</Label>
        <p className="text-sm text-muted-foreground">Everything you write is saved on this computer, in one file, with the previous save kept as a backup. No account or internet needed.</p>
        <code className="rounded-lg border bg-muted px-3 py-2 font-mono text-xs break-all">{window.api.config.vaultDir}</code>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.api.vault.reveal()}>
            <FolderOpenIcon /> Open Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const path = await window.api.files.saveText({
                defaultName: `ballad-export-${today()}.json`,
                text: JSON.stringify(useVault.getState().vault, null, 2),
                filter: { name: 'JSON', extensions: ['json'] },
              });
              if (path) toast.success('Exported', { description: path });
            }}
          >
            <DownloadIcon /> Export Everything As JSON
          </Button>
          {world && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const path = await window.api.files.saveText({
                  defaultName: `${world.name || 'manuscript'}.md`,
                  text: exportMarkdown(world.id),
                  filter: { name: 'Markdown', extensions: ['md'] },
                });
                if (path) toast.success('Exported', { description: path });
              }}
            >
              <FileTextIcon /> Export Manuscript As Markdown
            </Button>
          )}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {count('worlds')} Worlds · {count('scenes')} Scenes · {count('entries')} Entries · {count('events')} Events
        </p>
      </section>
      {hasSamples && (
        <section className="flex flex-col gap-2.5">
          <Label>Starter Content</Label>
          <p className="text-sm text-muted-foreground">The samples from the first run: The Glass Archipelago (Writing), How Glass Is Made (Filmmaking) and The Sunken Lantern (Tabletop), with everything in them. Your own work stays.</p>
          <Button
            variant="outline"
            size="sm"
            className="self-start text-destructive"
            onClick={() => {
              removeSampleContent();
              toast.success('Starter content removed');
            }}
          >
            <Trash2Icon /> Remove Starter Content
          </Button>
        </section>
      )}
    </div>
  );
}
