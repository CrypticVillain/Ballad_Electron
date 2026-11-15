import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { replaceFile, replaceFileSync } from './files';

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ballad-files-'));
});
afterEach(() => {
  mock.restoreAll();
  fs.rmSync(dir, { recursive: true, force: true });
});

const files = () => {
  const temp = path.join(dir, 'vault.json.tmp');
  const file = path.join(dir, 'vault.json');
  fs.writeFileSync(file, 'old');
  fs.writeFileSync(temp, 'new');
  return { temp, file };
};
const held = (code: string) => Object.assign(new Error(`${code}: held by something else`), { code });

test('the temp file takes the file’s place', async () => {
  const { temp, file } = files();
  replaceFileSync(temp, file);
  assert.equal(fs.readFileSync(file, 'utf8'), 'new');
  assert.equal(fs.existsSync(temp), false);

  fs.writeFileSync(temp, 'newer');
  await replaceFile(temp, file);
  assert.equal(fs.readFileSync(file, 'utf8'), 'newer');
});

test('a file held for a moment (a scanner, the indexer) is tried again till it’s free', async () => {
  const { temp, file } = files();
  const rename = fs.renameSync;
  let refused = 0;
  mock.method(fs, 'renameSync', (from: string, to: string) => {
    if (refused++ < 3) throw held(['EPERM', 'EBUSY', 'EACCES'][refused - 1]!);
    return rename(from, to);
  });
  replaceFileSync(temp, file);
  assert.equal(refused, 4);
  assert.equal(fs.readFileSync(file, 'utf8'), 'new');

  fs.writeFileSync(temp, 'newer');
  const renameAsync = fs.promises.rename;
  let refusedAsync = 0;
  mock.method(fs.promises, 'rename', async (from: string, to: string) => {
    if (refusedAsync++ < 2) throw held('EBUSY');
    return renameAsync(from, to);
  });
  await replaceFile(temp, file);
  assert.equal(refusedAsync, 3);
  assert.equal(fs.readFileSync(file, 'utf8'), 'newer');
});

test('any other failure, or one that lasts, is given up on (the file as it was)', async () => {
  const { temp, file } = files();
  let tries = 0;
  mock.method(fs, 'renameSync', () => {
    tries++;
    throw held('ENOSPC');
  });
  assert.throws(() => replaceFileSync(temp, file), /ENOSPC/);
  assert.equal(tries, 1, 'not tried again: it won’t pass');

  tries = 0;
  mock.method(fs, 'renameSync', () => {
    tries++;
    throw held('EPERM');
  });
  assert.throws(() => replaceFileSync(temp, file), /EPERM/);
  assert.equal(tries, 40, 'about half a second of tries');

  mock.method(fs.promises, 'rename', async () => {
    throw held('ENOENT');
  });
  await assert.rejects(replaceFile(temp, file), /ENOENT/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'old');
});
