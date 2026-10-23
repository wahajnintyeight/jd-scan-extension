import { applicationFieldOwner, getApplicationFormRoots, isApplicationFieldVisible, isCustomApplicationControl, requiresUserAction } from './applicationDom';

export const restrictedFieldPattern = /password|one-time[- ]?code|credit.?card|cc-number|cc-exp|cc-csc|bank.?account|routing.?number/i;

export const getFieldLabel = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number) => {
    const root = field.getRootNode() as Document | ShadowRoot;
    const labelledBy = field.getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .map((labelId) => root.getElementById(labelId)?.textContent || '')
        .join(' ').replace(/\s+/g, ' ').trim();
    return [
        labelledBy,
        field.getAttribute('aria-label') || '',
        Array.from(field.labels || []).map((item) => item.textContent || '').join(' '),
        field.getAttribute('placeholder') || '',
        field.getAttribute('name') || '',
    ].map((text) => text?.replace(/\s+/g, ' ').trim() || '').find(Boolean)?.slice(0, 300) || `Text field ${index + 1}`;
};

export const getFieldDescription = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    const root = field.getRootNode() as Document | ShadowRoot;
    const describedBy = field.getAttribute('aria-describedby')?.split(/\s+/)
        .map((id) => root.getElementById(id)?.textContent || '').join(' ');
    const explicit = [field.getAttribute('aria-description'), describedBy]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (explicit) return explicit.slice(0, 600);

    const label = getFieldLabel(field, 0).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    for (let container = field.parentElement, depth = 0; container && depth < 4; container = container.parentElement, depth++) {
        const controls = Array.from(container.querySelectorAll('input, textarea, select'));
        if (controls.length !== 1 || controls[0] !== field) continue;
        const fieldChild = Array.from(container.children).find((child) => child === field || child.contains(field));
        if (!fieldChild) continue;
        const description = Array.from(container.children)
            .filter((child) => child !== fieldChild && child.tagName !== 'LABEL' && !child.querySelector('input, textarea, select, button'))
            .map((child) => (child.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((text) => {
                const normalized = text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
                return normalized && normalized !== label && !label.startsWith(normalized);
            })
            .join(' ')
            .trim();
        if (description) return description.slice(0, 600);
    }
};

export const fillApplicationField = async (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, rawValue: string, expectedUrl: string) => {
    if (!field.isConnected || field.disabled || ('readOnly' in field && field.readOnly) || !isApplicationFieldVisible(field)) return false;
    const roots = getApplicationFormRoots();
    if (!applicationFieldOwner(field, roots)) return false;
    if (field.value.trim()) return false;
    const type = field instanceof HTMLTextAreaElement ? 'textarea' : field instanceof HTMLSelectElement ? 'select' : field.type.toLowerCase();
    const label = getFieldLabel(field, 0);
    const fieldInfo = `${label} ${getFieldDescription(field) || ''} ${field.getAttribute('autocomplete') || ''} ${field.id}`;
    if (!['text', 'email', 'tel', 'url', 'search', 'textarea', 'select'].includes(type) || restrictedFieldPattern.test(fieldInfo) || requiresUserAction(fieldInfo) || isCustomApplicationControl(field)) return false;

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

