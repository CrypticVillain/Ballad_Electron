import { openWorld, startBook, trashWorld } from '@/lib/actions';
import { byOrder, live } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { createSequel, nextBookTitle, type SequelPlan } from './sequel';

/**
 * Copy World (Writing) and Create A Sequel (Filmmaking): makes it (sequel.ts) in one change to the vault, and
 * opens it. A sequel with no scenes picked starts a new book ("Book Two")
 * or a new script, as a new world does; arcs whose book stayed behind
 * follow its first book. Returns how to take it back.
 */
export function createSequelNow(sourceId: string, plan: SequelPlan) {
  const before = useVault.getState().vault;
  const { vault, world, copied } = createSequel(before, sourceId, plan);
  useVault.getState().replace(vault);
  if (!live(vault.books).some((b) => b.worldId === world.id)) startBook(world.id, world.section === 'writing' ? { title: nextBookTitle(before, sourceId) } : {});
  const after = useVault.getState().vault;
  const first = live(after.books)
    .filter((b) => b.worldId === world.id)
    .sort(byOrder)[0];
  for (const arc of live(after.arcs).filter((a) => a.worldId === world.id && !a.bookId)) useVault.getState().patch('arcs', arc.id, { bookId: first!.id });
  openWorld(world.id);
  const undo = () => {
    trashWorld(world.id);
    openWorld(sourceId);
  };
  return { world, copied, undo };
}
