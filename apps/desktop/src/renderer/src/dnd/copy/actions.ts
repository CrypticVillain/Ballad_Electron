import { openWorld, startBook, trashWorld } from '@/lib/actions';
import { live } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { copyCampaign, type CopyPlan } from './copy';

/**
 * D&D → Copy Campaign: makes the copy (copy.ts) in one change to the vault,
 * and opens it. A copy with no sessions picked still gets an empty session
 * log, as a new campaign does. Returns how to take it back.
 */
export function copyCampaignNow(sourceId: string, plan: CopyPlan) {
  const { vault, world, copied } = copyCampaign(useVault.getState().vault, sourceId, plan);
  useVault.getState().replace(vault);
  if (!live(vault.books).some((b) => b.worldId === world.id)) startBook(world.id);
  openWorld(world.id);
  const undo = () => {
    trashWorld(world.id);
    openWorld(sourceId);
  };
  return { world, copied, undo };
}
