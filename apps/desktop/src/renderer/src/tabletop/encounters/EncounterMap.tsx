import { MapIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateRecord } from '@/lib/actions';
import { useWorld } from '@/lib/hooks';
import type { Encounter } from '@/lib/model';
import { Board } from '@/tabletop/battlemap/board/Board';
import { MapPanel, PanelSection } from '@/tabletop/battlemap/MapPanel';
import { SelectionPicker } from '@/tabletop/battlemap/SelectionPicker';
import { mapFromChoice, MapSourcePicker, type MapChoice } from '@/tabletop/battlemap/MapSourcePicker';
import type { BattleMap } from '@/tabletop/battlemap/model';
import { currentAccount, useCampaignPeople } from '@/tabletop/battlemap/people';
import { useBoardTokens } from '@/tabletop/battlemap/tokens/hooks';
import { TokenPanel } from '@/tabletop/battlemap/tokens/TokenPanel';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import { MusicPicker } from '@/tabletop/music/MusicPicker';

/**
 * Tabletop → Encounters → Map: an encounter's battle map, prepared ahead.
 * Pick its map (your picture, a campaign map, a Library map, or blank), line
 * the grid up, place the fight's combatants (the tray's This Fight, or Place
 * The Rest), and set the fog of war: a scene made from the encounter in Play
 * starts from all of it. The board is the shared one (tabletop/battlemap).
 */
export function EncounterMap({ encounter }: { encounter: Encounter }) {
  const world = useWorld();
  const people = useCampaignPeople(world);
  const views = useBoardTokens(encounter.id);
  const selected = useBoardUi((s) => s.selected);
  const setSelected = useBoardUi((s) => s.setSelected);
  const setTool = useBoardUi((s) => s.setTool);
  const [choice, setChoice] = useState<MapChoice | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSelected([]), [encounter.id, setSelected]);

  const setMap = (changes: Partial<BattleMap>) => encounter.map && updateRecord('encounters', encounter.id, { map: { ...encounter.map, ...changes } });

  if (!encounter.map) {
    const use = async () => {
      if (!choice) return;
      setBusy(true);
      try {
        const map = await mapFromChoice(choice);
        updateRecord('encounters', encounter.id, { map });
        if (map.image) {
          setTool('lineup');
          toast('Line Up The Grid', { description: 'Drag a box over one square of the map, corner to corner. Esc to skip.' });
        }
      } catch {
        toast.error('That map couldn’t be used', { description: choice.kind === 'library' ? 'It couldn’t be downloaded. Check the connection and try again.' : 'Its picture couldn’t be opened.' });
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-7 pt-6 pb-10">
          <header className="flex flex-col gap-1">
            <h2 className="font-display text-2xl leading-tight font-black uppercase">Prepare The Map</h2>
            <p className="text-[13px] text-muted-foreground">The map this fight happens on. Then place the combatants and set the fog; a scene made from this encounter in Play starts from all of it.</p>
          </header>
          <MapSourcePicker onChoice={(c) => setChoice(c)} />
          <div className="flex justify-end">
            <Button disabled={!choice || busy} onClick={() => void use()}>
              <MapIcon /> {busy ? 'Getting It Ready…' : 'Use This Map'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const board = { ...encounter.map, id: encounter.id, worldId: encounter.worldId, name: encounter.name || 'Encounter' };
  const picked = views.filter((v) => selected.includes(v.token.id));
  return (
    <div className="flex min-h-0 flex-1">
      <Board board={board} views={views} access={{ gm: true, accountId: currentAccount() }} onMapChange={setMap} encounter={encounter} />
      {picked.length ? (
        <TokenPanel views={picked} grid={encounter.map.grid} people={people} header={<SelectionPicker views={views} mapLabel="The Map (Its Settings)" />} />
      ) : (
        <MapPanel
          map={encounter.map}
          onChange={setMap}
          label="Map settings"
          header={<SelectionPicker views={views} mapLabel="The Map (Its Settings)" />}
          footer={
            <PanelSection title="This Map">
              <Button variant="outline" size="sm" onClick={() => updateRecord('encounters', encounter.id, { map: null })}>
                <MapIcon /> Pick Another Map
              </Button>
              <p className="text-[12px] text-muted-foreground">The placed tokens stay; you can move them onto the new map.</p>
            </PanelSection>
          }
        />
      )}
    </div>
  );
}

/** Tabletop → Encounters → Music: tracks from the Library for this fight; a scene made from it in Play gets them. */
export function EncounterMusic({ encounter }: { encounter: Encounter }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-7 pt-6 pb-10">
        <header className="flex flex-col gap-1">
          <h2 className="font-display text-2xl leading-tight font-black uppercase">Music</h2>
          <p className="text-[13px] text-muted-foreground">Tracks from the Library for this fight. A scene made from this encounter in Play gets them; the one set to play when the scene starts begins with Start.</p>
        </header>
        <MusicPicker music={encounter.music} onChange={(music) => updateRecord('encounters', encounter.id, { music })} />
      </div>
    </div>
  );
}
