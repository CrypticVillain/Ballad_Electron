/**
 * focus.ts — whether this run of the app keeps out of the way.
 *
 * A test's windows never take the focus from what you're doing: they open
 * without being activated, can't be (Windows hands the focus to the next
 * window down when the one you're using closes, and that mustn't be a
 * test's), and nothing brings them forward (window.ts, table.ts). That's the
 * default for any run started by an automation tool: Playwright starts the
 * app with --remote-debugging-port, a launch of your own never has it. So no
 * test, script or one-off check has to remember a flag.
 *
 *   --no-focus   the same for any other run (the end-to-end launcher passes it too)
 *   --focus      a test's windows take the focus as the app's own do (to watch one, or type into it yourself)
 */

const has = (argv: string[], name: string) => argv.some((a) => a === name || a.startsWith(`${name}=`));

/** Started by an automation tool (a test), whatever launched it. */
export const automated = (argv: string[]) => has(argv, '--remote-debugging-port');

/** Whether the app's windows stay out of the focus for these arguments. */
export const noFocus = (argv: string[]) => !has(argv, '--focus') && (has(argv, '--no-focus') || automated(argv));
