import { BaseAdapter } from './base';
import { SiteAdapter, JobData } from './types';
import { highlightInDOM } from '../keywordHighlighter';

export class IndeedAdapter extends BaseAdapter implements SiteAdapter {
    isMatch(url: string): boolean {
        return url.toLowerCase().includes("indeed.com");
    }

    getJobData(): JobData {
        const selectors = [
            "#jobDescriptionText",
            ".jobsearch-JobComponent-description",
            ".job-description",
            ".jobsearch-JobDescriptionSection-sectionItem"
        ];

        let jd = "";
        let jobElement: Element | null = null;
        let debug: any = { method: 'indeed-selectors', tried: selectors };

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                const text = this.getElementText(el);
                if (text.length > jd.length && text.length > 50) {
                    jd = text;
                    jobElement = el;
                }
            }
        }

        const title = this.getElementText(document.querySelector(".jobsearch-JobInfoHeader-title")) ||
                      this.getElementText(document.querySelector("h1.jobsearch-JobInfoHeader-title"));
        
        const company = this.getElementText(document.querySelector("[data-company-name='true']")) ||
                        this.getElementText(document.querySelector(".jobsearch-CompanyInfoContainer"));

        return this.createJobData(jd, title, company, jobElement, debug);
    }

    highlight(element: Element, resumeContent: string): { matchedCount: number; unmatchedCount: number } | null {
        const result = highlightInDOM(element, resumeContent);
        return {
            matchedCount: result.stats.matchedCount,
            unmatchedCount: result.stats.unmatchedCount
        };
    }
}
