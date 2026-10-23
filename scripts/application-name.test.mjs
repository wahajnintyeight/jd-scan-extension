import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';

const name = { firstName: 'Muhammad', lastName: 'Wahaj' };
const field = (label, extra = {}) => ({ id: label, label, type: 'text', value: '', ...extra });
const helper = await load('utils/applicationName.ts', {});

test('confirmed names map exact ATS labels and autocomplete hints', () => {
  assert.equal(helper.confirmedNameAnswer(field('*First name First name firstname'), name), 'Muhammad');
  assert.equal(helper.confirmedNameAnswer(field('*Last name Last name lastname'), name), 'Wahaj');
  assert.equal(helper.confirmedNameAnswer(field('Name', { autocomplete: 'section-applicant given-name' }), name), 'Muhammad');
  assert.equal(helper.confirmedNameAnswer(field('Surname'), name), 'Wahaj');
  assert.equal(helper.confirmedNameAnswer(field('Prénom*'), name), 'Muhammad');
  assert.equal(helper.confirmedNameAnswer(field('Nom de famille*'), name), 'Wahaj');
});

test('names do not override existing values, attestations, legal/preferred names, or ambiguous labels', () => {
  for (const candidate of [field('First name', { value: 'Already entered' }), field('Legal first name'), field('Preferred first name'), field('First name', { description: 'Legal name only' }), field('First name', { requiresUserAction: true }), field("Mother's first name"), field('First name of emergency contact', { autocomplete: 'given-name' }), field('Full name', { autocomplete: 'given-name' }), field('First name', { maxLength: 2 })]) {
    assert.equal(helper.confirmedNameAnswer(candidate, name), undefined);
  }
  assert.equal(helper.validApplicationName({ firstName: 'A\nB', lastName: 'C' }), false);
  assert.equal(helper.confirmedNameAnswer(field('First name'), undefined), undefined);
});

test('saved names are scoped to their selected resume', async () => {
  let record;
  const names = await load('utils/applicationName.ts', { storage: { local: {
    set: async value => { record = { ...record, ...value }; }, get: async () => record,
  } } });
  await names.saveApplicationName('resume-a', name);
  assert.equal((await names.loadApplicationName('resume-a')).firstName, 'Muhammad');
  assert.equal(await names.loadApplicationName('resume-b'), undefined);
  await names.saveApplicationName('resume-b', { firstName: 'Other', lastName: 'Candidate' });
  assert.equal((await names.loadApplicationName('resume-a')).firstName, 'Muhammad');
});

test('name-only forms need no AI call; other questions still use the provider', async () => {
  let calls = 0;
  const answers = await load('utils/applicationAnswers.ts', {}, { complete: async (_config, messages) => {
    calls++;
    assert.doesNotMatch(messages[1].content, /"id":"First name"/);
    return { success: true, text: '{"answers":[{"id":"Email","value":"candidate@example.com","needsUser":false}]}' };
  } });
  const input = { resume: 'Test Candidate', jobDescription: 'Test posting', applicationName: name, fields: [field('First name'), field('Last name')] };
  assert.equal((await answers.draftApplicationAnswers('provider', input)).answers.length, 2);
  assert.equal(calls, 0);
  const result = await answers.draftApplicationAnswers('provider', { ...input, fields: [...input.fields, field('Email', { type: 'email' })] });
  assert.equal(calls, 1);
  assert.equal(result.answers.length, 3);
});

test('unconfirmed first and last names stay for the applicant and are excluded from AI', async () => {
  let calls = 0;
  const answers = await load('utils/applicationAnswers.ts', {}, { complete: async (_config, messages) => {
    calls++;
    assert.doesNotMatch(messages[1].content, /"id":"Prénom\*"|"id":"Nom de famille\*"/);
    return { success: true, text: '{"answers":[{"id":"Email","value":"candidate@example.com","needsUser":false}]}' };
  } });
  const fields = [field('Prénom*', { required: true }), field('Nom de famille*', { required: true }), field('Email', { type: 'email' })];
  const result = await answers.draftApplicationAnswers('provider', { resume: 'Test Candidate', jobDescription: 'Test posting', fields });
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.needsUserIds)).sort(), ['Nom de famille*', 'Prénom*'].sort());
  assert.deepEqual(JSON.parse(JSON.stringify(result.answers.map(answer => answer.fieldId))), ['Email']);
});
