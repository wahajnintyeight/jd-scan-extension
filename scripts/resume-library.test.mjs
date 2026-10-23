import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';

test('new resumes are shown as saved only after the stored library is updated', async () => {
  const stored = { resumes: [{ id: 'old', name: 'old.txt' }] };
  const { appendStoredResumes } = await load('utils/resumeLibrary.ts', {
    storage: { local: {
      get: async () => ({ resumes: stored.resumes }),
      set: async values => { stored.resumes = values.resumes; },
    } },
  });
  const added = { id: 'new', name: 'new.pdf' };

  const result = await appendStoredResumes([added]);

  assert.deepEqual(Array.from(result, resume => resume.id), ['old', 'new']);
  assert.equal(JSON.stringify(stored.resumes), JSON.stringify(result));
});

test('a resume storage error reaches the upload flow', async () => {
  const { appendStoredResumes } = await load('utils/resumeLibrary.ts', {
    storage: { local: {
      get: async () => ({ resumes: [] }),
      set: async () => { throw new Error('quota'); },
    } },
  });

  await assert.rejects(appendStoredResumes([{ id: 'new', name: 'new.pdf' }]), /quota/);
});
