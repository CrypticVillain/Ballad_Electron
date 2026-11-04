import { create } from 'zustand';
import { buttonVariants } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/**
 * Confirm — "Remove Longsword?" before anything is deleted from a character
 * sheet. `confirmDelete` opens the one dialog (ConfirmHost, mounted in the
 * app shell) and resolves true on Remove, false on Cancel or Esc.
 */
type Ask = { title: string; description?: string; action?: string; resolve: (ok: boolean) => void };
const useConfirm = create<{ ask: Ask | null }>(() => ({ ask: null }));

export function confirmDelete(title: string, description?: string, action = 'Remove'): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ ask: { title, description, action, resolve } }));
}

/** Runs `then` once the deletion is confirmed. */
export function afterConfirm(title: string, description: string | undefined, then: () => void, action?: string) {
  void confirmDelete(title, description, action).then((ok) => ok && then());
}

export function ConfirmHost() {
  const ask = useConfirm((s) => s.ask);
  const close = (ok: boolean) => {
    ask?.resolve(ok);
    useConfirm.setState({ ask: null });
  };
  return (
    <AlertDialog open={Boolean(ask)} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
          {ask?.description && <AlertDialogDescription>{ask.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => close(true)}>
            {ask?.action ?? 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
