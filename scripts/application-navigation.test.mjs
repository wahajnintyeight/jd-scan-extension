import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { load } from './extensionHarness.mjs';

async function fixture() {
  const { document, window } = parseHTML('<html><body><button id="outside">Next</button><form aria-label="Application"><input id="name"><button id="next">Continue</button><button id="submit">Submit application</button></form></body></html>');
  for (const element of document.querySelectorAll('*')) element.getClientRects = () => [{}];
  const helper = await load('utils/applicationNavigation.ts', {}, { document, ShadowRoot: window.ShadowRoot,
    HTMLInputElement: window.HTMLInputElement, HTMLAnchorElement: window.HTMLAnchorElement,
    window: { location: new URL('https://example.com/apply'), getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) },
  });
  return { document, read: (fields = [document.getElementById('name')]) => helper.findApplicationNavigation(fields) };
}

test('only a Next control belonging to the application form can advance', async () => {
  const { read } = await fixture();
  assert.equal(read().nextStep.element.id, 'next');
  assert.equal(read().finalAction.element.id, 'submit');
});

test('a changed, hidden, or consent-bearing Next control is not clicked', async () => {
  for (const mutate of [element => { element.textContent = 'Submit application'; }, element => element.setAttribute('aria-hidden', 'true'), element => element.setAttribute('aria-label', 'Continue and agree to terms')]) {
    const { document, read } = await fixture();
    mutate(document.getElementById('next'));
    assert.equal(read().nextStep, undefined);
  }
});

test('an empty review step exposes the final action without advancing', async () => {
  const { read } = await fixture();
  assert.equal(read([]).nextStep, undefined);
  assert.equal(read([]).finalAction.element.id, 'submit');
});
