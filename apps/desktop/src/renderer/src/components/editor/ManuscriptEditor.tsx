import { filterSuggestionItems, type PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote, type DefaultReactSuggestionItem } from '@blocknote/react';
import { BookOpenIcon, CircleUserIcon, MapPinIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useResolvedTheme } from '@/components/shared/useResolvedTheme';
import { createEntry, updateSceneContent } from '@/lib/actions';
import { useWorldRecords } from '@/lib/hooks';
import type { Entry, EntryKind, Scene } from '@/lib/model';
import { usePreferences } from '@/stores/preferences';
import { schema, type BalladEditor } from './schema';

/** A manuscript needs prose blocks, not media or tables: the slash menu keeps these. */
const SLASH_ITEMS = new Set(['paragraph', 'heading', 'heading_2', 'heading_3', 'quote', 'bullet_list', 'numbered_list', 'check_list', 'page_break']);

const KIND_ICON = { character: CircleUserIcon, place: MapPinIcon, lore: BookOpenIcon } satisfies Record<EntryKind, unknown>;
const KIND_NOUN: Record<EntryKind, string> = { character: 'Character', place: 'Place', lore: 'Lore Entry' };

/**
 * ManuscriptEditor — one scene's prose (BlockNote). Type @ to name a
 * character or place, # for lore (or make a new one on the spot), / for
 * headings, quotes and scene breaks. Saved a moment after you stop typing;
 * the words you add count toward today.
 *
 * Mount it with key={scene.id}: the document is read once, when it mounts.
 */
export function ManuscriptEditor({ scene, worldId }: { scene: Scene; worldId: string }) {
  const theme = useResolvedTheme();
  const font = usePreferences((s) => s.manuscriptFont);
  const entries = useWorldRecords('entries');
  const editor = useCreateBlockNote({
    schema,
    initialContent: scene.content.length ? (scene.content as PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>[]) : undefined,
    placeholders: { emptyDocument: 'Start writing. @ names a character or place, # a piece of lore.', default: '' },
  });

  // Debounced save: one vault write per pause in typing, flushed on unmount.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = () => updateSceneContent(scene.id, editor.document as unknown[]);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        save();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const slashItems = async (query: string) =>
    filterSuggestionItems(
      getDefaultReactSlashMenuItems(editor).filter((item) => SLASH_ITEMS.has((item as { key?: string }).key ?? '')),
      query,
    );

  /** @ (characters and places) or # (lore): the world's entries, then "New … “query”". */
  const mentionItems = (kinds: EntryKind[]) => async (query: string) => {
    const matches: DefaultReactSuggestionItem[] = entries
      .filter((e) => kinds.includes(e.kind) && e.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => {
        const Icon = KIND_ICON[entry.kind];
        return {
          title: entry.name,
          subtext: entry.tagline || undefined,
          icon: <Icon size={16} />,
          onItemClick: () => mention(editor, entry),
        };
      });
    const items = filterSuggestionItems(matches, query).slice(0, 8);
    const name = query.trim();
    if (name) {
      for (const kind of kinds) {
        items.push({
          title: `New ${KIND_NOUN[kind]} “${name}”`,
          icon: <PlusIcon size={16} />,
          onItemClick: () => mention(editor, createEntry(worldId, kind, { name })),
        });
      }
    }
    return items;
  };

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      slashMenu={false}
      className="ballad-editor"
      data-font={font}
      onChange={() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          save();
        }, 350);
      }}
    >
      <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
      <SuggestionMenuController triggerCharacter="@" getItems={mentionItems(['character', 'place'])} />
      <SuggestionMenuController triggerCharacter="#" getItems={mentionItems(['lore'])} />
    </BlockNoteView>
  );
}

function mention(editor: BalladEditor, entry: Entry) {
  editor.insertInlineContent([{ type: 'mention', props: { entryId: entry.id, name: entry.name, kind: entry.kind } }, ' ']);
}
