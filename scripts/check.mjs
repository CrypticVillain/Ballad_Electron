#!/usr/bin/env node
/**
 * check.mjs — every quick check at once (npm run check): TypeScript (main,
 * renderer and the end-to-end tests), ESLint and the unit tests run side by
 * side, then one summary.
 * Nothing is skipped; it's faster only because the steps overlap and
 * TypeScript and ESLint reuse what they worked out last time (their caches
 * are in *.tsbuildinfo and node_modules/.cache/eslint).
 *
 * Exits 1 if anything failed, printing that step's output. The end-to-end
 * tests need a build and are separate (npm run test:e2e, or :changed).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = [
  { name: 'TypeScript (main)', cmd: 'npx tsc --noEmit -p apps/desktop/tsconfig.node.json', summary: (out, ok) => (ok ? 'no errors' : `${(out.match(/error TS/g) ?? []).length} errors`) },
  { name: 'TypeScript (renderer)', cmd: 'npx tsc --noEmit -p apps/desktop/tsconfig.web.json', summary: (out, ok) => (ok ? 'no errors' : `${(out.match(/error TS/g) ?? []).length} errors`) },
  { name: 'TypeScript (e2e)', cmd: 'npx tsc -p apps/desktop/tsconfig.e2e.json', summary: (out, ok) => (ok ? 'no errors' : `${(out.match(/error TS/g) ?? []).length} errors`) },
  {
    name: 'ESLint',
    cmd: 'npx eslint . --cache --cache-location node_modules/.cache/eslint/',
    summary: (out, ok) => {
      const m = /✖ (\d+) problems? \((\d+) errors?, (\d+) warnings?\)/.exec(out);
      return m ? `${m[2]} errors, ${m[3]} warnings` : ok ? 'no problems' : 'failed';
    },
  },
  {
    name: 'Unit tests',
    cmd: 'npx tsx --tsconfig apps/desktop/tsconfig.web.json --test apps/desktop/src/**/*.test.ts',
    summary: (out) => {
      const pass = /ℹ pass (\d+)/.exec(out)?.[1] ?? '0';
      const fail = /ℹ fail (\d+)/.exec(out)?.[1] ?? '0';
      return fail === '0' ? `${pass} passed` : `${fail} of ${Number(pass) + Number(fail)} failed`;
    },
  },
];

const started = Date.now();
const results = await Promise.all(
  STEPS.map(
    (step) =>
      new Promise((resolve) => {
        const t = Date.now();
        const child = spawn(step.cmd, { cwd: ROOT, shell: true, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
        let out = '';
        child.stdout.on('data', (d) => (out += d));
        child.stderr.on('data', (d) => (out += d));
        child.on('close', (code) => resolve({ ...step, ok: code === 0, out, secs: (Date.now() - t) / 1000 }));
      }),
  ),
);

for (const r of results) console.log(`${r.ok ? '✔' : '✖'} ${r.name.padEnd(22)} ${r.summary(r.out, r.ok).padEnd(22)} ${r.secs.toFixed(1)}s`);
const failed = results.filter((r) => !r.ok);
for (const r of failed) {
  console.log(`\n── ${r.name} ──`);
  console.log(
    r.out
      .split('\n')
      .filter((l) => !/npm notice/.test(l))
      .slice(-40)
      .join('\n'),
  );
}
console.log(`\n${failed.length ? `${failed.length} failed` : 'All checks passed'} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(failed.length ? 1 : 0);
