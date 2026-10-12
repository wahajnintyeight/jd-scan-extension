export function smartRecruitersPostingApi(input: string): string | null {
  const url = new URL(input);
  if (url.hostname !== 'jobs.smartrecruiters.com' || url.protocol !== 'https:') return null;
  const match = url.pathname.match(/^\/oneclick-ui\/company\/([\w-]+)\/publication\/([\w-]+)\/?$/);
  return match ? `https://api.smartrecruiters.com/v1/companies/${match[1]}/postings/${match[2]}` : null;
}

export function smartRecruitersJobData(posting: unknown) {
  const data = posting as { name?: string; company?: { name?: string }; jobAd?: { sections?: Record<string, { title?: string; text?: string }> } };
  if (!data || typeof data.name !== 'string' || !data.jobAd?.sections) throw new Error('This posting has no readable job description.');
  const sections = Object.values(data.jobAd.sections).map(section => {
    if (!section || typeof section !== 'object') return '';
    const html = typeof section.text === 'string' ? section.text.slice(0, 24000) : '';
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script, style').forEach(element => element.remove());
    parsed.querySelectorAll('p, li, div, h1, h2, h3, h4, h5, h6, br').forEach(element => element.after(parsed.createTextNode('\n')));
    return `${typeof section.title === 'string' ? section.title.slice(0, 300) : ''}\n${parsed.body.textContent || ''}`;
  });
  const jd = sections.join('\n\n').trim().slice(0, 24000);
  if (jd.length < 80) throw new Error('This posting has no readable job description.');
  return { title: data.name.slice(0, 300), company: typeof data.company?.name === 'string' ? data.company.name.slice(0, 300) : '', jd };
}
