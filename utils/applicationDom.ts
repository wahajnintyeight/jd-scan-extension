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

export function requiresUserAction(label: string): boolean {
  return /\b(consent|privacy notice|privacy policy|terms and conditions|acknowledg(?:e|ment)|attest|certif(?:y|ication)|declar(?:e|ation)|signature|sign here|agree to (?:the )?(?:terms|privacy|data)|do you agree)\b/i.test(label);
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
