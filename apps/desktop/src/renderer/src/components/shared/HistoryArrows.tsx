import { useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { useEffect } from 'react';
import { create } from 'zustand';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';

/**
 * Back and forward through the screens you've visited, like a browser's
 * (Alt+← and Alt+→, and the mouse's back and forward buttons, too), in front
 * of every top bar's breadcrumb. Each is greyed out when there's nowhere to
 * go: going back remembers how far you'd been.
 */
const useFurthest = create<{ furthest: number }>(() => ({ furthest: 0 }));
const indexOf = (state: unknown) => Number((state as { __TSR_index?: number } | undefined)?.__TSR_index ?? 0);

/** Keeps the furthest step forward you could go (a new screen cuts off what was ahead), and the shortcuts. Mounted once, in the app shell. */
export function useHistoryTracking() {
  const router = useRouter();
  useEffect(() => {
    useFurthest.setState({ furthest: indexOf(router.history.location.state) });
    return router.history.subscribe(({ action }) => {
      const index = indexOf(router.history.location.state);
      useFurthest.setState((s) => ({ furthest: action.type === 'PUSH' ? index : Math.max(s.furthest, index) }));
    });
  }, [router]);
  useEffect(() => {
    const back = () => {
      if (indexOf(router.history.location.state) > 0) router.history.back();
    };
    const forward = () => {
      if (useFurthest.getState().furthest > indexOf(router.history.location.state)) router.history.forward();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      if (e.key === 'ArrowLeft') back();
      else forward();
    };
    // The mouse's back and forward buttons.
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        back();
      } else if (e.button === 4) {
        e.preventDefault();
        forward();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mouseup', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mouseup', onMouse);
    };
  }, [router]);
}

export function HistoryArrows() {
  const router = useRouter();
  const canBack = useCanGoBack();
  const index = useRouterState({ select: (s) => indexOf(s.location.state) });
  const canForward = useFurthest((s) => s.furthest > index);
  return (
    <span className="-ml-2 flex shrink-0 items-center">
      <Hint label="Back (Alt+←)">
        <Button variant="ghost" size="icon-sm" aria-label="Back" disabled={!canBack} onClick={() => router.history.back()} className="size-7 text-muted-foreground">
          <ArrowLeftIcon className="size-4" />
        </Button>
      </Hint>
      <Hint label="Forward (Alt+→)">
        <Button variant="ghost" size="icon-sm" aria-label="Forward" disabled={!canForward} onClick={() => router.history.forward()} className="size-7 text-muted-foreground">
          <ArrowRightIcon className="size-4" />
        </Button>
      </Hint>
    </span>
  );
}
