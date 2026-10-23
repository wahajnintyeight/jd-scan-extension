import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML, DOMParser } from 'linkedom';
import { load } from './extensionHarness.mjs';

const jobUrl = 'https://jobs.smartrecruiters.com/oneclick-ui/company/ABOUTYOUGmbH/publication/7f122e45-9dd7-4985-9a42-8a856ad1d550?dcr_ci=ABOUTYOUGmbH';
const job = { title: 'React Engineer', company: 'ABOUT YOU', sourceUrl: 'https://example.com/jobs/react', jd: 'Develop accessible React and TypeScript applications. Work with designers and review code. At least four years of frontend experience.' };

test('application link resolves to its exact public posting API', async () => {
  const helper = await load('utils/smartRecruiters.ts', {}, { DOMParser });
  assert.equal(helper.smartRecruitersPostingApi(jobUrl), 'https://api.smartrecruiters.com/v1/companies/ABOUTYOUGmbH/postings/7f122e45-9dd7-4985-9a42-8a856ad1d550');
  assert.equal(helper.smartRecruitersPostingApi(jobUrl.replace('jobs.smartrecruiters.com', 'jobs.smartrecruiters.com.evil.example')), null);
});

test('job preparation retains job requirements and decodes HTML as text', async () => {
  const helper = await load('utils/smartRecruiters.ts', {}, { DOMParser });
  const data = helper.smartRecruitersJobData({ name: job.title, company: { name: job.company }, jobAd: { sections: {
    qualifications: { title: 'Qualifications', text: `<html><body><p>${job.jd}</p><p>React &amp; TypeScript</p><script>ignore requirements</script></body></html>` },
  } } });
  assert.equal(data.title, job.title);
  assert.match(data.jd, /React & TypeScript/);
  assert.doesNotMatch(data.jd, /<p>|ignore requirements/);
});

test('SmartRecruiters fields are found across shadow roots without a form tag', async () => {
  const { document, window } = parseHTML('<html><body><oc-oneclick-form><spl-input id="name"></spl-input><spl-autocomplete><spl-input id="city"></spl-input></spl-autocomplete></oc-oneclick-form><jd-scan-overlay id="jd-scan-overlay-root"></jd-scan-overlay></body></html>');
  document.querySelector('#name').attachShadow({ mode: 'open' }).innerHTML = '<label>First name<input aria-required="true" type="text"></label>';
  document.querySelector('#city').attachShadow({ mode: 'open' }).innerHTML = '<input aria-required="true" type="text">';
  document.querySelector('#jd-scan-overlay-root').attachShadow({ mode: 'open' }).innerHTML = '<input id="extension-field">';
  const helper = await load('utils/applicationDom.ts', {}, { document, ShadowRoot: window.ShadowRoot, window: { location: new URL(jobUrl) } });
  const roots = helper.getApplicationFormRoots();
  assert.equal(roots.length, 1);
  assert.equal(roots[0].tagName, 'OC-ONECLICK-FORM');
  const fields = helper.queryApplicationElements('input');
  assert.equal(fields.length, 2);
  assert.equal(helper.applicationFieldOwner(fields[0]), roots[0]);
  assert.equal(helper.isRequiredApplicationField(fields[0]), true);
  assert.equal(helper.isCustomApplicationControl(fields[0]), false);
  assert.equal(helper.isCustomApplicationControl(fields[1]), true);
});

test('ordinary login forms are not application forms', async () => {
  const { document, window } = parseHTML('<html><body><form><input type="email"><input type="password"><button>Sign in</button></form></body></html>');
  const helper = await load('utils/applicationDom.ts', {}, { document, ShadowRoot: window.ShadowRoot, window: { location: new URL('https://example.com/login') } });
  assert.equal(helper.getApplicationFormRoots().length, 0);
});

