import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field, FIELD } from '@/components/shared/Field';
import { mediaSrc } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useWorldRecords } from '@/lib/hooks';
import type { Encounter } from '@/lib/model';
import { mapFromChoice, MapSourcePicker, Thumb, Thumbs, type MapChoice } from '@/tabletop/battlemap/MapSourcePicker';
import { createPlayScene, createSceneFromEncounter } from './actions';
import type { PlayScene } from './model';

/**
 * Play → Scenes: New Scene. From an encounter (Tabletop): its prepared map is
 * picked for you, with its placed tokens, fog and music. Or from a map
 * (tabletop/battlemap: your picture, a campaign map, a Library map, blank).
 */
export function NewSceneDialog({ worldId, open, onClose, onCreated }: { worldId: string; open: boolean; onClose: () => void; onCreated: (scene: PlayScene) => void }) {
  const encounters = useWorldRecords('encounters');
  const [name, setName] = useState('');
  const [named, setNamed] = useState(false);
  const [choice, setChoice] = useState<MapChoice | null>(null);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [onEncounterTab, setOnEncounterTab] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setNamed(false);
    setChoice(null);
    setEncounter(null);
    setOnEncounterTab(true);
  }, [open]);

  /** The name follows what's picked, until you type one. */
  const suggest = (n?: string) => !named && n !== undefined && setName(n);
  const ready = onEncounterTab ? Boolean(encounter) : Boolean(choice);

  const create = async () => {
    setBusy(true);
    try {
      const scene = onEncounterTab && encounter ? createSceneFromEncounter(encounter, { name: name.trim() || encounter.name || 'Encounter' }) : createPlayScene(worldId, { name: name.trim() || 'New Scene', ...(await mapFromChoice(choice!)) });
      onCreated(scene);
    } catch {
      toast.error('That scene couldn’t be made', { description: choice?.kind === 'library' ? 'The map couldn’t be downloaded. Check the connection and try again.' : 'Its picture couldn’t be opened.' });
    } finally {
      setBusy(false);
    }
  };

  const encounterTab = (
    <div className="flex flex-col gap-2">
      {encounters.length ? (
        <Thumbs>
          {[...encounters]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((e) => (
              <Thumb
                key={e.id}
                src={e.map?.image ? mediaSrc(e.map.image) : undefined}
                title={e.name || 'Untitled Encounter'}
                note={e.map ? `${e.combatants.length} in it` : 'No map'}
                picked={encounter?.id === e.id}
                onPick={() => {
                  setEncounter(e);
                  suggest(e.name);
                }}
              />
            ))}
        </Thumbs>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No encounters yet. Build one in Tabletop (Encounters), with its map and music, then make its scene here.</p>
      )}
      <p className="text-xs text-muted-foreground">The encounter’s map is used, with its tokens as placed, its fog and its music. One without a map starts blank.</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-64px)] flex-col sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase">New Scene</DialogTitle>
          <DialogDescription>A map to play on: from an encounter you prepared, or a map of its own.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Field label="Name">
            <Input
              value={name}
              placeholder="The Drowned Crypt"
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                setNamed(Boolean(e.target.value));
              }}
              className={FIELD}
            />
          </Field>
          <MapSourcePicker
            extra={{ label: 'Encounter', render: encounterTab, onSelect: () => setOnEncounterTab(true) }}
            onChoice={(c, n) => {
              setOnEncounterTab(false);
              setChoice(c);
              suggest(n);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready || busy} onClick={() => void create()}>
            {busy ? 'Making…' : 'Create Scene'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
