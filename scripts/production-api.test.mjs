import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

test('backend configuration defaults to production and has no legacy localhost scan route', async () => {
  const production = 'https://api.theprojectphoenix.top/v2/api';
  for (const path of ['wxt.config.ts', 'utils/apiTransport.ts', '.env.example']) {
    assert.ok((await readFile(path, 'utf8')).includes(production), path);
  }
  const worker = await readFile('entrypoints/background/index.ts', 'utf8');
  assert.doesNotMatch(worker, /localhost|127\.0\.0\.1|SCAN_REQUEST/);
});
