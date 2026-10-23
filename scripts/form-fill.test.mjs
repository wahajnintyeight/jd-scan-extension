import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { load } from './extensionHarness.mjs';

async function fixture(duringScroll = () => {}) {
  const { document, window } = parseHTML('<html><body><form aria-label="Application"><input type="text" id="address" name="address" value="Lahore, Pakistan"><input type="text" id="city" name="city" aria-hidden="true"><input type="text" id="country" name="country" aria-hidden="true"><input type="email" id="email" name="email"></form></body></html>');
  for (const field of document.querySelectorAll('input')) {
    field.getClientRects = () => [{}];
    field.scrollIntoView = () => {};
  }
  const location = new URL('https://example.com/application');
  const helper = await load('utils/applicationField.ts', {}, {
    document, ShadowRoot: window.ShadowRoot, HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLSelectElement: window.HTMLSelectElement,
    Event: window.Event,
    window: { location, getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
      matchMedia: () => ({ matches: true }), setTimeout: callback => { duringScroll(document, location); callback(); } },
  });
  return { document, fill: (id, value) => helper.fillApplicationField(document.getElementById(id), value, 'https://example.com/application') };
}

test('repeated filling cannot write hidden address parts or duplicate a completed address', async () => {
  const { document, fill } = await fixture();
  const address = document.getElementById('address');
  for (const id of ['city', 'country']) document.getElementById(id).addEventListener('change', () => { address.value += ', Lahore, Pakistan'; });
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const id of ['address', 'city', 'country']) assert.equal(await fill(id, 'Lahore, Pakistan'), false);
  }
  assert.equal(address.value, 'Lahore, Pakistan');
});

test('ordinary empty contact fields fill once and preserve the existing answer on retry', async () => {
  const { document, fill } = await fixture();
  assert.equal(await fill('email', 'candidate@example.com'), true);
  assert.equal(await fill('email', 'another@example.com'), false);
  assert.equal(document.getElementById('email').value, 'candidate@example.com');
});

test('a user edit or page navigation during scrolling cancels the pending write', async () => {
  const edited = await fixture(document => { document.getElementById('email').value = 'user@example.com'; });
  assert.equal(await edited.fill('email', 'ai@example.com'), false);
  assert.equal(edited.document.getElementById('email').value, 'user@example.com');
  const navigated = await fixture((_document, location) => { location.pathname = '/another-job'; });
  assert.equal(await navigated.fill('email', 'ai@example.com'), false);
  assert.equal(navigated.document.getElementById('email').value, '');
});
