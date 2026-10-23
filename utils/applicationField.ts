import { applicationFieldOwner, getApplicationFormRoots, isApplicationFieldVisible, isCustomApplicationControl, requiresUserAction } from './applicationDom';

export const restrictedFieldPattern = /password|one-time[- ]?code|credit.?card|cc-number|cc-exp|cc-csc|bank.?account|routing.?number/i;

export const getFieldLabel = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number) => {
    const root = field.getRootNode() as Document | ShadowRoot;
    const labelledBy = field.getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .map((labelId) => root.getElementById(labelId)?.textContent || '')
        .join(' ');
    return [
        Array.from(field.labels || []).map((item) => item.textContent || '').join(' '),
        field.getAttribute('aria-label') || '',
        labelledBy || '',
        field.getAttribute('placeholder') || '',
        field.getAttribute('name') || '',
    ].join(' ').replace(/\s+/g, ' ').trim().slice(0, 300) || `Text field ${index + 1}`;
};

export const fillApplicationField = async (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, rawValue: string, expectedUrl: string) => {
    if (!field.isConnected || field.disabled || ('readOnly' in field && field.readOnly) || !isApplicationFieldVisible(field)) return false;
    const roots = getApplicationFormRoots();
    if (!applicationFieldOwner(field, roots)) return false;
    if (field.value.trim()) return false;
    const type = field instanceof HTMLTextAreaElement ? 'textarea' : field instanceof HTMLSelectElement ? 'select' : field.type.toLowerCase();
    const fieldInfo = `${getFieldLabel(field, 0)} ${field.getAttribute('autocomplete') || ''} ${field.id}`;
    if (!['text', 'email', 'tel', 'url', 'search', 'textarea', 'select'].includes(type) || restrictedFieldPattern.test(fieldInfo) || requiresUserAction(getFieldLabel(field, 0)) || isCustomApplicationControl(field)) return false;

    let value = rawValue.trim();
    if (!value || value.length > 4000) return false;
    if (field instanceof HTMLSelectElement) {
        const option = Array.from(field.options).find((candidate) =>
            !candidate.disabled && (candidate.value === value || (candidate.textContent || '').trim().toLocaleLowerCase() === value.toLocaleLowerCase()),
        );
        if (!option) return false;
        value = option.value;
    } else if (field.maxLength >= 0 && value.length > field.maxLength) {
        return false;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    field.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    if (!field.isConnected || expectedUrl !== window.location.href || field.value.trim() || field.disabled ||
        ('readOnly' in field && field.readOnly) || !isApplicationFieldVisible(field) || isCustomApplicationControl(field)) return false;

    const prototype = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return field.value === value;
};

