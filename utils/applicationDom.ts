export function queryApplicationElements(selector: string, root: Document | Element | ShadowRoot = document): Element[] {
  const matches: Element[] = [];
  const roots: Array<Document | Element | ShadowRoot> = [root];
  for (let index = 0; index < roots.length; index++) {
    matches.push(...roots[index].querySelectorAll(selector));
    for (const element of roots[index].querySelectorAll('*')) {
      if (element.id === 'jd-scan-overlay-root') continue;
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }
  return matches;
}

export function applicationAncestor(element: Element, predicate: (element: Element) => boolean): Element | null {
  for (let current: Element | null = element; current;) {
    if (predicate(current)) return current;
    const root = current.getRootNode();
    current = current.parentElement || (root instanceof ShadowRoot ? root.host : null);
  }
  return null;
}

export function isRequiredApplicationField(element: Element): boolean {
  return element.hasAttribute('required') || element.getAttribute('aria-required') === 'true';
}

export function isApplicationFieldVisible(field: HTMLElement): boolean {
  if (applicationAncestor(field, element => element.hasAttribute('hidden') || element.hasAttribute('inert') || element.getAttribute('aria-hidden') === 'true')) return false;
  const style = window.getComputedStyle(field);
  return style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.display !== 'none' && field.getClientRects().length > 0;
}

const userReviewPatterns = [
  /\b(consent|privacy notice|privacy policy|terms and conditions|acknowledg(?:e|ment)|attest|certif(?:y|ication)|declar(?:e|ation)|signature|sign here|agree to (?:the )?(?:terms|privacy|data)|do you agree)\b/i,
  /\b(legally (?:authorized|able|allowed|permitted|entitled) to work|legally work|lawfully work|authorized to work|eligible to work|right to work|permission to work|work eligibility|employment eligibility|work authorization|work permit|visa|sponsorship|citizenship|citizen|immigration status|export control)\b/i,
  /\b(demographic|self[- ]identification|gender|pronouns|race|ethnicity|hispanic|veteran|disabilit\w*|medical|health condition|pregnan\w*)\b/i,
  /\b(salary|compensation|pay expectations|current salary|expected salary|hourly rate)\b/i,
  /\b(availability|available to start|when can you start|what date can you start|start date|notice period|willing to relocate|able to relocate|willing to travel|weekend shifts|shift work|full[\s-]?time on[\s-]?site|work on[\s-]?site|able to work on[\s-]?site)\b/i,
  /\b(background check|background screening|criminal history|criminal record|convicted|misdemeanor|felony|drug test|reference check|military service|military obligations|military status|date of birth|birth date|age|passport number|national id|social security number|tax identification|home address|street address|mailing address|postal address|residential address|zip code|postal code)\b/i,
];

export function requiresUserAction(context: string): boolean {
  return userReviewPatterns.some((pattern) => pattern.test(context));
}

export function getApplicationFormRoots(): Element[] {
  const forms = queryApplicationElements('form, [role="form"]').filter((root) => {
    if (applicationAncestor(root, element => element.id === 'jd-scan-overlay-root')) return false;
    const text = `${root.getAttribute('aria-label') || ''} ${root.getAttribute('action') || ''} ${root.textContent || ''}`.slice(0, 6000);
    if (/\b(application|applicant|candidate|cover letter|resume|curriculum vitae|employment history|work experience|apply for|apply to)\b/i.test(text)) return true;
    return /\b(apply|application|candidate)\b/i.test(window.location.pathname)
      && queryApplicationElements('button, input[type="submit"], [role="button"]', root).some(element =>
        /\b(next|continue|proceed|submit|apply)\b/i.test(`${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('value') || ''}`));
  });
  if (window.location.hostname === 'jobs.smartrecruiters.com' && window.location.pathname.startsWith('/oneclick-ui/')) {
    const root = document.querySelector('oc-oneclick-form');
    if (root && queryApplicationElements('input, textarea', root).length) forms.push(root);
  }
  if (window.location.hostname === 'jobs.ashbyhq.com') {
    for (const root of document.querySelectorAll('.ashby-application-form-container')) {
      if (!applicationAncestor(root, element => element.id === 'jd-scan-overlay-root') && !forms.includes(root)
          && root.querySelector('input, textarea, select')) forms.push(root);
    }
  }
  return forms;
}

export function applicationFieldOwner(element: Element, roots = getApplicationFormRoots()): Element | null {
  return applicationAncestor(element, candidate => roots.includes(candidate));
}

export function isCustomApplicationControl(element: Element): boolean {
  return Boolean(applicationAncestor(element, candidate => candidate.matches('spl-autocomplete, spl-phone-field, [role="combobox"]')));
}
