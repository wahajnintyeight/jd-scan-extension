import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { load } from './extensionHarness.mjs';

const { document, window } = parseHTML(`<html><body><form aria-label="Application">
  <div><label for="project">Tell us more</label><div>Tell us about a complex project you led end to end. What problem were you solving?</div><textarea id="project"></textarea></div>
  <div class="ashby-application-form-field-entry"><label for="ashby-project">Tell us more</label><div class="ashby-application-form-question-description"><p>Tell us about a complex project you led end to end. What problem were you solving, what decisions and tradeoffs did you make, and what was the impact?</p></div><textarea id="ashby-project" name="f6bd78d9-497c-48b4-97a9-b9f3551794ce" placeholder="Type here..." aria-label="Tell us more"></textarea></div>
  <div><label for="eligibility">Work eligibility</label><div>Are you legally authorized to work in Poland?</div><input id="eligibility"></div>
  <div><label for="country">What country are you based in?</label><input id="country"></div>
  <input id="described" aria-describedby="help"><span id="help">What date can you start?</span>
</form></body></html>`);

const fields = await load('utils/applicationField.ts', {}, { document, ShadowRoot: window.ShadowRoot });
const dom = await load('utils/applicationDom.ts', {}, { document, ShadowRoot: window.ShadowRoot, window });
const llmAgent = await load('utils/llmAgent.ts', {}, { document, ShadowRoot: window.ShadowRoot, window });
let providerCalls = 0;
const applicationAnswers = await load('utils/applicationAnswers.ts', {}, {
  document, ShadowRoot: window.ShadowRoot, window,
  complete: async () => { providerCalls++; return { success: true, text: '' }; },
});

test('field descriptions include the closest help text and aria-described text', () => {
  assert.equal(fields.getFieldDescription(document.getElementById('project')),
    'Tell us about a complex project you led end to end. What problem were you solving?');
  assert.equal(fields.getFieldLabel(document.getElementById('ashby-project'), 0), 'Tell us more');
  assert.equal(fields.getFieldDescription(document.getElementById('ashby-project')),
    'Tell us about a complex project you led end to end. What problem were you solving, what decisions and tradeoffs did you make, and what was the impact?');
  assert.equal(fields.getFieldDescription(document.getElementById('eligibility')),
    'Are you legally authorized to work in Poland?');
  assert.equal(fields.getFieldDescription(document.getElementById('described')), 'What date can you start?');
  assert.equal(fields.getFieldDescription(document.getElementById('country')), undefined);
});

test('legal, demographic, financial, availability, and background-check prompts need user review', () => {
  for (const label of [
    'Are you legally authorized to work in Poland?',
    'Are you able to legally work under a B2B contract in Poland?',
    'Military service status',
    'Gender identity',
    'Expected salary',
    'What are your salary expectations?',
    'What date can you start?',
    'Have you ever been convicted of a felony?',
    'Passport number',
  ]) assert.equal(dom.requiresUserAction(label), true, label);
  assert.equal(dom.requiresUserAction('What country are you based in?'), false);
  assert.equal(dom.requiresUserAction('How many years of software experience do you have?'), false);
});

test('form prompts include the actual question and reject AI answers to legal fields', async () => {
  const question = 'Tell us about a complex project you led end to end. What problem were you solving, what decisions did you make, and what was the impact?';
  const prompt = llmAgent.buildApplicationFormMessages({
    resume: 'Software engineer with backend experience.',
    jobDescription: 'Build reliable software systems. '.repeat(4),
    fields: [{ id: 'project', label: 'Tell us more', description: question, type: 'textarea', value: '', required: true }],
  });
  assert.ok(prompt[1].content.includes(question));
  assert.match(prompt[0].content, /Do not replace a specific prompt with a generic resume summary/);
  assert.match(prompt[0].content, /must be left for the user, even if the resume contains an answer/);

  const legalField = { id: 'eligibility', label: 'Work eligibility', description: 'Are you legally authorized to work in Poland?', type: 'text', value: '', required: true };
  const salaryField = { id: 'salary', label: 'What are your salary expectations?', type: 'text', value: '', required: false };
  const restrictedField = { id: 'card', label: 'Credit card number', type: 'text', value: '', required: false };
  const prefilledField = { id: 'existing', label: 'Existing answer', type: 'text', value: 'Already answered', required: false };
  const result = llmAgent.parseApplicationFormAnswers(
    '{"answers":[{"id":"eligibility","value":"YES","needsUser":false}]}', [legalField],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { answers: [], needsUserIds: ['eligibility'] });

  const draft = await applicationAnswers.draftApplicationAnswers('provider', {
    resume: 'Candidate resume', jobDescription: 'Role requirements. '.repeat(5), fields: [legalField, salaryField, restrictedField, prefilledField],
  });
  assert.equal(providerCalls, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(draft)), { answers: [], needsUserIds: ['eligibility', 'salary', 'card', 'existing'] });
});
