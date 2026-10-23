import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './extensionHarness.mjs';

async function reader({ pages = 1, text = 'React engineer' } = {}) {
  let destroyed = false;
  let cleaned = false;
  const helper = await load('utils/resumeFile.ts', {}, { pdfjs: {
    GlobalWorkerOptions: { workerSrc: 'bundled-worker' },
    getDocument: () => ({ promise: Promise.resolve({ numPages: pages,
      getPage: async () => ({ getTextContent: async () => ({ items: [{ str: text }] }), cleanup: () => { cleaned = true; } }),
      destroy: async () => { destroyed = true; },
    }) }),
  } });
  return { ...helper, destroyed: () => destroyed, cleaned: () => cleaned };
}

test('resume uploads reject unsupported, empty, oversized and excessive text inputs', async () => {
  const { readResumeFile } = await reader();
  const file = { name: 'resume.txt', size: 10, text: async () => '  React engineer  ' };
  assert.equal(await readResumeFile(file), 'React engineer');
  await assert.rejects(readResumeFile({ ...file, name: 'resume.docx' }), /Export Word documents/);
  await assert.rejects(readResumeFile({ ...file, text: async () => '  ' }), /No readable text/);
  await assert.rejects(readResumeFile({ ...file, size: 11 * 1024 * 1024 }), /10 MB/);
  await assert.rejects(readResumeFile({ ...file, text: async () => 'x'.repeat(200001) }), /too much text/);
});

test('PDF extraction cleans resources on success and bounded-work failures', async () => {
  const file = { name: 'resume.pdf', size: 10, arrayBuffer: async () => new ArrayBuffer(10) };
  const success = await reader();
  assert.equal(await success.readResumeFile(file), 'React engineer');
  assert.equal(success.cleaned(), true);
  assert.equal(success.destroyed(), true);
  for (const options of [{ pages: 101 }, { text: 'x'.repeat(200001) }]) {
    const helper = await reader(options);
    await assert.rejects(helper.readResumeFile(file), /100 pages|too much text/);
    assert.equal(helper.destroyed(), true);
  }
});
