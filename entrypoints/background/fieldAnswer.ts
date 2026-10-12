import { browser } from 'wxt/browser';
import { createLLMChatCompletion, fetchLLMConfigs } from '../../utils/api';
import { buildApplicationFormMessages, parseApplicationFormAnswers } from '../../utils/llmAgent';
import type { ApplicationFormField, JobData, Resume } from '../../components/sidepanel/types';

export async function draftApplicationField(input: { tabId: number; fieldId: string; fieldLabel: string; fieldType: string; expectedUrl: string }) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== input.tabId || tab.url !== input.expectedUrl || !/^https?:\/\//i.test(tab.url || '')) {
    throw new Error('Keep the application page active and try again.');
  }

  const stored = await browser.storage.local.get(['resumes', 'userSettings', 'jdScan_lastJob', 'jdScan_applicationJob']);
  const resumes = Array.isArray(stored.resumes) ? stored.resumes as Resume[] : [];
  const resume = resumes.find(candidate => candidate.selected && typeof candidate.content === 'string' && candidate.content.trim());
  if (!resume) throw new Error('Select a resume in JD Scan before drafting an answer.');

  const applicationJob = stored.jdScan_applicationJob as { tabId?: number; job?: JobData } | undefined;
  const lastJob = stored.jdScan_lastJob as { tabId?: number; url?: string; timestamp?: number; data?: JobData } | undefined;
  const job = applicationJob?.tabId === input.tabId ? applicationJob.job
    : (lastJob?.tabId === input.tabId || lastJob?.url === input.expectedUrl) && Date.now() - (lastJob.timestamp || 0) < 6 * 60 * 60 * 1000
      ? lastJob.data : undefined;
  if (!job || typeof job.jd !== 'string' || job.jd.length < 80) {
    throw new Error('Prepare this job posting in JD Scan before drafting an answer.');
  }

  const configs = (await fetchLLMConfigs()).filter(config => config.isActive);
  const settings = stored.userSettings || {};
  const config = configs.find(candidate => candidate.id === settings.selectedLLMConfigId) || configs[0];
  if (!config) throw new Error('Add an active AI provider in Settings before drafting an answer.');

  const page = await browser.tabs.sendMessage(input.tabId, { type: 'GET_APPLICATION_FIELDS' });
  if (!page?.success || page.url !== input.expectedUrl) throw new Error('Rescan the current application form and try again.');
  const field = (page.fields as ApplicationFormField[] | undefined)?.find(candidate => candidate.id === input.fieldId);
  if (!field || field.label !== input.fieldLabel || field.type !== input.fieldType || field.value.trim()) {
    throw new Error('This field changed. Focus it again and retry.');
  }

  const result = await createLLMChatCompletion(config.id, buildApplicationFormMessages({
    resume: resume.content,
    jobDescription: job.jd,
    jobTitle: job.title,
    company: job.company,
    fields: [field],
  }));
  if (!result.success || !result.text) throw new Error(result.error || 'The AI could not draft this answer.');
  const answer = parseApplicationFormAnswers(result.text, [field]).answers[0];
  if (!answer) throw new Error('I could not find a reliable answer in your resume. Please answer this field yourself.');

  const filled = await browser.tabs.sendMessage(input.tabId, {
    type: 'FILL_APPLICATION_FIELD',
    fieldId: answer.fieldId,
    expectedUrl: input.expectedUrl,
    value: answer.value,
  });
  if (!filled?.success) throw new Error(filled?.error || 'The answer could not be placed in this field.');
  return { filled: true };
}
