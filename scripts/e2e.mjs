#!/usr/bin/env node
/**
 * e2e.mjs — runs the end-to-end tests (apps/desktop/e2e/*.e2e.ts): builds the
 * app once, then runs the test files side by side (each launches its own copy
 * of the app under its own profile; see e2e/app.ts).
 *
 *   npm run test:e2e                    every file
 *   npm run test:e2e -- tabletop names  the files whose names contain "tabletop" or "names"
 *   npm run test:e2e:changed            the files that cover what you've changed
 *   npm run test:e2e:changed -- --list  …just say which, and why
 *
 * --changed looks at what differs from the last commit (staged, unstaged and
 * new files; --since <ref> compares with another, like origin/main) and maps
 * each changed file to the test files that exercise it (AREAS below). A
 * change to something every screen uses (the vault, the model, the main
 * process, the test launcher) runs everything; docs and unit tests run none.
 *
 * Files that change something the whole computer shares (SERIAL; none yet,
 * Overture's app icon is one) run on their own, after the rest.
 *
 *   --workers <n>   how many files at once (BALLAD_E2E_WORKERS; default 6)
 *   --no-build      use the last build (out/) as it is
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(ROOT, 'apps/desktop/e2e');
const ALL = readdirSync(E2E)
  .filter((f) => f.endsWith('.e2e.ts'))
  .map((f) => f.replace(/\.e2e\.ts$/, ''))
  .sort();

/**
 * What each part of the code is covered by. A path (relative to the repo)
 * matching `when` runs `files` (e2e names without .e2e.ts; '*' is all of
 * them). Every rule that matches counts; a renderer file no rule matches runs
 * SMOKE.
 */
const SMOKE = ['core', 'modules'];
const SERIAL = [];
const AREAS = [
  // Docs, unit tests and tooling: no end-to-end run.
  { when: /(\.md$|\.test\.ts$|^eslint\.config|^\.claude\/|^\.gitignore$|^scripts\/(?!e2e\.mjs))/, files: [] },
  // Everything goes through these.
  { when: /^(package(-lock)?\.json|apps\/desktop\/package\.json|apps\/desktop\/electron\.vite\.config|apps\/desktop\/e2e\/(app|fixtures)\.ts|scripts\/e2e\.mjs)/, files: ['*'] },
  { when: /^apps\/desktop\/src\/(main|preload|shared)\//, files: ['*'] },
  { when: /src\/renderer\/src\/(stores\/vault|lib\/(model|migrate|actions|hooks|seed|seedSections|seedMap|sections|idle|layout|shared|snapshots)|main\.tsx|router\.tsx)/, files: ['*'] },
  // A test file covers itself.
  { when: /^apps\/desktop\/e2e\/([\w-]+)\.e2e\.ts$/, files: (m) => [m[1]] },
  // The shell: rail, world menu, status bar, sidebars, dialogs.
  { when: /components\/shell\/(Spaces|layouts)|components\/dialogs\/ManageLayout/, files: ['bible', 'maps', 'sharing', 'settings'] },
  { when: /components\/shell\/|components\/shared\/HistoryArrows/, files: ['core', 'modules', 'settings'] },
  { when: /components\/dialogs\/(Settings|Help|Account)|stores\/(preferences|ui|accounts)|components\/shared\/TimeField|lib\/dates/, files: ['settings'] },
  { when: /components\/dialogs\/(Search|New|World)/, files: ['core'] },
  // Sharing between the GM and players.
  { when: /components\/tabletop\/Sharing/, files: ['sharing'] },
  // The manuscript and its editor (Writing's manuscript, Tabletop's sessions and journal, film's script).
  { when: /components\/editor\/|screens\/manuscript\/|writing\/manuscript\/|lib\/text/, files: ['manuscript', 'film'] },
  // Entries: characters, places, lore, NPCs, cast, crew, locations.
  { when: /screens\/bible\/|writing\/lore\//, files: ['bible', 'sharing'] },
  { when: /screens\/maps\/|writing\/maps\//, files: ['maps', 'writing'] },
  { when: /names\//, files: ['names'] },
  { when: /writing\//, files: ['writing'] },
  { when: /screens\/(timeline|home)\//, files: ['writing', 'core'] },
  { when: /film\/|lib\/film/, files: ['film'] },
  { when: /screens\/(tabletop|library)\/|components\/tabletop\/|tabletop\/|lib\/(tabletop|dice|encounterMath|compendium|library)/, files: ['tabletop'] },
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const workers = Number(option('--workers') ?? process.env.BALLAD_E2E_WORKERS ?? 6) || 6;
const names = args.filter((a, i) => !a.startsWith('--') && !['--workers', '--since'].includes(args[i - 1] ?? ''));

/** The files changed since `ref` (default: the last commit), with new ones. */
function changedFiles(ref) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  return [...new Set([...git('diff', '--name-only', ref ?? 'HEAD'), ...git('ls-files', '--others', '--exclude-standard')])];
}

function pick() {
  if (flag('--changed')) {
    const changed = changedFiles(option('--since'));
    const chosen = new Set();
    const why = [];
    for (const file of changed) {
      const hits = AREAS.map((a) => [a, file.match(a.when)]).filter(([, m]) => m);
      let files = hits.flatMap(([a, m]) => (typeof a.files === 'function' ? a.files(m) : a.files));
      if (!hits.length) files = file.startsWith('apps/desktop/src/renderer/') ? SMOKE : [];
      const list = files.includes('*') ? ALL : files.filter((f) => ALL.includes(f));
      list.forEach((f) => chosen.add(f));
      why.push(`  ${file}  →  ${files.includes('*') ? 'everything' : list.join(', ') || 'none'}`);
    }
    console.log(changed.length ? `Changed:\n${why.join('\n')}` : 'Nothing has changed since the last commit.');
    return [...chosen].sort();
  }
  if (!names.length) return ALL;
  const matched = ALL.filter((f) => names.some((n) => f.includes(n)));
  if (!matched.length) {
    console.error(`No e2e files match ${names.join(', ')}. There are: ${ALL.join(', ')}`);
    process.exit(1);
  }
  return matched;
}

const files = pick();
if (!files.length) {
  console.log('No end-to-end tests to run.');
  process.exit(0);
}
console.log(`\nEnd-to-end: ${files.length === ALL.length ? 'every file' : files.join(', ')} (${Math.min(workers, files.length)} at a time)\n`);
if (flag('--list')) process.exit(0);

const run = (cmd, cmdArgs) =>
  new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => resolve(code ?? 1));
  });

if (!flag('--no-build') || !existsSync(path.join(ROOT, 'apps/desktop/out/main'))) {
  const built = await run('npm', ['run', 'build', '--silent']);
  if (built !== 0) process.exit(built);
}
const started = Date.now();
const paths = (list) => list.map((f) => `apps/desktop/e2e/${f}.e2e.ts`);
const together = files.filter((f) => !SERIAL.includes(f));
const alone = files.filter((f) => SERIAL.includes(f));
let code = together.length ? await run('npx', ['tsx', '--test', `--test-concurrency=${workers}`, ...paths(together)]) : 0;
if (alone.length) {
  console.log(`\nOn their own: ${alone.join(', ')}\n`);
  code = (await run('npx', ['tsx', '--test', '--test-concurrency=1', ...paths(alone)])) || code;
}
console.log(`\nEnd-to-end took ${Math.round((Date.now() - started) / 1000)}s.`);
process.exit(code);
