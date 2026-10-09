import { BaseAdapter } from './base';
import { SiteAdapter, JobData } from './types';
import { highlightInDOM } from '../keywordHighlighter';

export class WorkableAdapter extends BaseAdapter implements SiteAdapter {
    isMatch(url: string): boolean {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes("workable.com") || 
               (lowerUrl.includes("workable") && lowerUrl.includes("/j/")) ||
               lowerUrl.includes("jobs.workable.com");
    }

    getJobData(): JobData {
        const selectors = [
            "[data-ui='job-description']",
            ".job-description",
            "[data-ui='description']", 
            ".description",
            ".job-ad-description",
            ".job-posting-description", 
            ".job-content",
            ".job-details",
            "[data-ui='job-content']",
            "main section",
            "main .content", 
            "main article",
            "[role='main'] section",
            "[role='main'] .description",
            "[role='main'] article",
            ".job-posting-content",
            "[data-testid='job-description']",
            "[data-testid='description']",
            ".content-section",
            ".main-content",
            ".primary-content",
            "main [data-ui='description']",
            "main .job-description",
            "main div[class*='description']",
            "main div[class*='content']"
        ];

        let jd = "";
        let jobElement: Element | null = null;
        let debug: any = { method: 'workable-selectors', tried: selectors };

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

        if (!jd) {
            // Header-based fallback
            const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            for (const header of Array.from(headers)) {
                const headerText = this.getElementText(header).toLowerCase();
                if (headerText.includes('description') || headerText.includes('about') || headerText.includes('role')) {
                    let nextElement = header.nextElementSibling;
                    while (nextElement) {
                        const text = this.getElementText(nextElement);
                        if (text.length > 200) {
                            if (text.length > jd.length) {
                                jd = text;
                                jobElement = nextElement;
                            }
                            break;
                        }
                        nextElement = nextElement.nextElementSibling;
                    }
                }
            }
        }

        const title = this.getElementText(document.querySelector("[data-ui='job-title']")) ||
                      this.getElementText(document.querySelector(".job-title")) ||
                      this.getElementText(document.querySelector("[data-testid='job-title']")) ||
                      this.getElementText(document.querySelector("h1"));

        const company = this.getElementText(document.querySelector("[data-ui='company-name']")) ||
                        this.getElementText(document.querySelector(".company-name")) ||
                        this.getElementText(document.querySelector("[data-testid='company-name']")) ||
                        this.getElementText(document.querySelector("[data-ui='company']")) ||
                        this.getElementText(document.querySelector(".company")) ||
                        this.getElementText(document.querySelector(".employer-name"));

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
