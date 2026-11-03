/**
 * schema.tsx — the manuscript editor's schema: BlockNote's default blocks
 * plus one inline type:
 *
 *   mention   a character, place or lore entry named in the prose (type @ or #).
 *             Mentions feed a scene's "In This Scene" and an entry's "Appears In".
 */
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import { useRecord } from '@/lib/hooks';

function MentionChip({ entryId, name }: { entryId: string; name: string }) {
  const entry = useRecord('entries', entryId);
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

export const schema = BlockNoteSchema.create({
  blockSpecs: defaultBlockSpecs,
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: Mention },
});

export type BalladEditor = typeof schema.BlockNoteEditor;
