import { applicationAncestor, applicationFieldOwner, getApplicationFormRoots, isApplicationFieldVisible, queryApplicationElements } from './applicationDom';

export function findApplicationNavigation(fields: Element[]) {
  const roots = getApplicationFormRoots();
  const owners = new Set(fields.length ? fields.map(field => applicationFieldOwner(field, roots)).filter(Boolean) : roots);
  const finalPattern = /\b(submit|apply|send|finish|complete|review|confirm|accept|agree|sign|pay|purchase|consent|terms|captcha|verification|verify)\b/i;
  const actions = queryApplicationElements('button, input[type="button"], input[type="submit"], [role="button"], a')
    .filter(element => !applicationAncestor(element, parent => parent.id === 'jd-scan-overlay-root')
      && isApplicationFieldVisible(element as HTMLElement)
      && !('disabled' in element && element.disabled) && element.getAttribute('aria-disabled') !== 'true'
      && owners.has(applicationFieldOwner(element, roots)))
    .map(element => {
      const value = element instanceof HTMLInputElement ? element.value : '';
      const visible = (value || element.textContent || '').replace(/[›→]\s*$/, '').replace(/\s+/g, ' ').trim();
      const accessible = [element.getAttribute('aria-label') || '', element.getAttribute('title') || ''].join(' ').replace(/\s+/g, ' ').trim();
      return { element, label: (visible || accessible).slice(0, 120), cues: `${visible} ${accessible}`.slice(0, 300) };
    });
  const finalAction = actions.find(action => finalPattern.test(action.cues));
  const nextStep = actions.find(({ element, label, cues }) => {
    if (!fields.length) return false;
    if (finalPattern.test(cues) || !/^(?:(?:save|save draft)\s+(?:and|&)\s+)?(?:next|continue|proceed)(?:\s+(?:to|with|application|step|page|section|questions|details))*$/i.test(label)) return false;
    if (element instanceof HTMLAnchorElement && new URL(element.href, window.location.href).origin !== window.location.origin) return false;
    return true;
  });
  return { nextStep, finalAction };
}
