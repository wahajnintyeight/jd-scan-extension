import { sameJobPage } from '../../utils/jobContext';
import { browser } from 'wxt/browser';
import { draftApplicationAnswers } from '../../utils/applicationAnswers';
import { validApplicationName, type ApplicationName } from '../../utils/applicationName';
import type { ApplicationFormField, JobData } from '../../components/sidepanel/types';

const runningTabs = new Set<number>();
const signature = (fields: ApplicationFormField[]) => fields.map(field => `${field.type}:${field.label}`).join('|');

export async function runApplication(input: { tabId: number; configId: string; resume: string; job: JobData; applicationName?: ApplicationName }, sourceWindowId?: number) {
  const { tabId, configId, resume } = input;
  if (!Number.isInteger(tabId) || tabId < 0 || typeof configId !== 'string' || !configId || typeof resume !== 'string' || !resume.trim() ||
      resume.length > 200000 || !input.job || typeof input.job.jd !== 'string' || input.job.jd.length < 80 || input.job.jd.length > 24000 ||
      typeof input.job.title !== 'string' || typeof input.job.company !== 'string' ||
      (input.applicationName !== undefined && !validApplicationName(input.applicationName))) throw new Error('Select a resume, provider, and prepared job before starting.');
  if (runningTabs.has(tabId)) throw new Error('An application run is already active in this tab.');
  runningTabs.add(tabId);
  let filled = 0;
  let url = '';
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let currentStatus = '';
  const activeTab = async () => {
    const [tab] = await browser.tabs.query({ active: true, ...(sourceWindowId === undefined ? { currentWindow: true } : { windowId: sourceWindowId }) });
    if (tab?.id !== tabId || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Switch back to the application tab and run the assistant again.');
    url = tab.url || '';
    return tab;
  };
  const progress = async (status: string, running = true, error = '') => {
    currentStatus = status;
    if (!running && heartbeat) clearInterval(heartbeat);
    await browser.storage.local.set({ jdScan_applicationRun: { tabId, url, status, running, error, filled, timestamp: Date.now() } });
    return { status, error, filled };
  };
  const pageMessage = async (message: Record<string, unknown>) => {
    const applicationTab = await activeTab();
    if (typeof message.expectedUrl === 'string' && applicationTab.url !== message.expectedUrl) {
      throw new Error('The application page changed. Review the current job and start again.');
    }
    await browser.storage.local.set({ jdScan_applicationJob: { tabId, url: applicationTab.url, job: input.job, timestamp: Date.now() } });
    return browser.tabs.sendMessage(tabId, message);
  };
  const readFields = async () => {
    const page = await pageMessage({ type: 'GET_APPLICATION_FIELDS' });
    if (!page?.success) throw new Error(page?.error || 'Could not read the application form. Refresh the page and try again.');
    return page;
  };
  const waitForStep = async (previous: { url: string; fields?: ApplicationFormField[] }) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await activeTab();
      try {
        const page = await readFields();
        if (page.applicationContext && ((page.fields || []).length || page.blockedRequiredCount || page.finalActionFound)
          && (page.url !== previous.url || signature(page.fields || []) !== signature(previous.fields || []))) return page;
      } catch { /* The next document may still be loading its content script. */ }
    }
    throw new Error('The form did not advance. Open it manually, then run the assistant again.');
  };
  try {
    const initialTab = await activeTab();
    if (!input.job.sourceUrl || !sameJobPage(input.job.sourceUrl, initialTab.url || '')) {
      throw new Error('The prepared job does not match this page. Read the current posting before filling.');
    }
    await progress('Reading the prepared job and application form…');
    // Storage activity keeps the worker alive while waiting for the selected provider.
    heartbeat = setInterval(() => { void progress(currentStatus).catch(() => {}); }, 15000);
    let page = await readFields();
    if (!page.applicationContext) {
      const opened = await pageMessage({ type: 'OPEN_APPLICATION_FORM', expectedUrl: page.url });
      if (!opened?.success || (!opened.clicked && !opened.alreadyOpen)) throw new Error(opened?.error || 'Open the application form manually.');
      page = opened.alreadyOpen ? await readFields() : await waitForStep(page);
    }
    if (!page.applicationContext) throw new Error('Open the application form before starting.');
    const visitedSteps = new Set<string>();
    // shortcut: cap a run at 8 steps, expand after observing longer application flows.
    for (let step = 1; step <= 8; step++) {
      const stepKey = `${page.url}::${signature(page.fields || [])}`;
      if (visitedSteps.has(stepKey)) return await progress(`Filled ${filled} fields. The form returned to an earlier step; continue manually.`, false);
      visitedSteps.add(stepKey);
      const fields = (page.fields || []) as ApplicationFormField[];
      if (!fields.length && page.finalActionFound) return await progress(`Filled ${filled} fields. The final review or submission is ready for you.`, false);
      const empty = fields.filter(field => !field.value.trim());
      let needsUser = false;
      if (empty.length) {
        await progress(`Reading your resume and drafting answers for step ${step}…`);
        const parsed = await draftApplicationAnswers(configId, { resume, jobDescription: input.job.jd,
          jobTitle: input.job.title, company: input.job.company, fields: empty, applicationName: input.applicationName });
        needsUser = empty.some(field => field.required && parsed.needsUserIds.includes(field.id));
        if (parsed.answers.length) {
          const response = await pageMessage({ type: 'FILL_APPLICATION_FIELDS', expectedUrl: page.url, fields: parsed.answers });
          if (!response?.success) throw new Error(response?.error || 'The page changed before filling.');
          filled += Number(response.filled) || 0;
        }
        page = await readFields();
        needsUser ||= (page.fields || []).some((field: ApplicationFormField) => field.required && !field.value.trim());
      }
      if (needsUser || Number(page.blockedRequiredCount) > 0 || Number(page.truncatedFieldCount) > 0) {
        return await progress(`Filled ${filled} supported fields. Complete the remaining required or custom controls and uploads, then review the form.`, false);
      }
      if (step === 8) return await progress(`Filled ${filled} fields. Reached the 8-step limit; review the remaining form.`, false);
      const previous = page;
      const advance = await pageMessage({ type: 'ADVANCE_APPLICATION_STEP', expectedUrl: page.url });
      if (!advance?.success) throw new Error(advance?.error || 'Could not inspect the next step.');
      if (!advance.clicked) return await progress(`Filled ${filled} fields. ${advance.finalActionFound ? 'The final review or submission is ready for you.' : 'Review this step and continue manually.'}`, false);
      await progress(`Filled ${filled} fields; opening the next step…`);
      page = await waitForStep(previous);
    }
    return await progress(`Filled ${filled} fields. Review the application.`, false);
  } catch (error) {
    return await progress('', false, error instanceof Error ? error.message : 'The application assistant stopped.');
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    runningTabs.delete(tabId);
  }
}
