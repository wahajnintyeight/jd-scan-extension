import type { ApplicationFormField } from '../components/sidepanel/types';
import { requiresUserAction } from './applicationDom';

export interface ApplicationName { firstName: string; lastName: string }
const storageKey = 'jdScan_applicationName';
export const applicationNameKey = (resumeId: string) => `${storageKey}:${resumeId}`;

export function validApplicationName(value: unknown): value is ApplicationName {
  if (!value || typeof value !== 'object') return false;
  const name = value as Partial<ApplicationName>;
  return [name.firstName, name.lastName].every(part => typeof part === 'string' && part.trim().length > 0 && part.length <= 100 && !/[\r\n\u0000-\u001f]/.test(part));
}

export function requiresConfirmedName(field: ApplicationFormField): boolean {
  const autocomplete = field.autocomplete?.trim().split(/\s+/).at(-1);
  return autocomplete === 'given-name' || autocomplete === 'family-name'
    || /\b(?:first|given|last|family)\s+name\b|\bsurname\b|\bpr[eé]nom\b|\bnom\s+de\s+famille\b/i.test(field.label);
}

export async function loadApplicationName(resumeId: string): Promise<ApplicationName | undefined> {
  const key = applicationNameKey(resumeId);
  const stored = (await chrome.storage.local.get(key))[key] as { resumeId?: unknown; name?: unknown } | undefined;
  return stored?.resumeId === resumeId && validApplicationName(stored.name) ? stored.name : undefined;
}

export async function saveApplicationName(resumeId: string, name: ApplicationName): Promise<void> {
  if (!resumeId || !validApplicationName(name)) throw new Error('Enter your first and last names, up to 100 characters each.');
  await chrome.storage.local.set({ [applicationNameKey(resumeId)]: { resumeId, name: { firstName: name.firstName.trim(), lastName: name.lastName.trim() } } });
}

export function confirmedNameAnswer(field: ApplicationFormField, name?: ApplicationName): string | undefined {
  if (!validApplicationName(name) || field.value.trim() || field.type !== 'text' || field.requiresUserAction || requiresUserAction(field.label) || /\b(legal|preferred|mother|father|parent|spouse|partner|emergency|reference|referee|manager)\b|\b(?:full|complete)\s*name\b/i.test(field.label)) return;
  const label = field.label.replace(/^[*\s]+/, '').toLowerCase();
  const autocomplete = field.autocomplete?.trim().split(/\s+/).at(-1);
  const first = autocomplete === 'given-name' || /^(?:first\s*name|given\s*name|pr[eé]nom)\b/.test(label);
  const last = autocomplete === 'family-name' || /^(?:last\s*name|family\s*name|surname|nom\s+de\s+famille)\b/.test(label);
  if (first === last) return;
  const value = (first ? name.firstName : name.lastName).trim();
  if (field.maxLength != null && field.maxLength >= 0 && value.length > field.maxLength) return;
  return value;
}