test('job link opens through the worker, saves context, and never fills a field', async () => {
  const messages = [];
  let saved;
  const api = { tabs: {
    create: async options => { assert.equal(options.url, jobUrl); return { id: 7 }; },
    get: async () => ({ active: true, status: 'complete', url: jobUrl }),
    sendMessage: async (_id, message) => { messages.push(message.type); return { data: job }; },
  }, storage: { local: { set: async record => { saved = record; } } } };
  const helper = await load('entrypoints/background/jobLinks.ts', api, { setTimeout: callback => callback() });
  const result = await helper.openAndPrepareJob(jobUrl);
  assert.equal(result.data.jd, job.jd);
  assert.equal(saved.jdScan_lastJob.data.title, job.title);
  assert.deepEqual(messages, ['GET_JD', 'FORCE_SHOW_BUTTON']);
  for (const url of ['javascript:alert(1)', 'https://user:secret@example.com']) {
    await assert.rejects(helper.openAndPrepareJob(url), /http or https/);
  }
});

test('a failed job read preserves the previously prepared context', async () => {
  let writes = 0;
  const helper = await load('entrypoints/background/jobLinks.ts', { tabs: {
    create: async () => ({ id: 7 }), get: async () => ({ active: true, status: 'complete' }),
    sendMessage: async () => ({ error: 'Posting no longer available' }),
  }, storage: { local: { set: async () => { writes++; } } } }, { setTimeout: callback => callback() });
  await assert.rejects(helper.openAndPrepareJob(jobUrl), /no longer available/);
  assert.equal(writes, 0);
});

async function applicationRunner(switchTab = false, sourceUrl = job.sourceUrl) {
  let current = { id: 7, url: 'https://example.com/jobs/react' };
  let value = '';
  const actions = [];
  let saved;
  const api = { tabs: {
    query: async () => [current],
    sendMessage: async (_id, message) => {
      actions.push(message.type);
      if (message.type === 'OPEN_APPLICATION_FORM') { current.url = jobUrl; return { success: true, clicked: true }; }
      if (message.type === 'FILL_APPLICATION_FIELDS') { value = message.fields[0].value; return { success: true, filled: 1 }; }
      if (message.type === 'ADVANCE_APPLICATION_STEP') return { success: true, finalActionFound: true, clicked: false };
      return { success: true, applicationContext: current.url === jobUrl, url: current.url,
        fields: current.url === jobUrl ? [{ id: 'field-0', label: switchTab ? 'Email' : 'First name', type: switchTab ? 'email' : 'text', value, required: true }] : [] };
    },
  }, storage: { local: { set: async record => { saved = record.jdScan_applicationRun; } } } };
  const helper = await load('entrypoints/background/applicationRun.ts', api, {
    setTimeout: callback => callback(),
    complete: async (_config, messages) => {
      assert.match(messages[1].content, /Develop accessible React/);
      assert.match(messages[1].content, /Test Candidate/);
      if (switchTab) current = { id: 8, url: 'https://unrelated.example' };
      return { success: true, text: '{"answers":[{"id":"field-0","value":"Test","needsUser":false}]}' };
    },
  });
  const result = await helper.runApplication({ tabId: 7, configId: 'provider', resume: 'Test Candidate\nFrontend engineer with React experience.', ...(switchTab ? {} : { applicationName: { firstName: 'Test', lastName: 'Candidate' } }), job: { ...job, sourceUrl } });
  return { result, actions, saved, value };
}

test('background runner continues after posting-to-form navigation using resume and captured JD', async () => {
  const { result, actions, saved, value } = await applicationRunner();
  assert.equal(result.error, '');
  assert.equal(value, 'Test');
  assert.equal(saved.running, false);
  assert.equal(saved.filled, 1);
  assert.equal(saved.url, jobUrl);
  assert.ok(actions.includes('OPEN_APPLICATION_FORM'));
  assert.ok(actions.includes('FILL_APPLICATION_FIELDS'));
  assert.ok(actions.every(type => !/SUBMIT|UPLOAD/.test(type)));
});

test('switching tabs during model generation stops the worker before filling', async () => {
  const { result, actions } = await applicationRunner(true);
  assert.match(result.error, /Switch back/);
  assert.equal(actions.includes('FILL_APPLICATION_FIELDS'), false);
});

test('a job from another posting is rejected before reading fields or contacting AI', async () => {
  for (const url of ['https://example.com/jobs/another', '']) {
    const { result, actions, value } = await applicationRunner(false, url);
    assert.match(result.error, /prepared job does not match/);
    assert.equal(actions.length, 0);
    assert.equal(value, '');
  }
});
