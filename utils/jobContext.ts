import type { JobData } from '../components/sidepanel/types';

export function sameJobPage(source: string, target: string): boolean {
  try {
    const from = new URL(source);
    const to = new URL(target);
    if (!['http:', 'https:'].includes(from.protocol) || from.origin !== to.origin) return false;
    from.hash = '';
    to.hash = '';
    // These boards retain the posting ID when opening its application.
    const suffix = from.hostname === 'jobs.lever.co' ? /\/apply\/?$/
      : from.hostname === 'jobs.ashbyhq.com' ? /\/application\/?$/ : null;
    if (suffix) {
      from.pathname = from.pathname.replace(suffix, '');
      to.pathname = to.pathname.replace(suffix, '');
    }
    return from.href === to.href;
  } catch {
    return false;
  }
}

export function jobForPage(record: unknown, url: string, tabId?: number): JobData | null {
  if (!record || typeof record !== 'object') return null;
  const stored = record as { url?: unknown; tabId?: unknown; data?: Partial<JobData> };
  const data = stored.data;
  if (typeof stored.url !== 'string' || !sameJobPage(stored.url, url) ||
      (tabId !== undefined && stored.tabId !== undefined && stored.tabId !== tabId) ||
      !data || typeof data.jd !== 'string' || data.jd.trim().length < 80 || data.jd.length > 24000 ||
      typeof data.title !== 'string' || typeof data.company !== 'string') return null;
  return { jd: data.jd, title: data.title, company: data.company, sourceUrl: stored.url };
}
