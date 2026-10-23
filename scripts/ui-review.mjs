import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run after building; point PLAYWRIGHT_MODULE at an installed Playwright module.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts = resolve('.output/ui-review');
await mkdir(artifacts, { recursive: true });
const context = await chromium.launchPersistentContext(resolve(artifacts, 'browser-profile'), {
  headless: false,
  args: ['--allow-file-access-from-files'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  const event = () => ({ addListener() {}, removeListener() {} });
  const state = {
    userSettings: { displayMode: 'sidebar', colorMode: 'light', selectedLLMConfigId: 'first' },
    resumes: [{ id: 'resume', name: 'Senior software engineer resume with a long filename.txt', selected: true, content: 'React TypeScript accessibility', fileSize: 1200, fileType: 'text/plain', uploadedAt: new Date().toISOString() }],
    jdScan_lastJob: { url: 'https://example.com/jobs/1', tabId: 1, data: { title: 'Senior software engineer', company: 'Example company', jd: 'Build accessible React and TypeScript applications, collaborate with designers, write regression tests, and review code with the engineering team.' } },
    jd_scan_session: { sessionId: 'ui-review', createdAt: Date.now(), expiresAt: Date.now() + 3600000 },
  };
  window.__reviewState = state;
  window.chrome = {
    runtime: { id: 'ui-review', onMessage: event(), sendMessage: async message => {
      if (message.type === 'JD_SCAN_GET_ACTIVE_TAB') return { success: true, tab: { id: 1, url: 'https://example.com/jobs/1' } };
      return { success: true, response: { success: true, data: state.jdScan_lastJob.data } };
    } },
    storage: { onChanged: event(), local: {
      get: (key, callback) => { const result = { [key]: state[key] }; callback?.(result); return Promise.resolve(result); },
      set: (values, callback) => { Object.assign(state, values); callback?.(); return Promise.resolve(); },
      remove: async key => { delete state[key]; },
    } },
  };
});
await page.route('https://**/*', route => {
  if (route.request().url().includes('/llm-api-configs')) {
    return route.fulfill({ json: { code: 1009, result: ['first', 'second'].map(id => ({ id, name: `Provider ${id}`, provider: 'openai', model: 'review-model', isActive: true })) } });
  }
  return route.abort();
});
// File previews need absolute file URLs for WXT's root-relative build assets.
const buildRoot = pathToFileURL(resolve('.output/chrome-mv3') + '/').href;
const html = (await readFile('.output/chrome-mv3/sidepanel.html', 'utf8')).replace(/(src|href)="\//g, `$1="${buildRoot}`);
await writeFile(resolve(artifacts, 'sidepanel.html'), html);
const url = pathToFileURL(resolve(artifacts, 'sidepanel.html')).href;
const checkOverflow = async () => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflows horizontally');
  const overflowing = await page.locator('main').evaluate(main => main.scrollWidth > main.clientWidth);
  assert.equal(overflowing, false, 'Workspace overflows horizontally');
};
const settle = () => page.evaluate(async () => {
  await Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
});
try {
  await page.goto(url);
  await page.getByRole('heading', { name: 'Application Agent' }).waitFor();
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ['Apply', 'Match', 'Resumes', 'History']) {
      await page.getByRole('navigation').getByRole('button', { name: new RegExp(`^${tab}`) }).click();
      await checkOverflow();
      if (tab === 'Apply' || tab === 'Resumes') {
        await settle();
        await page.screenshot({ path: resolve(artifacts, `${tab.toLowerCase()}-${width}.png`) });
      }
    }
  }
  await page.getByRole('button', { name: /^Resumes/ }).click();
  const checkbox = page.getByRole('checkbox', { name: /^Select Senior/ });
  await checkbox.focus();
  await page.keyboard.press('Space');
  assert.equal(await checkbox.isChecked(), false);
  await page.keyboard.press('Space');
  assert.equal(await checkbox.isChecked(), true);
  await page.getByRole('button', { name: /^Match$/ }).click();
  await page.getByRole('button', { name: 'Toggle manual input' }).click();
  await page.getByRole('textbox', { name: 'Job description', exact: true }).fill('React TypeScript');
  await checkOverflow();
  await page.getByRole('button', { name: /^Apply$/ }).click();
  await page.locator('summary').filter({ hasText: 'Name for application forms' }).click();
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Candidate');
  await page.getByRole('button', { name: 'Save application name', exact: true }).click();
  await page.getByText('Name saved for this resume.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__reviewState['jdScan_applicationName:resume'].name.firstName), 'Test');
  await page.getByRole('button', { name: 'Save application name', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(artifacts, 'application-name.png') });
  await page.getByRole('button', { name: 'Use resume name instead', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__reviewState['jdScan_applicationName:resume']), undefined);
  await page.getByLabel('AI provider and model').selectOption('second');
  assert.equal(await page.evaluate(() => window.__reviewState.userSettings.selectedLLMConfigId), 'second');
  await page.getByLabel('What should the agent do?').selectOption('custom');
  await page.getByLabel('Your request').fill('Help me prepare for this application.');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await settle();
  await page.screenshot({ path: resolve(artifacts, 'apply-dark.png') });
  await page.getByRole('button', { name: /^Resumes/ }).click();
  await page.getByRole('button', { name: /^Delete Senior/ }).click();
  await page.getByRole('button', { name: 'Browse files' }).waitFor();
  await page.setViewportSize({ width: 375, height: 900 });
  await checkOverflow();
  await page.screenshot({ path: resolve(artifacts, 'resumes-empty-dark.png') });
  await page.locator('input[type="file"]').setInputFiles({ name: 'unsupported.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('unsupported') });
  await page.getByText('Upload a PDF or TXT resume. Export Word documents as PDF first.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__reviewState.resumes.length), 0);
  await page.locator('input[type="file"]').setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('  ') });
  await page.getByText('No readable text found. Use a text-based PDF or TXT resume.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__reviewState.resumes.length), 0);
  await settle();
  await page.screenshot({ path: resolve(artifacts, 'upload-validation.png') });
  await page.locator('input[type="file"]').setInputFiles({ name: 'review-resume.txt', mimeType: 'text/plain', buffer: Buffer.from('React TypeScript accessibility') });
  await page.getByRole('checkbox', { name: 'Select review-resume.txt' }).waitFor();
  assert.equal(await page.evaluate(() => window.__reviewState.resumes[0].content), 'React TypeScript accessibility');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('UI review passed: 5 widths, 4 tabs, keyboard resume selection, provider persistence, manual job input, custom request, dark theme, empty library, text upload.');
} catch (error) {
  console.error('Runtime errors:', errors);
  console.error('Page:', await page.locator('body').innerText());
  await page.screenshot({ path: resolve(artifacts, 'failure.png') });
  throw error;
} finally {
  await context.close();
}
