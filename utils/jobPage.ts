export function isLikelyJobUrl(href: string): boolean {
  const url = new URL(href);
  const path = url.pathname.toLowerCase();
  const host = url.hostname.toLowerCase();
  if (['jobs.lever.co', 'jobs.ashbyhq.com'].includes(host)) return path.split('/').filter(Boolean).length >= 2;
  if (host === 'jobs.workable.com') return path.startsWith('/view/') || path.startsWith('/search');
  if (host === 'workable.com' || host.endsWith('.workable.com')) return /\/(j|jobs)\//.test(path);
  return (host.endsWith('linkedin.com') && path.includes('/jobs')) || host.endsWith('indeed.com')
    || host.endsWith('glassdoor.com') || host.endsWith('wellfound.com')
    || /career|\/job\/|\/jobs\/|apply/.test(url.href.toLowerCase());
}
