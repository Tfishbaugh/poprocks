import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileName, saveMethod, saveVideo } from '../../js/save.js';

const file = { name: 'PopRocks-2026-10-24-1930.mp4', type: 'video/mp4' };

function fakeDoc() {
  const links = [];
  return {
    links,
    body: { append: (link) => links.push(link) },
    createElement: () => ({ click() { this.clicked = true; }, remove() { this.removed = true; } }),
  };
}

const fakeUrls = () => ({ createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
const sharing = (share, canShare = () => true) => ({ canShare, share });

test('file names carry the date and the right extension', () => {
  assert.equal(fileName(new Date(2026, 9, 24, 19, 5), 'mp4'), 'PopRocks-2026-10-24-1905.mp4');
  assert.equal(fileName(new Date(2026, 0, 2, 8, 30), 'webm'), 'PopRocks-2026-01-02-0830.webm');
});

test('phones and tablets share; laptops download', () => {
  assert.equal(saveMethod({ nav: sharing(), coarse: true, file }), 'share');
  assert.equal(saveMethod({ nav: sharing(), coarse: false, file }), 'download');
  assert.equal(saveMethod({ nav: sharing(null, () => false), coarse: true, file }), 'download');
  assert.equal(saveMethod({ nav: {}, coarse: true, file }), 'download');
  assert.equal(saveMethod({ nav: undefined, coarse: true, file }), 'download');
});

test('sharing opens the share sheet with just the file', async () => {
  const calls = [];
  const nav = sharing(async (data) => calls.push(data));
  const result = await saveVideo(file, { nav, coarse: true, doc: fakeDoc(), urls: fakeUrls() });
  assert.equal(result, 'shared');
  assert.deepEqual(calls, [{ files: [file] }]);
});

test('closing the share sheet is not an error and downloads nothing', async () => {
  const doc = fakeDoc();
  const nav = sharing(async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); });
  assert.equal(await saveVideo(file, { nav, coarse: true, doc, urls: fakeUrls() }), 'cancelled');
  assert.equal(doc.links.length, 0);
});

test('a share that fails falls back to a download', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = fakeDoc();
  const nav = sharing(async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }); });
  assert.equal(await saveVideo(file, { nav, coarse: true, doc, urls: fakeUrls() }), 'downloaded');
  assert.equal(doc.links.length, 1);
});

test('a download uses the file name and cleans up its link', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const revoked = [];
  const urls = { ...fakeUrls(), revokeObjectURL: (url) => revoked.push(url) };
  const doc = fakeDoc();
  assert.equal(await saveVideo(file, { nav: sharing(), coarse: false, doc, urls }), 'downloaded');
  const [link] = doc.links;
  assert.equal(link.download, file.name);
  assert.equal(link.href, 'blob:test');
  assert.equal(link.clicked, true);
  assert.equal(link.removed, true);
  assert.deepEqual(revoked, [], 'the file stays available while the download starts');
  t.mock.timers.tick(60_000);
  assert.deepEqual(revoked, ['blob:test']);
});
