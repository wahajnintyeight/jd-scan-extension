import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { load } from './extensionHarness.mjs';

test('Workable extracts real description and title elements', async () => {
  const description = 'Build accessible React and TypeScript applications, maintain reliable services, and collaborate with designers. '.repeat(3);
  const { document } = parseHTML(`<html><head><title>Engineer</title></head><body><h1 data-ui="job-title">Software Engineer</h1><div data-ui="company-name">Example</div><section data-ui="job-description">${description}</section></body></html>`);
  const { WorkableAdapter } = await load('utils/siteAdapters/workable.ts', {}, { document, window: { location: new URL('https://example.workable.com/j/posting') } });
  const data = new WorkableAdapter().getJobData();
  assert.equal(data.title, 'Software Engineer');
  assert.equal(data.company, 'Example');
  assert.equal(data.jd, description.trim());
});

test('Ashby application fields have an owner without accepting unrelated containers', async () => {
  const { document, window } = parseHTML('<html><body><div class="ashby-application-form-container"><label>Name<input></label><button>Submit Application</button></div><input id="search"></body></html>');
  const location = new URL('https://jobs.ashbyhq.com/linear/posting/application');
  const helper = await load('utils/applicationDom.ts', {}, { document, ShadowRoot: window.ShadowRoot, window: { location } });
  assert.equal(helper.getApplicationFormRoots().length, 1);
  assert.ok(helper.applicationFieldOwner(document.querySelector('input')));
  assert.equal(helper.applicationFieldOwner(document.querySelector('#search')), null);
  location.hostname = 'example.com';
  assert.equal(helper.getApplicationFormRoots().length, 0);
});

test('Ashby posting and application share context, but other jobs do not', async () => {
  const { sameJobPage } = await load('utils/jobContext.ts', {});
  const url = 'https://jobs.ashbyhq.com/linear/posting';
  assert.equal(sameJobPage(url, `${url}/application`), true);
  assert.equal(sameJobPage(url, 'https://jobs.ashbyhq.com/linear/other/application'), false);
  assert.equal(sameJobPage(url, 'https://jobs.ashbyhq.com/other/posting/application'), false);
});

test('Ashby application markup cannot replace the original job description', async () => {
  const { document, window } = parseHTML('<html><body><h1>Engineer</h1><div class="ashby-application-form-container"><input><button>Submit Application</button></div><script>window.__appData = { requirements: "not a job description" };</script></body></html>');
  const { GenericAdapter } = await load('utils/siteAdapters/generic.ts', {}, { document, ShadowRoot: window.ShadowRoot, window: { location: new URL('https://jobs.ashbyhq.com/linear/posting/application') } });
  assert.equal(new GenericAdapter().getJobData().jd, '');
});

test('job detection includes Ashby and excludes Workable marketing pages', async () => {
  const { isLikelyJobUrl } = await load('utils/jobPage.ts', {});
  for (const url of ['https://jobs.ashbyhq.com/linear/posting', 'https://jobs.ashbyhq.com/linear/posting/application', 'https://jobs.workable.com/view/id/software-engineer', 'https://company.workable.com/j/id']) assert.equal(isLikelyJobUrl(url), true, url);
  for (const url of ['https://workable.com/about', 'https://workable.com/pricing', 'https://company.workable.com/company', 'https://jobs.ashbyhq.com/linear']) assert.equal(isLikelyJobUrl(url), false, url);
});

test('overlay restores the same root after host removal and disconnects on cleanup', async () => {
  const { document } = parseHTML('<html><body></body></html>');
  let notify, disconnected = false;
  const { keepOverlayMounted } = await load('utils/overlayMount.ts', {}, { document, MutationObserver: class {
    constructor(callback) { notify = callback; }
    observe(target, options) { assert.equal(target, document.documentElement); assert.deepEqual(JSON.parse(JSON.stringify(options)), { childList: true }); }
    disconnect() { disconnected = true; }
  } });
  const host = document.createElement('jd-scan-overlay');
  host.attachShadow({ mode: 'open' }).innerHTML = '<input value="preserve draft">';
  const cleanup = keepOverlayMounted(host);
  host.remove();
  notify();
  assert.equal(host.parentElement, document.documentElement);
  assert.equal(host.shadowRoot.querySelector('input').value, 'preserve draft');
  notify();
  assert.equal(document.querySelectorAll('jd-scan-overlay').length, 1);
  cleanup();
  assert.equal(disconnected, true);
});
