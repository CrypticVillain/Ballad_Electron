/**
 * schema.tsx — the manuscript editor's schema: BlockNote's default blocks,
 * the screenplay elements (Filmmaking's scripts) and one inline type:
 *
 *   sceneHeading, action, character, parenthetical, dialogue, transition
 *             a screenplay's elements, laid out as on the page (styles/globals.css .sp-*)
 *   mention   a character, place, crew member or lore entry named in the text
 *             (type @ or #). Mentions feed a scene's "In This Scene" and an
 *             entry's "Appears In".
 */
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react';
import { useWorldEntry } from '@/lib/shared';

function MentionChip({ entryId, name }: { entryId: string; name: string }) {
  // As you see it: a player, the version shared with them (or none, if it isn't).
  const entry = useWorldEntry(entryId);
  if (!entry) {
    return (
      <span className="mention" data-missing contentEditable={false}>
        {name || 'Deleted Entry'}
      </span>
    );
  }
  return (
    <a href={`#/bible/${entry.kind}/${entry.id}`} className="mention" data-kind={entry.kind} contentEditable={false}>
      {entry.name || 'Untitled'}
    </a>
  );
}

const Mention = createReactInlineContentSpec(
  { type: 'mention', propSchema: { entryId: { default: '' }, name: { default: '' }, kind: { default: 'character' } }, content: 'none' },
  { render: ({ inlineContent }) => <MentionChip entryId={inlineContent.props.entryId} name={inlineContent.props.name} /> },
);

/** The screenplay elements, in the order Tab steps through them. */
export const SCREENPLAY = ['sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'] as const;
export type ScreenplayElement = (typeof SCREENPLAY)[number];

export const SCREENPLAY_LABEL: Record<ScreenplayElement, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
};

/** What Enter at the end of an element starts next (a character's line of dialogue, and so on). */
export const SCREENPLAY_NEXT: Record<ScreenplayElement, ScreenplayElement> = {
  sceneHeading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'sceneHeading',
};

const element = (type: ScreenplayElement) =>
  createReactBlockSpec(
    { type, propSchema: {}, content: 'inline' },
    { render: ({ contentRef }) => <div ref={contentRef} className={`sp sp-${type}`} /> },
  )();

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    sceneHeading: element('sceneHeading'),
    action: element('action'),
    character: element('character'),
    dialogue: element('dialogue'),
    parenthetical: element('parenthetical'),
    transition: element('transition'),
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: Mention },
});

export type BalladEditor = typeof schema.BlockNoteEditor;
