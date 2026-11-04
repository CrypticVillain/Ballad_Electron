import { LogInIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AccountAvatar } from '@/components/shared/AccountAvatar';
import { Label } from '@/components/shared/bits';
import { Field, FIELD } from '@/components/shared/Field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { accountName, useAccounts } from '@/stores/accounts';
import { useUi } from '@/stores/ui';
import type { Account } from '../../../../shared/ipc';

/**
 * The account dialogs (Overture's), opened from the account menu (the
 * account icon above Settings) and the world menu:
 *
 *   Add        sign in another account (or sign a signed-out one back in)
 *   Settings   an account's name and email, its worlds, Sign Out
 *   Sign Out   confirms; the account's vault stays on this computer
 *
 * Accounts are kept on this computer until sign-in (with a password, and
 * sync) arrives.
 */
export function AccountDialogs() {
  const dialog = useUi((s) => s.account);
  const close = () => useUi.getState().openAccount(null);
  return (
    <>
      <AddAccount open={dialog?.kind === 'add'} onClose={close} />
      <AccountSettings id={dialog?.kind === 'settings' ? dialog.id : null} onClose={close} />
      <SignOut id={dialog?.kind === 'signOut' ? dialog.id : null} onClose={close} />
    </>
  );
}

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function AddAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAccounts((s) => s.accounts);
  const signedOut = accounts.filter((a) => !a.signedIn);
  const [draft, setDraft] = useState({ name: '', email: '' });
  const [starter, setStarter] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setDraft({ name: '', email: '' });
    setStarter(false);
    setBusy(false);
  }, [open]);

  const taken = accounts.some((a) => a.signedIn && a.email && a.email === draft.email.trim().toLowerCase());
  const ready = validEmail(draft.email) && !taken && !busy;
  const add = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await useAccounts.getState().addAccount(draft, starter);
    } catch (error) {
      setBusy(false);
      toast.error('Couldn’t add the account', { description: String(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add Another Account</DialogTitle>
          <DialogDescription>Each account has its own worlds, and you can stay signed in to several at once. Accounts are kept on this computer until sign-in with a password arrives.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Field label="Email">
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="you@example.com" maxLength={120} className={FIELD} autoFocus />
          </Field>
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Optional" maxLength={60} className={FIELD} />
          </Field>
          <UiLabel className="flex items-center justify-between gap-4 rounded-xl border p-3 font-normal">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Start With The Sample World</span>
              <span className="text-[13px] text-muted-foreground">The Glass Archipelago, to look around. Off: one empty world.</span>
            </span>
            <Switch checked={starter} onCheckedChange={setStarter} aria-label="Start with the sample world" />
          </UiLabel>
          {taken && <p className="text-[13px] text-destructive">That account is already signed in.</p>}
          {signedOut.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Signed Out On This Computer</Label>
              {signedOut.map((account) => (
                <div key={account.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  <AccountAvatar account={account} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{accountName(account)}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{account.email || 'No email'}</span>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void useAccounts.getState().signIn(account.id)}>
                    <LogInIcon /> Sign In
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              Add Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountSettings({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { accounts, worlds } = useAccounts();
  const account = accounts.find((a) => a.id === id);
  const [draft, setDraft] = useState({ name: '', email: '' });
  useEffect(() => {
    if (!id) return;
    if (account) setDraft({ name: account.name, email: account.email });
    void useAccounts.getState().refreshWorlds();
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const owned = worlds.find((w) => w.accountId === id)?.worlds ?? [];
  const signedIn = accounts.filter((a) => a.signedIn).length;
  const taken = draft.email.trim() !== '' && accounts.some((a) => a.id !== id && a.email === draft.email.trim().toLowerCase());
  const valid = !taken && (draft.email.trim() === '' || validEmail(draft.email));

  const save = async () => {
    if (!account || !valid) return;
    await useAccounts.getState().updateAccount(account.id, draft);
    onClose();
  };

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>Your name and email for this account.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-3">
            <AccountAvatar account={draft} current className="size-12 text-base" />
            <div className="min-w-0">
              <p className="truncate font-medium">{accountName(draft)}</p>
              <p className="truncate text-[13px] text-muted-foreground">{draft.email || 'No email yet'}</p>
            </div>
          </div>
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={accountName({ name: '', email: draft.email })} maxLength={60} className={FIELD} autoFocus />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="you@example.com" maxLength={120} className={FIELD} />
          </Field>
          {taken && <p className="text-[13px] text-destructive">Another account on this computer uses that email.</p>}
          <div className="flex flex-col gap-1.5">
            <Label>{owned.length === 1 ? '1 World' : `${owned.length} Worlds`}</Label>
            <p className="text-[13px] text-muted-foreground">{owned.map((w) => w.name || 'Untitled World').join(' · ') || 'None yet'}</p>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" className="text-destructive" disabled={signedIn < 2} onClick={() => account && useUi.getState().openAccount({ kind: 'signOut', id: account.id })}>
              Sign Out
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignOut({ id, onClose }: { id: string | null; onClose: () => void }) {
  const accounts = useAccounts((s) => s.accounts);
  const account: Account | undefined = accounts.find((a) => a.id === id);
  return (
    <AlertDialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Sign Out Of {accountName(account)}?</AlertDialogTitle>
          <AlertDialogDescription>Its worlds stay on this computer, hidden until you sign back in from Add Another Account. Your other accounts stay signed in.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={() => id && void useAccounts.getState().signOut(id)}>
              Sign Out
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
