import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';

const { sameJobPage, jobForPage } = await load('utils/jobContext.ts', {});
const posting = 'https://jobs.lever.co/example/job-one';
const data = { jd: 'Build accessible React and TypeScript applications. Work with designers and review code. Four years of experience.', title: 'Engineer', company: 'Example' };

test('a saved job is accepted only for its posting and tab', () => {
  const record = { url: posting, tabId: 7, data };
  assert.equal(jobForPage(record, posting, 7).sourceUrl, posting);
  assert.equal(jobForPage(record, posting, 8), null);
  assert.equal(jobForPage(record, posting.replace('job-one', 'job-two'), 7), null);
  assert.equal(jobForPage({ data }, posting, 7), null);
  assert.equal(jobForPage({ ...record, data: { ...data, jd: 'short' } }, posting, 7), null);
});

test('Lever application URLs preserve the posting identity without accepting other jobs', () => {
  assert.equal(sameJobPage(posting, `${posting}/apply`), true);
  assert.equal(sameJobPage(posting, `${posting}/apply#form`), true);
  assert.equal(sameJobPage(posting, posting.replace('job-one', 'job-two') + '/apply'), false);
  assert.equal(sameJobPage(posting, posting.replace('jobs.lever.co', 'jobs.lever.co.evil.example')), false);
  assert.equal(sameJobPage('javascript:alert(1)', 'javascript:alert(1)'), false);
});

test('search selection changes invalidate the stored job', () => {
  const url = 'https://jobs.workable.com/search?query=engineer&selectedJobId=first';
  assert.equal(jobForPage({ url, data }, url.replace('=first', '=second')), null);
  assert.equal(jobForPage({ url, data }, url).title, 'Engineer');
});

test('single-field drafting rejects old context after navigating within the same tab', async () => {
  for (const stored of [
    { jdScan_applicationJob: { tabId: 7, url: posting, job: data } },
    { jdScan_lastJob: { tabId: 7, url: posting, data, timestamp: Date.now() } },
  ]) {
    const current = posting.replace('job-one', 'job-two');
    const helper = await load('entrypoints/background/fieldAnswer.ts', {
      tabs: { query: async () => [{ id: 7, url: current }], sendMessage() { throw new Error('Must reject before reading form fields'); } },
      storage: { local: { get: async () => ({ ...stored, resumes: [{ selected: true, content: 'Test Candidate' }] }) } },
    });
    await assert.rejects(helper.draftApplicationField({ tabId: 7, expectedUrl: current, fieldId: 'name', fieldLabel: 'Name', fieldType: 'text' }), /Prepare this job posting/);
  }
});
