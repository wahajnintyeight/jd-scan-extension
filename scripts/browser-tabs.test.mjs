import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';
import { readFile } from 'node:fs/promises';

test('UI tab lookup delegates to the worker even when a partial tabs API exists', async () => {
  const api = { tabs: { query() { throw new TypeError("Cannot read properties of undefined (reading 'query')"); } },
    runtime: { async sendMessage(request) {
      assert.equal(request.type, 'JD_SCAN_GET_ACTIVE_TAB');
      return { success: true, tab: { id: 7, url: 'https://jobs.workable.com/search' } };
    } },
  };
  const helper = await load('utils/browserTabs.ts', api);
  assert.equal((await helper.getActiveBrowserTab()).id, 7);
});

async function worker(tabs, sender = { id: 'jd-scan' }) {
  let listener;
  const api = { tabs: { onUpdated: { addListener() {} }, ...tabs }, runtime: {
    id: 'jd-scan', onMessage: { addListener(fn) { listener = fn; } },
  } };
  (await load('entrypoints/background/index.ts', api)).default.main();
  return request => new Promise((resolve, reject) => {
    try { listener(request, sender, resolve); } catch (error) { reject(error); }
  });
}

test('worker returns the active website and rejects internal extension tabs', async () => {
  let tab = { id: 7, url: 'https://jobs.workable.com/search' };
  const request = await worker({ query: async () => [tab] });
  assert.equal((await request({ type: 'JD_SCAN_GET_ACTIVE_TAB' })).tab.id, 7);
  tab = { id: 8, url: 'chrome-extension://jd-scan/sidepanel.html' };
  assert.equal((await request({ type: 'JD_SCAN_GET_ACTIVE_TAB' })).success, false);
});

test('content-script requests use their active sender tab without a tabs.query round trip', async () => {
  const sent = [];
  const request = await worker({ sendMessage: async (tabId, message) => { sent.push([tabId, message.type]); return { success: true }; } },
    { id: 'jd-scan', tab: { id: 7, url: 'https://jobs.workable.com/search', active: true } });
  const active = await request({ type: 'JD_SCAN_GET_ACTIVE_TAB' });
  assert.equal(active.tab.id, 7);
  assert.equal(active.tab.url, 'https://jobs.workable.com/search');
  const result = await request({ type: 'JD_SCAN_SEND_TAB_MESSAGE', tabId: 7, message: { type: 'GET_APPLICATION_FIELDS' } });
  assert.equal(result.success, true);
  assert.equal(result.response.success, true);
  assert.deepEqual(sent, [[7, 'GET_APPLICATION_FIELDS']]);
});

test('inactive content-script tabs cannot use the sender-tab shortcut', async () => {
  const request = await worker({ query: async () => [{ id: 8, url: 'https://other.example' }] },
    { id: 'jd-scan', tab: { id: 7, url: 'https://jobs.workable.com/search', active: false } });
  assert.equal((await request({ type: 'JD_SCAN_GET_ACTIVE_TAB' })).success, false);
  assert.equal((await request({ type: 'JD_SCAN_SEND_TAB_MESSAGE', tabId: 7, message: { type: 'GET_APPLICATION_FIELDS' } })).success, false);
});

test('worker rejects missing tab API without throwing a query TypeError', async () => {
  const request = await worker({});
  const response = await request({ type: 'JD_SCAN_GET_ACTIVE_TAB' });
  assert.equal(response.success, false);
  assert.match(response.error, /browser tabs/i);
});

test('worker restricts content-script requests to their own active tab', async () => {
  const request = await worker({ query: async () => [{ id: 9, url: 'https://example.com' }] },
    { id: 'jd-scan', tab: { id: 7 } });
  assert.equal((await request({ type: 'JD_SCAN_GET_ACTIVE_TAB' })).success, false);
});

test('worker refuses unknown actions and inactive targets before forwarding', async () => {
  let forwarded = 0;
  const request = await worker({ query: async () => [{ id: 7, url: 'https://example.com' }],
    sendMessage: async () => { forwarded++; return { success: true }; } });
  for (const [tabId, type] of [[7, 'SUBMIT_APPLICATION'], [8, 'FILL_APPLICATION_FIELDS']]) {
    assert.equal((await request({ type: 'JD_SCAN_SEND_TAB_MESSAGE', tabId, message: { type } })).success, false);
  }
  assert.equal(forwarded, 0);
  assert.equal((await request({ type: 'JD_SCAN_SEND_TAB_MESSAGE', tabId: 7, message: { type: 'GET_APPLICATION_FIELDS' } })).success, true);
  assert.equal(forwarded, 1);
});

test('dashboard and popup have no direct tab-query calls', async () => {
  for (const path of ['entrypoints/sidepanel/App.tsx', 'entrypoints/popup/App.tsx', 'utils/settings.ts']) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /\.tabs\??\.query\(/, path);
  }
});
