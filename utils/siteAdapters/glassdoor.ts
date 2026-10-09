import { BaseAdapter } from './base';
import { SiteAdapter, JobData } from './types';
import { highlightInDOM } from '../keywordHighlighter';

export class GlassdoorAdapter extends BaseAdapter implements SiteAdapter {
    isMatch(url: string): boolean {
        return url.toLowerCase().includes("glassdoor.com");
    }

    getJobData(): JobData {
        const selectors = [
            "#JobDescriptionContainer",
            ".jobDescriptionContent", 
            ".desc",
            "[data-brand-views*='jobDescription']"
        ];

        let jd = "";
        let jobElement: Element | null = null;
        let debug: any = { method: 'glassdoor-selectors', tried: selectors };

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

        const title = this.getElementText(document.querySelector(".job-title")) ||
                      this.getElementText(document.querySelector("div[class*='JobDetails_jobTitle']")) ||
                      this.getElementText(document.querySelector("h1"));

        const company = this.getElementText(document.querySelector(".employer-name")) ||
                        this.getElementText(document.querySelector("div[class*='JobDetails_employerName']"));

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
