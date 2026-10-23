import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';

const url = 'https://jobs.lever.co/example/posting/apply';
const job = { sourceUrl: url, title: 'Engineer', company: 'Example', jd: 'Build accessible React and TypeScript applications. Collaborate with designers, write tests, and review production code.' };

async function run({ cycle = false, navigateDuringAI = false } = {}) {
  let step = 0;
  let polls = 0;
  let now = 0;
  const values = ['', ''];
  const actions = [];
  const contexts = [];
  let currentUrl = url;
  const api = { tabs: {
    query: async query => {
      assert.deepEqual(JSON.parse(JSON.stringify(query)), { active: true, windowId: 42 });
      return [{ id: 7, url: currentUrl }];
    },
    sendMessage: async (_id, message) => {
      actions.push({ type: message.type, step });
      if (message.type === 'FILL_APPLICATION_FIELDS') {
        assert.equal(message.expectedUrl, currentUrl);
        values[step] = message.fields[0].value;
        return { success: true, filled: 1 };
      }
      if (message.type === 'ADVANCE_APPLICATION_STEP') {
        if (step === 0 || cycle) { step = step === 0 ? 1 : 0; currentUrl = `${url}?step=${step}`; polls = 0; return { success: true, clicked: true }; }
        return { success: true, clicked: false, finalActionFound: true };
      }
      if (step === 1 && ++polls === 1) return { success: true, applicationContext: true, fields: [], url: currentUrl };
      return { success: true, applicationContext: true, url: currentUrl, fields: [{ id: `field-${step}`, type: step === 0 ? 'text' : 'email', label: step === 0 ? 'First name' : 'Email', required: true, value: values[step] }] };
    },
  }, storage: { local: { set: async record => { if (record.jdScan_applicationJob) contexts.push(record.jdScan_applicationJob.url); } } } };
  const runner = await load('entrypoints/background/applicationRun.ts', api, {
    Date: class extends Date { static now() { return now; } },
    setTimeout: callback => { now += 500; callback(); },
    complete: async () => {
      if (navigateDuringAI) currentUrl = 'https://example.com/unrelated-application';
      return { success: true, text: '{"answers":[{"id":"field-1","value":"candidate@example.com","needsUser":false}]}' };
    },
  });
  const result = await runner.runApplication({ tabId: 7, configId: 'provider', resume: 'Test Candidate', job, applicationName: { firstName: 'Test', lastName: 'Candidate' } }, 42);
  return { result, actions, values, contexts };
}

test('a delayed second step fills after its fields render and stops before final submission', async () => {
  const { result, values, actions } = await run();
  assert.equal(result.error, '');
  assert.equal(result.filled, 2);
  assert.deepEqual(values, ['Test', 'candidate@example.com']);
  assert.match(result.status, /final review or submission is ready/);
  assert.equal(actions.filter(action => action.type === 'ADVANCE_APPLICATION_STEP').length, 2);
});

test('cyclic navigation stops when a form returns to an earlier step', async () => {
  const { result, actions } = await run({ cycle: true });
  assert.match(result.status, /earlier step/);
  assert.equal(actions.filter(action => action.type === 'FILL_APPLICATION_FIELDS').length, 2);
});

test('navigation during AI generation does not fill or bind old context to the new URL', async () => {
  const { result, contexts, actions } = await run({ navigateDuringAI: true });
  assert.match(result.error, /page changed/);
  assert.equal(actions.filter(action => action.type === 'FILL_APPLICATION_FIELDS').length, 1);
  assert.equal(contexts.includes('https://example.com/unrelated-application'), false);
});
