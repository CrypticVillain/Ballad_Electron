/**
 * export.ts — a world's books as one Markdown file (Settings → Data): each
 * book a title, each part a heading, scenes in order with a break between
 * them (a D&D book's notes after them). Mentions come out as plain names.
 */
import { byOrder, live } from '@/lib/model';
import { roman } from '@/lib/text';
import { useVault } from '@/stores/vault';

export function exportMarkdown(worldId: string): string {
  const vault = useVault.getState().vault;
  const world = vault.worlds[worldId];
  const books = live(vault.books).filter((b) => b.worldId === worldId).sort(byOrder);
  const out: string[] = [];
  if (world && books.length !== 1) out.push(`# ${world.name}`, '');
  for (const book of books) {
    out.push(`${books.length === 1 ? '#' : '##'} ${book.title || 'Untitled Book'}`, '');
    const parts = live(vault.parts).filter((p) => p.bookId === book.id).sort(byOrder);
    parts.forEach((part, i) => {
      out.push(`${books.length === 1 ? '##' : '###'} ${book.partNoun} ${roman(i + 1)}${part.title ? `: ${part.title}` : ''}`, '');
      const scenes = live(vault.scenes).filter((s) => s.partId === part.id).sort(byOrder);
      scenes.forEach((scene, j) => {
        if (j > 0) out.push('* * *', '');
        if (scene.title) out.push(`*${scene.title}*`, '');
        if (scene.text) out.push(scene.text.split('\n').filter(Boolean).join('\n\n'), '');
      });
    });
    // A D&D book's notes, after its sessions.
    const notes = live(vault.scenes).filter((s) => s.bookId === book.id && s.kind === 'note').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (notes.length) out.push(`${books.length === 1 ? '##' : '###'} Notes`, '');
    for (const note of notes) {
      out.push(`**${note.title || 'Untitled Note'}**`, '');
      if (note.text) out.push(note.text.split('\n').filter(Boolean).join('\n\n'), '');
      for (const item of note.checklist ?? []) out.push(`- [${item.done ? 'x' : ' '}] ${item.text}`);
      if (note.checklist?.length) out.push('');
    }
  }
  return out.join('\n').trim() + '\n';
}
