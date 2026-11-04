import { AccountDialogs } from '@/components/dialogs/AccountDialogs';
import { SearchDialog } from '@/components/dialogs/SearchDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { WorldDialogs } from '@/components/dialogs/WorldDialogs';
import { DiceTray } from '@/components/dnd/DiceTray';
import { ManageLayoutDialog } from '@/components/dialogs/ManageLayoutDialog';
import { ShareDialog, SharedTracker } from '@/components/dnd/Sharing';

/** Every app-wide dialog, mounted once in the shell; stores/ui.ts opens them. */
export function Dialogs() {
  return (
    <>
      <SearchDialog />
      <SettingsDialog />
      <WorldDialogs />
      <AccountDialogs />
      <ManageLayoutDialog />
      <ShareDialog />
      <SharedTracker />
      <DiceTray />
    </>
  );
}
