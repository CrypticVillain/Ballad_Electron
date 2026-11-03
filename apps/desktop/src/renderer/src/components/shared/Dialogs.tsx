import { NewWorldDialog } from '@/components/dialogs/NewWorldDialog';
import { SearchDialog } from '@/components/dialogs/SearchDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';

/** Every app-wide dialog, mounted once in the shell; stores/ui.ts opens them. */
export function Dialogs() {
  return (
    <>
      <SearchDialog />
      <SettingsDialog />
      <NewWorldDialog />
    </>
  );
}
