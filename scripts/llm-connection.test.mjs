import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';

async function client(fetch) {
  const chrome = { storage: { local: { async get() {
    return { jd_scan_session: { sessionId: 'test-session', expiresAt: Date.now() + 60_000 } };
  } } } };
  return load('utils/api.ts', chrome, { fetch, Error });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test('connection failures preserve the nested detail from the live API error envelope', async () => {
  const detail = 'OpenRouter generation failed; Scaleway fallback returned HTTP 403: insufficient permissions.';
  const api = await client(async () => json({
    code: 1002, message: 'Error', result: { success: false, error: detail, message: 'Connection failed: ' + detail },
  }));
  const result = await api.testLLMConnection('openrouter', 'vendor/model', 'synthetic-key');
  assert.equal(result.success, false);
  assert.equal(result.message, detail);
  assert.equal(result.error, detail);
});

test('a successful API envelope can still contain a failed provider connection', async () => {
  const api = await client(async () => json({
    code: 1022, message: 'Success', result: { success: false, message: 'Error', error: 'The model is unavailable.' },
  }));
  const result = await api.testLLMConnection('openrouter', 'vendor/model', 'synthetic-key');
  assert.equal(result.success, false);
  assert.equal(result.message, 'The model is unavailable.');
});

test('legacy string error results remain visible', async () => {
  const api = await client(async () => json({ code: 1002, message: 'Error', result: 'Invalid API key.' }));
  assert.equal((await api.testLLMConnection('openrouter', 'vendor/model', 'synthetic-key')).message, 'Invalid API key.');
});

test('non-JSON HTTP failures retain their HTTP status', async () => {
  const api = await client(async () => new Response('<html>Unavailable</html>', { status: 503 }));
  const result = await api.testLLMConnection('openrouter', 'vendor/model', 'synthetic-key');
  assert.equal(result.success, false);
  assert.match(result.message, /HTTP 503/);
  assert.doesNotMatch(result.message, /<html>/);
});

test('network failures report why the connection-test API could not be reached', async () => {
  const api = await client(async () => { throw new Error('Failed to fetch'); });
  const result = await api.testLLMConnection('openrouter', 'vendor/model', 'synthetic-key');
  assert.equal(result.success, false);
  assert.match(result.message, /Failed to fetch/);
});

test('successful tests preserve usage and trim copied model IDs and keys', async () => {
  let payload;
  const api = await client(async (_url, request) => {
    payload = JSON.parse(request.body);
    return json({ code: 1022, message: 'Success', result: {
      success: true, message: 'Connected successfully.', usage: { totalTokens: 4 },
    } });
  });
  const result = await api.testLLMConnection('openrouter', ' vendor/model ', ' synthetic-key ');
  assert.equal(result.success, true);
  assert.equal(result.message, 'Connected successfully.');
  assert.equal(result.usage.totalTokens, 4);
  assert.deepEqual(payload, { provider: 'openrouter', model: 'vendor/model', apiKey: 'synthetic-key' });
});
