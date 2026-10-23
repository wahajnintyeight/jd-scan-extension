import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { load } from './extensionHarness.mjs';

test('address backing inputs are excluded even when they have layout bounds', async () => {
  const { document, window } = parseHTML('<form><input id="address" value="Lahore, Pakistan"><input id="city" aria-hidden="true" tabindex="-1"><div aria-hidden="true"><input id="country"></div><div inert><input id="postcode"></div></form>');
  const helper = await load('utils/applicationDom.ts', {}, {
    document, ShadowRoot: window.ShadowRoot,
    window: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) },
  });
  for (const input of document.querySelectorAll('input')) input.getClientRects = () => [{}];
  assert.equal(helper.isApplicationFieldVisible(document.querySelector('#address')), true);
  for (const id of ['city', 'country', 'postcode']) {
    assert.equal(helper.isApplicationFieldVisible(document.getElementById(id)), false, id);
  }
});

test('hidden ancestors across shadow boundaries exclude a field', async () => {
  const { document, window } = parseHTML('<div aria-hidden="true"><custom-input></custom-input></div>');
  const host = document.querySelector('custom-input');
  host.attachShadow({ mode: 'open' }).innerHTML = '<input>';
  const input = host.shadowRoot.querySelector('input');
  input.getClientRects = () => [{}];
  const helper = await load('utils/applicationDom.ts', {}, {
    document, ShadowRoot: window.ShadowRoot,
    window: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) },
  });
  assert.equal(helper.isApplicationFieldVisible(input), false);
});
