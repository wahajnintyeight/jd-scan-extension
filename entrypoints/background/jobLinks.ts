import { browser } from 'wxt/browser';
import { smartRecruitersPostingApi } from '../../utils/smartRecruiters';

export async function readSmartRecruitersPosting(url: string) {
  const endpoint = smartRecruitersPostingApi(url);
  if (!endpoint) throw new Error('Unsupported SmartRecruiters posting URL.');
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000), credentials: 'omit' });
  if (!response.ok) throw new Error(`Could not read this job posting (${response.status}).`);
  return response.json();
}

export async function openAndPrepareJob(input: string) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http or https job link without embedded credentials.');
  const tab = await browser.tabs.create({ url: url.href, active: true });
  if (tab.id === undefined) throw new Error('Could not open this job link.');
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const current = await browser.tabs.get(tab.id);
    if (!current.active) throw new Error('Keep the opened job tab active while JD Scan prepares it.');
    if (current.status !== 'complete') continue;
    let result;
    try { result = await browser.tabs.sendMessage(tab.id, { type: 'GET_JD' }); } catch { continue; }
    if (result?.error) throw new Error(result.error);
    if (typeof result?.data?.jd !== 'string' || result.data.jd.trim().length < 80) continue;
    const data = { sourceUrl: current.url, jd: result.data.jd.slice(0, 24000), title: String(result.data.title || ''), company: String(result.data.company || '') };
  await browser.storage.local.set({ jdScan_lastJob: { data, timestamp: Date.now(), url: current.url, tabId: tab.id } });
    await browser.tabs.sendMessage(tab.id, { type: 'FORCE_SHOW_BUTTON' }).catch(() => {});
    return { tabId: tab.id, data };
  }
  throw new Error('The job page opened, but its description could not be read. Wait for the page to load, then scan it or paste its job description.');
}
