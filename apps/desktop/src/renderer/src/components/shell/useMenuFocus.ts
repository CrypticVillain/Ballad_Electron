import { useRef } from 'react';

/**
 * useMenuFocus — for the rail's menus (world, account). A Radix menu hands
 * focus back to its trigger when it closes, which lights the trigger's focus
 * ring (and opens its tooltip) as if it were still hovered. That's right
 * after using the keyboard, but not after the mouse: opened with a click,
 * the trigger is left alone when the menu closes. (Overture's.)
 */
export function useMenuFocus() {
  const byPointer = useRef(false);
  return {
    trigger: {
      onPointerDown: () => (byPointer.current = true),
      onKeyDown: () => (byPointer.current = false),
    },
    content: {
      onCloseAutoFocus: (event: Event) => {
        if (byPointer.current) event.preventDefault();
      },
    },
  };
}
