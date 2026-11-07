import { filterSuggestionItems, type PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote, type DefaultReactSuggestionItem } from '@blocknote/react';
import { BookOpenIcon, CircleUserIcon, ClapperboardIcon, ContactIcon, MapPinIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useResolvedTheme } from '@/components/shared/useResolvedTheme';
import { createEntry, updateSceneContent } from '@/lib/actions';
import type { Entry, EntryKind, Scene, Section } from '@/lib/model';
import { kindInfo } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { schema, SCREENPLAY, SCREENPLAY_LABEL, SCREENPLAY_NEXT, type BalladEditor, type ScreenplayElement } from './schema';
import { DualToggle, ScriptAssist, type ScriptAssistHandle } from '@/film/script/ScriptAssist';
import { useWorldEntries } from '@/lib/shared';
import { editPending, editSaved } from '@/lib/idle';

/** A manuscript needs prose blocks, not media or tables: the slash menu keeps these. */
const SLASH_ITEMS = new Set(['paragraph', 'heading', 'heading_2', 'heading_3', 'quote', 'bullet_list', 'numbered_list', 'check_list', 'page_break']);

const KIND_ICON: Record<EntryKind, typeof CircleUserIcon> = { character: CircleUserIcon, place: MapPinIcon, lore: BookOpenIcon, crew: ContactIcon };

/** What @ and # name in each section. */
const TRIGGERS: Record<Section, { at: EntryKind[]; hash: EntryKind[] }> = {
  writing: { at: ['character', 'place'], hash: ['lore'] },
  film: { at: ['character', 'crew', 'place'], hash: [] },
  tabletop: { at: ['character', 'place'], hash: ['lore'] },
  play: { at: ['character', 'place'], hash: ['lore'] },
};

const PLACEHOLDER: Record<Section, string> = {
  writing: 'Start writing. @ names a character or place, # a piece of lore.',
  film: 'Start with a scene heading (INT. KITCHEN - NIGHT). Tab changes the element; @ names cast, crew or a location.',
  tabletop: 'What happened at the table? @ names an NPC or place, # a piece of lore.',
  play: 'What happened at the table? @ names an NPC or place, # a piece of lore.',
};

const isElement = (type: string): type is ScreenplayElement => (SCREENPLAY as readonly string[]).includes(type);

/** Whether the caret is at the very end of its block's text (so Enter would start a new block, not split this one). */
function caretAtEnd(): boolean {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const node = range.endContainer;
  const inline = (node instanceof Element ? node : node.parentElement)?.closest('.bn-inline-content');
  if (!inline) return false;
  const rest = document.createRange();
  rest.setStart(range.endContainer, range.endOffset);
  rest.setEnd(inline, inline.childNodes.length);
  return rest.toString().length === 0;
}

/**
 * ManuscriptEditor — one scene's text (BlockNote): a manuscript's prose, a
 * script's screenplay, a session's notes. Type @ to name a character or
 * place (in a script: cast, crew or a location), # for lore, or make a new
 * one on the spot; / for headings, quotes and breaks.
 *
 * In a script (`section` film) the screenplay elements come first: the bar
 * above picks one, Tab and Shift+Tab step through them, and Enter at the end
 * of one starts the usual next one (Character → Dialogue → Action).
 *
 * Saved a moment after you stop typing; the words you add count toward today.
 * Mount it with key={scene.id}: the document is read once, when it mounts.
 * `placeholder`: what an empty one says (a Tabletop note's, by its category).
 */
