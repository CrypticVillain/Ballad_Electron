import { AccountDialogs } from '@/components/dialogs/AccountDialogs';
import { SearchDialog } from '@/components/dialogs/SearchDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { WorldDialogs } from '@/components/dialogs/WorldDialogs';
import { DiceTray } from '@/components/dnd/DiceTray';
import { ManageLayoutDialog } from '@/components/dialogs/ManageLayoutDialog';
import { ShareDialog, SharedTracker } from '@/components/dnd/Sharing';
import { HelpDialog } from '@/components/dialogs/HelpDialog';
import { NewDialog } from '@/components/dialogs/NewDialog';
import { NewLoreDialog } from '@/writing/lore/LorePanels';

/** Every app-wide dialog, mounted once in the shell; stores/ui.ts opens them. */
export function Dialogs() {
  return (
    <>
      <SearchDialog />
      <SettingsDialog />
      <HelpDialog />
      <WorldDialogs />
      <AccountDialogs />
      <ManageLayoutDialog />
      <ShareDialog />
      <NewDialog />
      <NewLoreDialog />
      <SharedTracker />
      <DiceTray />
    </>
  );
}
