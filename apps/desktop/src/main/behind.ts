/**
 * behind.ts — a test's windows open at the bottom of the pile (Windows).
 *
 * Under a test's run (focus.ts) the app's windows are shown without being
 * activated, but Windows still puts a newly shown window on top of every
 * other one, so the test windows would cover what you're doing. Here each is
 * put at the bottom of the pile before it's shown (Overture's --window-behind
 * does the same), so it never comes up over anything.
 *
 * Electron can't do that, so one PowerShell asks Windows to
 * (SetWindowPos(HWND_BOTTOM)). It starts with the app and keeps running, so
 * the slow part (PowerShell starting and compiling the call) happens while
 * the first window loads, and each window after costs a few milliseconds.
 * Elsewhere, or if PowerShell can't be reached, the window is shown at once,
 * on top but still without the focus.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import type { BrowserWindow } from 'electron';

/** HWND_BOTTOM (1); SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE (0x13). Reads window handles, one a line, and says each back once it's done. */
const SCRIPT = `
$w = Add-Type -Name Win -Namespace BalladBehind -PassThru -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);'
while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ($line -match '^\\d+$') { [void]$w::SetWindowPos([IntPtr][Int64]$line, [IntPtr]1, 0, 0, 0, 0, 0x13) }
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
}
`;

/** How long a window waits for PowerShell before it's shown anyway. */
const PATIENCE_MS = 8_000;

let helper: ChildProcess | null = null;
let failed = false;
const waiting = new Map<string, Array<() => void>>();

const settle = (hwnd: string) => {
  const list = waiting.get(hwnd);
  waiting.delete(hwnd);
  list?.forEach((done) => done());
};

const giveUp = () => {
  failed = true;
  helper = null;
  for (const hwnd of [...waiting.keys()]) settle(hwnd);
};

/** Starts the helper (Windows only); called as the app starts, under a test's run. */
export function startBehind(): void {
  if (process.platform !== 'win32' || helper || failed) return;
  try {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let buffered = '';
    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      buffered += chunk;
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? '';
      lines.forEach((line) => settle(line.trim()));
    });
    child.on('error', giveUp);
    child.on('exit', giveUp);
    child.stdin!.on('error', giveUp);
    // It doesn't keep the app running; it ends when the app does (its input closes).
    child.unref();
    helper = child;
  } catch {
    giveUp();
  }
}

/** The window's handle, as a number in a string. */
function handleOf(window: BrowserWindow): string {
  const h = window.getNativeWindowHandle();
  return (h.length >= 8 ? h.readBigUInt64LE(0) : BigInt(h.readUInt32LE(0))).toString();
}

/** Puts a window that isn't shown yet at the bottom of the pile, then calls `then` (at once where that can't be done). */
export function toBottom(window: BrowserWindow, then: () => void): void {
  if (!helper || failed || window.isDestroyed()) return then();
  let called = false;
  const once = () => {
    if (called) return;
    called = true;
    clearTimeout(timer);
    then();
  };
  const timer = setTimeout(once, PATIENCE_MS);
  const hwnd = handleOf(window);
  waiting.set(hwnd, [...(waiting.get(hwnd) ?? []), once]);
  helper.stdin!.write(`${hwnd}\n`);
}