export function ManuscriptEditor({ scene, worldId, section, placeholder }: { scene: Scene; worldId: string; section: Section; placeholder?: string }) {
  const theme = useResolvedTheme();
  const font = usePreferences((s) => s.manuscriptFont);
  // @ and # name what you can see: a player, what's shared with them.
  const entries = useWorldEntries();
  const script = section === 'film';
  const editor = useCreateBlockNote({
    schema,
    initialContent: scene.content.length
      ? (scene.content as PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>[])
      : script
        ? [{ type: 'sceneHeading' }]
        : undefined,
    placeholders: { emptyDocument: placeholder ?? PLACEHOLDER[section], default: '' },
  });
  const [current, setCurrent] = useState<string>('paragraph');
  // A script's autocomplete (film/script): it takes Tab, arrows and Enter while it's showing.
  const assist = useRef<ScriptAssistHandle>(null);

  // Debounced save: one vault write per pause in typing, flushed on unmount.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = () => updateSceneContent(scene.id, editor.document as unknown[]);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        save();
        editSaved();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setElement = (type: ScreenplayElement) => {
    const block = editor.getTextCursorPosition().block;
    editor.updateBlock(block, { type } as never);
    setCurrent(type);
    editor.focus();
  };

  /** A script's keys: Tab / Shift+Tab step through the elements; Enter at an element's end starts the next one. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!script || event.ctrlKey || event.metaKey || event.altKey) return;
    if (assist.current?.onKey(event)) return;
    if (document.querySelector('.bn-suggestion-menu')) return;
    const block = editor.getTextCursorPosition().block;
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const index = isElement(block.type) ? SCREENPLAY.indexOf(block.type) : -1;
      const next = index < 0 ? 'action' : SCREENPLAY[(index + (event.shiftKey ? -1 : 1) + SCREENPLAY.length) % SCREENPLAY.length]!;
      setElement(next);
    } else if (event.key === 'Enter' && !event.shiftKey && isElement(block.type) && caretAtEnd()) {
      event.preventDefault();
      event.stopPropagation();
      // An empty element (Enter twice) turns back into Action, as screenwriting apps do.
      const empty = Array.isArray(block.content) && block.content.length === 0;
      if (empty && block.type !== 'action') {
        setElement('action');
        return;
      }
      const type = SCREENPLAY_NEXT[block.type];
      const [inserted] = editor.insertBlocks([{ type } as never], block, 'after');
      if (inserted) editor.setTextCursorPosition(inserted, 'start');
      setCurrent(type);
    }
  };

  const screenplayItems = (): DefaultReactSuggestionItem[] =>
    SCREENPLAY.map((type) => ({
      title: SCREENPLAY_LABEL[type],
      group: 'Screenplay',
      icon: <ClapperboardIcon size={18} />,
      onItemClick: () => setElement(type),
    }));

  const slashItems = async (query: string) =>
    filterSuggestionItems(
      [...(script ? screenplayItems() : []), ...getDefaultReactSlashMenuItems(editor).filter((item) => SLASH_ITEMS.has((item as { key?: string }).key ?? ''))],
      query,
    );

  /** @ or #: the world's entries of those kinds, then "New … “query”". */
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
          title: `New ${kindInfo(kind, section).singular} “${name}”`,
          icon: <PlusIcon size={16} />,
          onItemClick: () => mention(editor, createEntry(worldId, kind, { name })),
        });
      }
    }
    return items;
  };

  const triggers = TRIGGERS[section];

  return (
    <div onKeyDownCapture={onKeyDown}>
      {script && (
        <div role="toolbar" aria-label="Screenplay element" className="sticky top-0 z-10 mb-3 flex flex-wrap gap-1 bg-background px-[54px] py-2">
          {SCREENPLAY.map((type) => (
            <button
              key={type}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setElement(type)}
              aria-pressed={current === type}
              className={cn(
                'h-[26px] rounded-full border px-2.5 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase hover:text-foreground',
                current === type && 'border-foreground bg-foreground text-background hover:text-background',
              )}
            >
              {SCREENPLAY_LABEL[type]}
            </button>
          ))}
          <DualToggle editor={editor} current={current} />
          <span className="ml-auto self-center font-mono text-[10.5px] text-muted-foreground">Tab · Shift+Tab</span>
        </div>
      )}
      <BlockNoteView
        editor={editor}
        theme={theme}
        slashMenu={false}
        className="ballad-editor"
        data-font={font}
        data-script={script ? '' : undefined}
        onSelectionChange={() => setCurrent(editor.getTextCursorPosition().block.type)}
        onChange={() => {
          if (timer.current) clearTimeout(timer.current);
          else editPending();
          timer.current = setTimeout(() => {
            timer.current = null;
            save();
            editSaved();
          }, 350);
        }}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
        <SuggestionMenuController triggerCharacter="@" getItems={mentionItems(triggers.at)} />
        {triggers.hash.length > 0 && <SuggestionMenuController triggerCharacter="#" getItems={mentionItems(triggers.hash)} />}
      </BlockNoteView>
      {script && <ScriptAssist editor={editor} ref={assist} />}
    </div>
  );
}

function mention(editor: BalladEditor, entry: Entry) {
  editor.insertInlineContent([{ type: 'mention', props: { entryId: entry.id, name: entry.name, kind: entry.kind } }, ' ']);
}
