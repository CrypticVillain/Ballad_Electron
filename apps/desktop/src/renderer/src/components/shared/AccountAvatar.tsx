import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/text';
import { cn } from '@/lib/utils';
import { accountName } from '@/stores/accounts';
import type { Account } from '../../../../shared/ipc';

/** An account's initials in a circle (shadcn's Avatar): the current account in the accent color, others muted. */
export function AccountAvatar({ account, current = false, className }: { account: Pick<Account, 'name' | 'email'> | undefined; current?: boolean; className?: string }) {
  return (
    <Avatar className={cn('size-8 text-[12px]', className)}>
      {/* text-[length:inherit]: the size set on the Avatar (className) wins over the fallback's own. */}
      <AvatarFallback className={cn('font-mono text-[length:inherit] font-semibold', current ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
        {initials(accountName(account))}
      </AvatarFallback>
    </Avatar>
  );
}
