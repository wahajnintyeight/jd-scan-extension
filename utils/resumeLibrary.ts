import type { Resume } from '../components/sidepanel/types';

export async function appendStoredResumes(additions: Resume[]): Promise<Resume[]> {
  const stored = await chrome.storage.local.get('resumes');
  const resumes = Array.isArray(stored.resumes) ? stored.resumes as Resume[] : [];
  const updated = [...resumes, ...additions];
  await chrome.storage.local.set({ resumes: updated });
  return updated;
}
