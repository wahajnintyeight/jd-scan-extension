import { JobData } from './types';

export class BaseAdapter {
    protected getElementText(el: Element | null): string {
        if (!el) return "";
        const anyEl = el as any;
        const text = (typeof anyEl.innerText === 'string' ? anyEl.innerText : el.textContent) || "";
        return text.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").trim();
    }

    protected createJobData(
        jd: string,
        title: string,
        company: string,
        element: Element | null,
        debug?: any
    ): JobData {
        return { jd, title, company, element, debug };
    }
}
